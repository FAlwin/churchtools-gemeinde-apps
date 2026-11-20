import { describe, expect, it } from 'vitest';
import { plusTage } from '../ct/datum';
import type { NachweisEinstellungen } from './nachweise';
import { antragVorgabe } from './nachweisAntrag';
import {
  FEHLT_NACH_TAGEN,
  LAEUFT_AB_TAGE,
  aufmerksamkeitEtiketten,
  aufmerksamkeitZaehlen,
  brauchenDichText,
  brauchtAufmerksamkeit,
  nachStand,
  nachweisGueltigBis,
  personStand,
  plusJahre,
  standRang,
  standText,
  standTon,
  tagAus,
  zaehlText,
  type NachweisStand,
  type PersonAngaben,
} from './nachweisStand';

/**
 * Der Stand je Person (N2a). Die Tage kommen aus den Grenzen im Quelltext (`FEHLT_NACH_TAGEN`, `LAEUFT_AB_TAGE`) und
 * werden mit `plusTage` gerechnet – nicht als abgeschriebene Datumsliterale –, die Grenzfälle (28/29, 56/57, heute, gestern)
 * stehen aber ausdrücklich da. „heute“ ist ein Parameter; keine Uhr im Test.
 */
const HEUTE = '2026-11-20';
const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Betreff',
  text: 'Text [Vorname]',
};
const MIT_ANTRAG: NachweisEinstellungen = { ...E, antrag: antragVorgabe('ECG Donrath') };
const OHNE_ANTRAG: NachweisEinstellungen = { ...E, antrag: { ...antragVorgabe(null), an: false } };
const VOLL: NonNullable<PersonAngaben['profil']> = {
  geburtstag: '1990-01-01',
  strasse: 'Hauptstr. 4',
  plz: '53797',
  ort: 'Lohmar',
};

const person = (p: Partial<PersonAngaben> = {}): PersonAngaben => ({
  eingesehenAm: null,
  ausgestelltAm: null,
  ergebnis: null,
  aufgabe: null,
  profil: null,
  ...p,
});
/** Eine Person, die eingesehen hat; „Gültig bis“ liegt `tage` Tage nach heute (ab Ausstellung, 3 Jahre). */
const mitAblauf = (tage: number, p: Partial<PersonAngaben> = {}) => {
  const bis = plusTage(HEUTE, tage);
  return person({ eingesehenAm: '2026-01-01', ausgestelltAm: plusJahre(bis, -3), ...p });
};
const stand = (p: PersonAngaben, e: NachweisEinstellungen | null = E) =>
  personStand(p, e, HEUTE).stand;

describe('Stand je Person: jede Zeile der Tabelle', () => {
  it('angefordert: offene Aufgabe, höchstens 28 Tage alt (Grenze 28 = noch angefordert)', () => {
    const seit = plusTage(HEUTE, -FEHLT_NACH_TAGEN);
    expect(stand(person({ aufgabe: { seit } }))).toEqual({ art: 'angefordert', seit });
    expect(stand(person({ aufgabe: { seit: HEUTE } })).art).toBe('angefordert');
  });

  it('fehlt: offene Aufgabe, älter als 28 Tage (Grenze 29 = fehlt) – mit der Zahl der Wochen', () => {
    const s29 = plusTage(HEUTE, -(FEHLT_NACH_TAGEN + 1));
    expect(stand(person({ aufgabe: { seit: s29 } }))).toEqual({
      art: 'fehlt',
      seit: s29,
      wochen: 4,
    });
    const s35 = plusTage(HEUTE, -35);
    expect(stand(person({ aufgabe: { seit: s35 } }))).toMatchObject({ art: 'fehlt', wochen: 5 });
  });

  it('offene Aufgabe ohne bekannten Tag: angefordert ohne Datum (kein „fehlt“ aus dem Nichts)', () => {
    expect(stand(person({ aufgabe: { seit: null } }))).toEqual({ art: 'angefordert', seit: null });
  });

  it('noch keine Aufgabe: weder Einsicht noch offene Aufgabe', () => {
    expect(stand(person())).toEqual({ art: 'keineAufgabe' });
  });

  it('gültig: Ablauf mehr als 56 Tage nach heute (57 = gültig, 56 = läuft ab)', () => {
    expect(stand(mitAblauf(LAEUFT_AB_TAGE + 1)).art).toBe('gueltig');
    expect(stand(mitAblauf(LAEUFT_AB_TAGE)).art).toBe('laeuftAb');
  });

  it('läuft ab: Ablauf in 0–56 Tagen – auch HEUTE (der Tag selbst gilt noch)', () => {
    const bis = plusTage(HEUTE, 0);
    expect(stand(mitAblauf(0))).toEqual({ art: 'laeuftAb', bis });
    expect(stand(mitAblauf(1)).art).toBe('laeuftAb');
  });

  it('abgelaufen: Ablauf vor heute (gestern = abgelaufen)', () => {
    expect(stand(mitAblauf(-1))).toEqual({ art: 'abgelaufen', bis: plusTage(HEUTE, -1) });
  });

  it('Rücksprache schlägt jedes Datum – gültig, abgelaufen, und auch ohne Einsicht', () => {
    expect(stand(mitAblauf(400, { ergebnis: 'eintrag' })).art).toBe('ruecksprache');
    expect(stand(mitAblauf(-400, { ergebnis: 'eintrag' })).art).toBe('ruecksprache');
    expect(stand(person({ ergebnis: 'eintrag', aufgabe: { seit: HEUTE } })).art).toBe(
      'ruecksprache',
    );
    // „Keine Eintragung“ ändert nichts.
    expect(stand(mitAblauf(400, { ergebnis: 'ohne' })).art).toBe('gueltig');
  });

  it('eine offene Aufgabe („Erneut einsehen“) neben gültiger Einsicht: es zählt die Gültigkeit', () => {
    expect(stand(mitAblauf(400, { aufgabe: { seit: plusTage(HEUTE, -100) } })).art).toBe('gueltig');
  });

  it('eingesehen, aber das Datum für „Gültig bis“ fehlt: „Angaben unvollständig“ (kein Alarm)', () => {
    expect(stand(person({ eingesehenAm: '2026-01-01', ausgestelltAm: null }))).toEqual({
      art: 'unvollstaendig',
    });
    // Art nicht fertig eingerichtet: keine Gültigkeit bekannt.
    expect(stand(mitAblauf(400), null).art).toBe('unvollstaendig');
  });
});

