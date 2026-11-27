import { describe, expect, it } from 'vitest';
import { plusTage } from '../ct/datum';
import type { NachweisEinstellungen } from './nachweise';
import { personStand, standFuerLeitung, type PersonAngaben } from './nachweisStand';
import {
  AMPEL_TEXT,
  OHNE_GUELTIGEN,
  ampelDerAnmeldung,
  ampelDerPerson,
  ampelFuer,
  ampelRang,
  ampelTon,
  ampelZelle,
  monatJahr,
  nachweisArtVon,
  nachweisSpaltenKey,
  type AmpelEingabe,
  type AmpelWert,
  type NachweisLage,
} from './nachweisAmpel';

/**
 * Die Ampel der Leitung (N3d, E24/E38). Die Werte im Stand kommen aus den Erzeugern (`personStand` → `standFuerLeitung`),
 * nicht aus abgeschriebenen Literalen; die Grenzen („endet genau am letzten Tag“, heute, gestern) stehen ausdrücklich da.
 * „heute“ ist ein Parameter – keine Uhr im Test.
 */
const HEUTE = '2026-11-20';
const ENDE = '2026-12-06';
const E: NachweisEinstellungen = { gueltigJahre: 3, ab: 'ausstellung', betreff: 'B', text: 'T' };
const PID = 7;

const eingabe = (
  stand: AmpelEingabe['stand'],
  extra: Partial<AmpelEingabe> = {},
): AmpelEingabe => ({
  bedingungKaputt: false,
  zaehlt: true,
  stand,
  personId: PID,
  letzterTag: ENDE,
  heute: HEUTE,
  ...extra,
});
const mit = (wert: string) => eingabe({ art: 'gelesen', personen: new Map([[PID, wert]]) });
const wert = (e: AmpelEingabe) => ampelFuer(e).wert;

describe('ampelFuer – die Zweige einzeln', () => {
  it('kaputte Bedingung geht vor allem: „Bedingung prüfen“, nie „nicht nötig“ (E29)', () => {
    expect(wert(eingabe({ art: 'nichtLesbar' }, { bedingungKaputt: true, zaehlt: false }))).toBe(
      'bedingung',
    );
    expect(wert({ ...mit('rot'), bedingungKaputt: true })).toBe('bedingung');
  });

  it('wer nicht zählt (Bedingung trifft nicht zu, wartet), ist „nicht nötig“ – auch wenn ein Wert im Stand steht', () => {
    expect(wert({ ...mit('2030-01-01'), zaehlt: false })).toBe('nichtNoetig');
    expect(wert(eingabe({ art: 'nichtLesbar' }, { zaehlt: false }))).toBe('nichtNoetig');
  });

  it('nicht lesbar ist eigener Wert – nicht „fehlt“ und nicht leer', () => {
    expect(wert(eingabe({ art: 'nichtLesbar' }))).toBe('nichtLesbar');
  });

  it('gelesen, aber die Person steht nicht darin → „noch nicht angefordert“', () => {
    expect(wert(eingabe({ art: 'gelesen', personen: new Map() }))).toBe('nochNicht');
    expect(wert(eingabe({ art: 'gelesen', personen: new Map([[PID + 1, 'rot']]) }))).toBe(
      'nochNicht',
    );
  });

  it('„offen“ und „rot“ im Stand → „fehlt“', () => {
    expect(wert(mit('offen'))).toBe('fehlt');
    expect(wert(mit('rot'))).toBe('fehlt');
  });
});

describe('ampelFuer – der Tag „gültig bis“ gegen den letzten Tag', () => {
  it('endet genau am letzten Tag → grün (noch gültig)', () => {
    expect(ampelFuer(mit(ENDE))).toEqual({ wert: 'gueltig', bis: ENDE });
  });
  it('endet einen Tag davor → blau „läuft vor Ende ab“', () => {
    const tag = plusTage(ENDE, -1);
    expect(ampelFuer(mit(tag))).toEqual({ wert: 'laeuftAb', bis: tag });
  });
  it('endet einen Tag danach → grün', () => {
    expect(wert(mit(plusTage(ENDE, 1)))).toBe('gueltig');
  });
  it('endet heute (mitten in der Veranstaltung) → blau; gestern → abgelaufen (rot)', () => {
    expect(wert(mit(HEUTE))).toBe('laeuftAb');
    expect(ampelFuer(mit(plusTage(HEUTE, -1)))).toEqual({
      wert: 'abgelaufen',
      bis: plusTage(HEUTE, -1),
    });
  });
  it('ohne Ende (kein Termin) gilt heute als Stichtag: heute noch grün, gestern abgelaufen', () => {
    const ohne = (tag: string) => wert({ ...mit(tag), letzterTag: null });
    expect(ohne(HEUTE)).toBe('gueltig');
    expect(ohne(plusTage(HEUTE, 1))).toBe('gueltig');
    expect(ohne(plusTage(HEUTE, -1))).toBe('abgelaufen');
  });
});

describe('ampelFuer aus den Erzeugern (kein Ergebnis, kein Ausstellungsdatum)', () => {
  const angaben = (p: Partial<PersonAngaben>): PersonAngaben => ({
    eingesehenAm: null,
    ausgestelltAm: null,
    ergebnis: null,
    aufgabe: null,
    profil: null,
    ...p,
  });
  const ampel = (p: Partial<PersonAngaben>) =>
    ampelFuer(mit(standFuerLeitung(personStand(angaben(p), E, HEUTE).stand)));

  it('Rücksprache sieht die Leitung als „fehlt“ – auch mit weit gültigem Datum, nie als „gültig“', () => {
    const r = ampel({ eingesehenAm: HEUTE, ausgestelltAm: HEUTE, ergebnis: 'eintrag' });
    expect(r).toEqual({ wert: 'fehlt' });
    expect(JSON.stringify(r)).not.toContain('2029');
  });
  it('gültig bis weit nach dem Ende → grün; endet vor dem Ende → blau; schon vorbei → abgelaufen', () => {
    expect(ampel({ eingesehenAm: HEUTE, ausgestelltAm: HEUTE, ergebnis: 'ohne' }).wert).toBe(
      'gueltig',
    );
    // Zeugnis vor fast drei Jahren ausgestellt: gültig bis ein paar Tage nach heute, aber vor dem Ende.
    const laeuft = ampel({
      eingesehenAm: HEUTE,
      ausgestelltAm: '2023-11-25',
      ergebnis: 'ohne',
    });
    expect(laeuft.wert).toBe('laeuftAb');
    expect(ampel({ eingesehenAm: HEUTE, ausgestelltAm: '2020-01-01', ergebnis: 'ohne' }).wert).toBe(
      'abgelaufen',
    );
  });
  it('angefordert, keine Aufgabe und unvollständig → „fehlt“ (Entwurf: offen/rot im Stand)', () => {
    expect(ampel({ aufgabe: { seit: HEUTE } }).wert).toBe('fehlt');
    expect(ampel({}).wert).toBe('fehlt');
    expect(ampel({ eingesehenAm: HEUTE }).wert).toBe('fehlt'); // unvollständig: Datum fehlt
  });
});