describe('„Gültig bis“', () => {
  const d = { eingesehenAm: '2026-05-02', ausgestelltAm: '2026-04-14' };

  it('ab Ausstellung rechnet vom Zeugnis, ab Einsicht vom Tag der Einsicht', () => {
    expect(nachweisGueltigBis({ gueltigJahre: 3, ab: 'ausstellung' }, d)).toBe('2029-04-14');
    expect(nachweisGueltigBis({ gueltigJahre: 3, ab: 'einsicht' }, d)).toBe('2029-05-02');
  });

  it('fehlt das nötige Datum: null – das andere hilft nicht', () => {
    expect(
      nachweisGueltigBis({ gueltigJahre: 3, ab: 'ausstellung' }, { ...d, ausgestelltAm: null }),
    ).toBeNull();
    expect(
      nachweisGueltigBis({ gueltigJahre: 3, ab: 'einsicht' }, { ...d, eingesehenAm: null }),
    ).toBeNull();
  });

  it('der 29.02. wird in einem Jahr ohne Schalttag zum 28.02.; sonst bleibt er', () => {
    expect(plusJahre('2024-02-29', 3)).toBe('2027-02-28');
    expect(plusJahre('2024-02-29', 4)).toBe('2028-02-29');
    expect(plusJahre('2026-03-01', 1)).toBe('2027-03-01');
  });

  it('der Stand nutzt dieselbe Funktion: ab: einsicht gegen ab: ausstellung ergibt verschieden lange Gültigkeit', () => {
    // Zeugnis vor 3 Jahren plus 1 Monat ausgestellt, heute eingesehen: ab Ausstellung läuft es bald ab, ab Einsicht nicht.
    const p = person({ eingesehenAm: HEUTE, ausgestelltAm: plusJahre(plusTage(HEUTE, 10), -3) });
    expect(stand(p, { ...E, ab: 'ausstellung' }).art).toBe('laeuftAb');
    expect(stand(p, { ...E, ab: 'einsicht' }).art).toBe('gueltig');
  });

  it('Datum aus ChurchTools: nur ein Tag zählt (Uhrzeit abschneiden, Unsinn → null)', () => {
    expect(tagAus('2026-11-03')).toBe('2026-11-03');
    expect(tagAus('2026-11-03T10:00:00Z')).toBe('2026-11-03');
    expect(tagAus('')).toBeNull();
    expect(tagAus('03.11.2026')).toBeNull();
    expect(tagAus(null)).toBeNull();
  });
});

describe('Antrag unvollständig', () => {
  const luecke = (p: Partial<PersonAngaben>, e: NachweisEinstellungen | null = MIT_ANTRAG) =>
    personStand(person(p), e, HEUTE).luecke;
  const fehlendes = (ueber: Partial<typeof VOLL>) => ({ profil: { ...VOLL, ...ueber } });
  const ANGEFORDERT = { aufgabe: { seit: HEUTE } };

  it('Geburtsdatum und Adresse / nur Adresse / nur Geburtsdatum – die drei Texte', () => {
    expect(luecke({ ...ANGEFORDERT, ...fehlendes({ geburtstag: null, strasse: null }) })).toBe(
      'Antrag unvollständig: Geburtsdatum und Adresse fehlen',
    );
    expect(luecke({ ...ANGEFORDERT, ...fehlendes({ ort: null }) })).toBe(
      'Antrag unvollständig: Adresse fehlt',
    );
    expect(luecke({ ...ANGEFORDERT, ...fehlendes({ geburtstag: null }) })).toBe(
      'Antrag unvollständig: Geburtsdatum fehlt',
    );
  });

  it('die Adresse fehlt, wenn Straße, PLZ ODER Ort leer ist (auch nur Leerzeichen)', () => {
    for (const teil of ['strasse', 'plz', 'ort'] as const)
      expect(luecke({ ...ANGEFORDERT, ...fehlendes({ [teil]: '  ' }) })).toBe(
        'Antrag unvollständig: Adresse fehlt',
      );
  });

  it('alles da: kein Hinweis', () => {
    expect(luecke({ ...ANGEFORDERT, profil: VOLL })).toBeNull();
  });

  it('nur bei Arten mit Antrag (Antrag aus oder ganz fehlend: kein Hinweis)', () => {
    const leer = { ...ANGEFORDERT, ...fehlendes({ geburtstag: null }) };
    expect(luecke(leer, OHNE_ANTRAG)).toBeNull();
    expect(luecke(leer, E)).toBeNull();
    expect(luecke(leer, null)).toBeNull();
  });

  it('nicht gelesen (profil null, z. B. kein Recht): kein Hinweis statt falschem Alarm', () => {
    expect(luecke({ ...ANGEFORDERT, profil: null })).toBeNull();
  });

  it('nur solange die Person einen Antrag braucht: angefordert, fehlt, läuft ab, abgelaufen, noch keine Aufgabe', () => {
    const leer = fehlendes({ geburtstag: null });
    expect(luecke({ aufgabe: { seit: HEUTE }, ...leer })).not.toBeNull(); // angefordert
    expect(luecke({ aufgabe: { seit: plusTage(HEUTE, -40) }, ...leer })).not.toBeNull(); // fehlt
    expect(luecke({ ...mitAblauf(10), ...leer })).not.toBeNull(); // läuft ab
    expect(luecke({ ...mitAblauf(-10), ...leer })).not.toBeNull(); // abgelaufen
    expect(luecke({ ...leer })).not.toBeNull(); // noch keine Aufgabe
    // gültig, Rücksprache, Angaben unvollständig: kein Hinweis
    expect(luecke({ ...mitAblauf(400), ...leer })).toBeNull();
    expect(luecke({ ...mitAblauf(10, { ergebnis: 'eintrag' }), ...leer })).toBeNull();
    expect(luecke({ eingesehenAm: '2026-01-01', ...leer })).toBeNull();
  });
});

describe('Text und Farbe je Stand', () => {
  const alle: NachweisStand[] = [
    { art: 'angefordert', seit: '2026-11-19' },
    { art: 'fehlt', seit: '2026-10-16', wochen: 5 },
    { art: 'gueltig', bis: '2029-04-14' },
    { art: 'laeuftAb', bis: '2026-12-28' },
    { art: 'abgelaufen', bis: '2026-10-02' },
    { art: 'ruecksprache' },
    { art: 'keineAufgabe' },
    { art: 'unvollstaendig' },
  ];

  it('Text', () => {
    expect(alle.map(standText)).toEqual([
      'angefordert am 19.11.',
      'fehlt seit 5 Wochen',
      'gültig',
      'läuft ab am 28.12.',
      'abgelaufen seit 02.10.',
      'Rücksprache',
      'noch keine Aufgabe',
      'Angaben unvollständig',
    ]);
    expect(standText({ art: 'angefordert', seit: null })).toBe('angefordert');
  });

  it('Farbe: läuft ab ist BLAU, fehlt/abgelaufen/Rücksprache rot, gültig grün, der Rest grau', () => {
    expect(alle.map(standTon)).toEqual([
      'blau',
      'rot',
      'gruen',
      'blau',
      'rot',
      'rot',
      'neutral',
      'neutral',
    ]);
  });

  it('Aufmerksamkeit: fehlt, läuft ab, abgelaufen, Rücksprache – sonst nicht', () => {
    expect(alle.filter(brauchtAufmerksamkeit).map((s) => s.art)).toEqual([
      'fehlt',
      'laeuftAb',
      'abgelaufen',
      'ruecksprache',
    ]);
  });

  it('Reihenfolge: rot vor blau vor angefordert vor gültig, innerhalb nach Name', () => {
    const l = [
      { name: 'Zoe', stand: alle[2] },
      { name: 'Yvi', stand: alle[0] },
      { name: 'Xaver', stand: alle[3] },
      { name: 'Wiebke', stand: alle[4] },
      { name: 'Anna', stand: alle[1] },
      { name: 'Ben', stand: alle[6] },
    ];
    expect(nachStand(l).map((x) => x.name)).toEqual([
      'Anna',
      'Wiebke',
      'Xaver',
      'Ben',
      'Yvi',
      'Zoe',
    ]);
    expect(standRang(alle[5])).toBe(0);
  });
});