describe('Texte, Farben, Reihenfolge', () => {
  it('„gültig bis MM/JJJJ“ in der Zelle, sonst der Text', () => {
    expect(monatJahr('2029-11-20')).toBe('11/2029');
    expect(ampelZelle({ wert: 'gueltig', bis: '2029-11-20' })).toBe('gültig bis 11/2029');
    expect(ampelZelle({ wert: 'fehlt' })).toBe('fehlt');
    expect(ampelZelle({ wert: 'laeuftAb', bis: '2026-12-01' })).toBe('läuft vor Ende ab');
  });
  it('R9: „läuft ab“ ist blau, nie gelb; Rot nur für „fehlt“ und „abgelaufen“; „nicht nötig“ ohne Etikett', () => {
    const ton = (w: AmpelWert) => ampelTon(w);
    expect(ton('gueltig')).toBe('gruen');
    expect(ton('laeuftAb')).toBe('blau');
    expect(ton('fehlt')).toBe('rot');
    expect(ton('abgelaufen')).toBe('rot');
    expect(ton('nochNicht')).toBe('neutral');
    expect(ton('nichtLesbar')).toBe('neutral');
    expect(ton('bedingung')).toBe('neutral');
    expect(ton('nichtNoetig')).toBeNull();
  });
  it('Rang: was Aufmerksamkeit braucht zuerst; jeder Wert hat einen Rang und einen Text', () => {
    const alle = Object.keys(AMPEL_TEXT) as AmpelWert[];
    expect(new Set(alle.map(ampelRang)).size).toBe(alle.length);
    expect(alle.every((w) => ampelRang(w) >= 0)).toBe(true);
    expect(ampelRang('fehlt')).toBeLessThan(ampelRang('laeuftAb'));
    expect(ampelRang('laeuftAb')).toBeLessThan(ampelRang('gueltig'));
    expect(ampelRang('gueltig')).toBeLessThan(ampelRang('nichtNoetig'));
  });
  it('„ohne gültigen Nachweis“ zählt rot, grau (noch nicht angefordert) und blau – nicht gültig, nicht nötig, nicht „unbekannt“', () => {
    expect([...OHNE_GUELTIGEN].sort()).toEqual(['abgelaufen', 'fehlt', 'laeuftAb', 'nochNicht']);
  });
});

describe('Spalte und Lage', () => {
  const lage: NachweisLage = {
    arten: new Map([
      [
        61,
        {
          name: 'Führungszeugnis',
          bedingungKaputt: false,
          nichtLesbar: false,
          ampel: new Map([
            [1, { wert: 'gueltig' as const, bis: '2029-11-20' }],
            [2, { wert: 'fehlt' as const }],
            [3, { wert: 'nichtNoetig' as const }],
          ]),
        },
      ],
    ]),
  };
  it('Schlüssel „nachweis:<Nummer>“ hin und zurück; fremde Schlüssel sind keine Nachweis-Spalte', () => {
    expect(nachweisSpaltenKey(61)).toBe('nachweis:61');
    expect(nachweisArtVon('nachweis:61')).toBe(61);
    expect(nachweisArtVon('nachweis:')).toBeNull();
    expect(nachweisArtVon('nachweis:x')).toBeNull();
    expect(nachweisArtVon('nachweis:0')).toBeNull();
    expect(nachweisArtVon('frage:foto')).toBeNull();
  });
  it('Wert einer Person; ohne Lage oder unbekannte Person: null (steht noch nicht fest)', () => {
    expect(ampelDerPerson(lage, 'nachweis:61', 2)).toEqual({ wert: 'fehlt' });
    expect(ampelDerPerson(lage, 'nachweis:61', 99)).toBeNull();
    expect(ampelDerPerson(undefined, 'nachweis:61', 2)).toBeNull();
    expect(ampelDerPerson(lage, 'nachweis:62', 2)).toBeNull();
    expect(ampelDerPerson(lage, 'frage:foto', 2)).toBeNull();
  });
  it('Anmeldung = schlechtester Wert ihrer Personen; „nicht nötig“ nur, wenn alle so sind', () => {
    expect(ampelDerAnmeldung(lage, 'nachweis:61', [1, 2, 3])).toEqual({ wert: 'fehlt' });
    expect(ampelDerAnmeldung(lage, 'nachweis:61', [3, 1])?.wert).toBe('gueltig');
    expect(ampelDerAnmeldung(lage, 'nachweis:61', [3])?.wert).toBe('nichtNoetig');
    expect(ampelDerAnmeldung(lage, 'nachweis:61', [99])).toBeNull();
  });
});