describe('Zählung und Texte für die Startseite', () => {
  const STAENDE: Record<NachweisStand['art'], NachweisStand> = {
    angefordert: { art: 'angefordert', seit: null },
    fehlt: { art: 'fehlt', seit: '2026-10-01', wochen: 7 },
    gueltig: { art: 'gueltig', bis: '2030-01-01' },
    laeuftAb: { art: 'laeuftAb', bis: '2026-12-01' },
    abgelaufen: { art: 'abgelaufen', bis: '2026-10-01' },
    ruecksprache: { art: 'ruecksprache' },
    keineAufgabe: { art: 'keineAufgabe' },
    unvollstaendig: { art: 'unvollstaendig' },
  };
  const s = (art: NachweisStand['art']) => STAENDE[art];

  it('„7 Personen: 2 gültig · 1 angefordert · 4 brauchen dich“', () => {
    const l = [
      s('gueltig'),
      s('gueltig'),
      s('angefordert'),
      s('fehlt'),
      s('laeuftAb'),
      s('abgelaufen'),
      s('ruecksprache'),
    ];
    expect(zaehlText(l)).toBe('7 Personen: 2 gültig · 1 angefordert · 4 brauchen dich');
  });

  it('angefordert zählt auch „noch keine Aufgabe“ und „Angaben unvollständig“', () => {
    expect(zaehlText([s('angefordert'), s('keineAufgabe'), s('unvollstaendig')])).toBe(
      '3 Personen: 3 angefordert',
    );
  });

  it('Teile mit 0 fehlen; Einzahl; alle gültig; niemand', () => {
    expect(zaehlText([s('gueltig'), s('abgelaufen')])).toBe(
      '2 Personen: 1 gültig · 1 braucht dich',
    );
    expect(zaehlText([s('gueltig'), s('gueltig')])).toBe('2 Personen: alle gültig');
    expect(zaehlText([s('gueltig')])).toBe('1 Person: alle gültig');
    expect(zaehlText([])).toBe('Noch niemand eingetragen');
  });

  it('Etiketten: Einzahl/Mehrzahl, nur Fälle mit Zahl, feste Reihenfolge und Farbe', () => {
    const z = aufmerksamkeitZaehlen([
      s('fehlt'),
      s('laeuftAb'),
      s('laeuftAb'),
      s('abgelaufen'),
      s('ruecksprache'),
      s('gueltig'),
    ]);
    expect(z).toEqual({ fehlt: 1, laeuftAb: 2, abgelaufen: 1, ruecksprache: 1, summe: 5 });
    expect(aufmerksamkeitEtiketten(z)).toEqual([
      { text: '1 fehlt seit über 4 Wochen', ton: 'rot' },
      { text: '2 laufen bald ab', ton: 'blau' },
      { text: '1 abgelaufen', ton: 'rot' },
      { text: '1 Rücksprache', ton: 'rot' },
    ]);
    expect(
      aufmerksamkeitEtiketten(aufmerksamkeitZaehlen([s('fehlt'), s('fehlt'), s('laeuftAb')])),
    ).toEqual([
      { text: '2 fehlen seit über 4 Wochen', ton: 'rot' },
      { text: '1 läuft bald ab', ton: 'blau' },
    ]);
    expect(aufmerksamkeitEtiketten(aufmerksamkeitZaehlen([s('gueltig')]))).toEqual([]);
  });

  it('„N Personen brauchen dich als Vertrauensperson.“ – Einzahl richtig', () => {
    expect(brauchenDichText(4)).toBe('4 Personen brauchen dich als Vertrauensperson.');
    expect(brauchenDichText(1)).toBe('1 Person braucht dich als Vertrauensperson.');
  });
});
