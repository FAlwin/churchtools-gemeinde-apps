import { describe, expect, it } from 'vitest';
import { anmeldungAufbauen, type CtFormular } from './senden';
import { CT, antworten, einstellungen } from './senden.testdaten';
import {
  anmeldungenAus,
  antwortText,
  antwortZeilen,
  listeVon,
  listenSummeVon,
  mitgliederstandAus,
  type CtGruppenfeld,
  type ListenAnmeldung,
  type MitgliedRoh,
} from './liste';
import {
  listeAus,
  listeAusDaten,
  listeGelesen,
  listeGelesenText,
  listeKurz,
  listeLesbar,
  summeText,
  type ListeEinstellung,
} from './zeilenListe';
import { listeSummenName, type Antworten, type OeffentlicheEinstellungen } from './formular';
import {
  personSumme,
  personZeilen,
  personZellText,
  sortiert,
  spaltenKatalog,
  summe,
  summenSchluessel,
  vorgabeWahl,
  zellText,
  zellTitel,
} from './tabelle';
import { filterArt, filterBereinigt, gefilterteListe, passtAnmeldung } from './tabellenFilter';
import { teilnehmerTabelle } from './druckliste';
import { antwortenAus } from './antwortenAusListe';
import { mailBausteinNamen, mailFragen } from './mailAntworten';

/**
 * **F6c: Die Liste mit Zeilen in der Erweiterung** – Tabelle („n Einträge · …“ + Summen-Spalte), Fenster, Druckliste,
 * Filter, Regeln und Mails. Die Anmeldungen entstehen wie im echten Leben: `anmeldungAufbauen` (dieselbe Regel wie das
 * Formular) → Mitglieder → `anmeldungenAus`. Erwartet wird gegen die Erzeuger (`listeGelesen`, `listeKurz` …), nicht
 * gegen abgeschriebene Texte.
 */

const NR = 669;
const INV: ListeEinstellung = {
  spalten: [
    { id: 'a', name: 'Was', art: 'text' },
    { id: 'b', name: 'Anzahl', art: 'zahl' },
    { id: 'c', name: 'Wert', art: 'zahl', einheit: '€', summe: true },
  ],
  max: 10,
};
const MIT: ListeEinstellung = {
  spalten: [
    { id: 'a', name: 'Was', art: 'text' },
    { id: 'p', name: 'Preis', art: 'zahl', einheit: '€', summe: true },
  ],
  max: 5,
};

/** Kinder-Event mit „Was bringst du mit?“ (Kontakt, Kurzname „Inventar“) und „Eigene Sachen“ je Person. */
function e(): OeffentlicheEinstellungen {
  const x = einstellungen();
  x.formular.anmeldung.splice(2, 0, {
    id: 'inv',
    art: 'eigen',
    typ: 'liste',
    frage: 'Was bringst du mit?',
    kurz: 'Inventar',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: [],
    liste: structuredClone(INV),
  });
  x.formular.person.push({
    id: 'mit',
    art: 'eigen',
    typ: 'liste',
    frage: 'Eigene Sachen',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: [],
    liste: structuredClone(MIT),
  });
  x.ctFelder = {
    ...x.ctFelder,
    nr: NR,
    inv: 900,
    'inv.daten': 901,
    'inv.summe': 902,
    mit: 910,
    'mit.daten': 911,
    'mit.summe': 912,
  };
  return x;
}
const CT_LISTE: CtFormular = {
  ...CT,
  form: [
    ...CT.form,
    { id: NR, type: 'custom', name: 'Anmelde-Nr.' },
    { id: 900, type: 'custom', name: 'Was bringst du mit?' },
    { id: 901, type: 'custom', name: 'Was bringst du mit? (Daten)' },
    { id: 902, type: 'custom', name: 'Inventar – Summe Wert' },
    { id: 910, type: 'custom', name: 'Eigene Sachen' },
    { id: 911, type: 'custom', name: 'Eigene Sachen (Daten)' },
    { id: 912, type: 'custom', name: 'Eigene Sachen – Summe Preis' },
  ],
};
const FELDER = new Map<number, CtGruppenfeld>(
  CT_LISTE.form
    .filter((f) => f.type === 'custom')
    .map((f): [number, CtGruppenfeld] => [
      Number(f.id),
      { id: Number(f.id), name: f.name, options: f.options ?? undefined },
    ]),
);

const ZELT = { a: 'Zelt für 4 Personen', b: '1', c: '150' };
const KOCHER = { a: 'Kocher', b: '2', c: '1.234,5' };

/** Eine Anmeldung, wie das Formular sie schreibt – `inv` im Kontakt, `mit` je Person (nur Jonas). */
function mitglieder(
  nr: string,
  ersteId: number,
  inv: Record<string, string>[],
  ein = e(),
): MitgliedRoh[] {
  const a: Antworten = antworten();
  a.anmeldung.inv = { zeilen: inv };
  a.personen[0].mit = { zeilen: [{ a: 'Schlafsack', p: '30' }] };
  const { forms } = anmeldungAufbauen(ein, a, { option: 0, extras: [] }, '2026-10-17', CT_LISTE, {
    nr,
    mitPlatz: [true, true],
  });
  return forms.map((f, i) => ({
    personId: ersteId + i,
    person: { domainAttributes: { firstName: i ? 'Lena' : 'Jonas', lastName: 'Beispiel' } },
    groupTypeRoleId: 32,
    groupMemberStatus: 'active',
    memberStartDate: '2026-10-19',
    fields: f.form
      .filter((x) => x.type === 'custom')
      .map((x) => ({ id: Number(x.id), value: x.value })),
  }));
}

/** Ein Feld eines Mitglieds von Hand ändern (wie jemand in ChurchTools) – `null` leert es. */
function vonHand(m: MitgliedRoh[], id: number, wert: string | null): MitgliedRoh[] {
  return m.map((x, i) =>
    i === 0
      ? {
          ...x,
          fields: [
            ...(x.fields ?? []).filter((f) => f.id !== id),
            ...(wert === null ? [] : [{ id, value: wert }]),
          ],
        }
      : x,
  );
}

function liste(roh: MitgliedRoh[], ein = e()): ListenAnmeldung[] {
  return anmeldungenAus(
    ein,
    mitgliederstandAus(roh, [], FELDER, new Set(), new Map()),
    '2026-11-20',
  );
}
const ANMELDUNGEN = () =>
  liste([...mitglieder('AAAAAA', 10, [ZELT, {}, KOCHER]), ...mitglieder('BBBBBB', 20, [])]);
const nr = (l: ListenAnmeldung[], n: string) => l.find((x) => x.nr === n)!;
const inv = (x = e()) => x.formular.anmeldung.find((f) => f.id === 'inv')!;
const mit = (x = e()) => x.formular.person.find((f) => f.id === 'mit')!;
describe('listeGelesen – „(Daten)“ zum Ansehen, nachsichtig (E57)', () => {
  const gespeichert = () => nr(ANMELDUNGEN(), 'AAAAAA').einmal[901];

  it('liest die gespeicherten Einträge mit Summe – leere Zeilen kamen gar nicht erst an', () => {
    const g = listeGelesen(INV, gespeichert())!;
    expect(g.zeilen).toEqual([
      ['Zelt für 4 Personen', '1', '150'],
      ['Kocher', '2', '1.234,5'],
    ]);
    expect(g.summe).toBe(1384.5);
    expect(listeKurz(g)).toBe('2 Einträge · Zelt für 4 Personen, Kocher');
    // Derselbe Text wie in ChurchTools – solange niemand Spalten geändert hat.
    expect(listeGelesenText(g)).toBe(listeLesbar(INV, { zeilen: [ZELT, KOCHER] }));
    expect(listeGelesenText(g, { kopf: false })).not.toContain('Anzahl');
  });

  it('Spalten danach geändert (E48): neue bleibt leer, gelöschte fällt weg, Einträge und Summe bleiben', () => {
    const neu: ListeEinstellung = {
      spalten: [
        INV.spalten[0],
        INV.spalten[2],
        { id: 'z', name: 'Zustand', art: 'auswahl', antworten: ['neu', 'alt'] },
      ],
      max: 10,
    };
    const g = listeGelesen(neu, gespeichert())!;
    expect(g.zeilen).toEqual([
      ['Zelt für 4 Personen', '150', ''],
      ['Kocher', '1.234,5', ''],
    ]);
    expect(g.summe).toBe(1384.5);
    expect(listeKurz(g)).toBe('2 Einträge · Zelt für 4 Personen, Kocher');
    // Zum Vergleich: über `zeilenZustand` wären beide Zeilen „angefangen“ – und verschwunden.
    expect(listeLesbar(neu, listeAusDaten(neu, gespeichert())!)).toBe('');
  });

  it('Text-Spalte später zur Zahl gemacht: Text steht wie getippt da, nie „0“', () => {
    const l: ListeEinstellung = { spalten: [{ id: 'a', name: 'Was', art: 'zahl' }], max: 3 };
    const g = listeGelesen(l, JSON.stringify({ v: 1, s: ['a'], z: [['Zelt'], ['2,5']] }))!;
    expect(g.zeilen).toEqual([['Zelt'], ['2,5']]);
  });

  it('nichts zu zeigen → null (dann gilt der lesbare Text): leer, kaputt, falsche Fassung, keine heutige Spalte', () => {
    expect(listeGelesen(INV, undefined)).toBeNull();
    expect(listeGelesen(INV, '')).toBeNull();
    expect(listeGelesen(INV, '{kaputt')).toBeNull();
    expect(listeGelesen(INV, JSON.stringify({ v: 2, s: ['a'], z: [['x']] }))).toBeNull();
    expect(listeGelesen(INV, JSON.stringify({ v: 1, s: ['weg'], z: [['x']] }))).toBeNull();
  });

  it('Summe mit Einheit – eine Regel für Zelle, Summenzeile und Fenster', () => {
    expect(summeText(INV, 1384.5)).toBe('1.384,5 €');
    expect(summeText({ spalten: [INV.spalten[1]] }, 3)).toBe('3');
  });
});

describe('Tabelle – „n Einträge · …“ und Summen-Spalte', () => {
  it('Spalte unter dem Kurznamen, gleich dahinter die Summen-Spalte mit dem Namen aus ChurchTools', () => {
    const k = spaltenKatalog(e(), 'anmeldung');
    const i = k.findIndex((s) => s.schluessel === 'frage:inv');
    expect(k[i].titel).toBe('Inventar');
    expect(k[i + 1]).toEqual({
      schluessel: summenSchluessel(inv()),
      titel: listeSummenName(inv()),
      zahl: true,
    });
    // Ohne „Summe zeigen“ keine Summen-Spalte.
    const ohne = e();
    inv(ohne).liste!.spalten[2].summe = false;
    expect(spaltenKatalog(ohne, 'anmeldung').some((s) => s.schluessel === 'summe:inv')).toBe(false);
  });

  it('Zelle kurz, ganzer Text beim Darüberfahren, Summe mit Einheit; ohne Eintrag leer', () => {
    const l = ANMELDUNGEN();
    const a = nr(l, 'AAAAAA');
    const g = listeVon(inv(), a.einmal, e().ctFelder)!;
    expect(zellText(e(), 'frage:inv', a)).toBe(listeKurz(g));
    expect(zellTitel(e(), 'frage:inv', a, null)).toBe(listeGelesenText(g));
    expect(zellText(e(), 'summe:inv', a)).toBe(summeText(INV, g.summe!));
    expect(zellText(e(), 'frage:inv', nr(l, 'BBBBBB'))).toBe('');
    expect(zellText(e(), 'summe:inv', nr(l, 'BBBBBB'))).toBe('');
    expect(zellTitel(e(), 'frage:tel', a, null)).toBeNull();
  });

  it('Summenzeile: „n ausgefüllt“ unter der Liste, alles zusammen unter der Summe', () => {
    const l = ANMELDUNGEN();
    expect(summe(e(), 'frage:inv', l)).toEqual({ text: '1 ausgefüllt' });
    expect(summe(e(), 'summe:inv', l)).toEqual({ text: summeText(INV, 1384.5) });
  });

  it('sortiert nach der Summe als Zahl, ohne Wert hinten', () => {
    const l = liste([
      ...mitglieder('AAAAAA', 10, [KOCHER]),
      ...mitglieder('BBBBBB', 20, []),
      ...mitglieder('CCCCCC', 30, [ZELT]),
    ]);
    const s = sortiert(e(), l, { schluessel: 'summe:inv', absteigend: false });
    expect(s.map((x) => x.nr)).toEqual(['CCCCCC', 'AAAAAA', 'BBBBBB']);
  });

  it('kaputte oder fehlende „(Daten)“ → der lesbare Text aus ChurchTools, die Summe aus dem Zahl-Feld – nie leer', () => {
    const roh = mitglieder('AAAAAA', 10, [ZELT, KOCHER]);
    for (const daten of ['{kaputt', null]) {
      const a = liste(vonHand(roh, 901, daten))[0];
      expect(listeVon(inv(), a.einmal, e().ctFelder)).toBeNull();
      expect(zellText(e(), 'frage:inv', a)).toBe(a.einmal[900]);
      expect(antwortText(inv(), a.einmal, e().ctFelder)).toBe(a.einmal[900]);
      expect(zellText(e(), 'summe:inv', a)).toBe(summeText(INV, 1384.5));
    }
    // Lesbaren Text von Hand geändert – die Daten bleiben maßgeblich.
    const a = liste(vonHand(roh, 900, 'Zelt (von Hand)'))[0];
    expect(zellText(e(), 'frage:inv', a)).toBe('2 Einträge · Zelt für 4 Personen, Kocher');
  });

  it('„Summe zeigen“ erst nach den Anmeldungen eingeschaltet: Summe aus „(Daten)“, obwohl das Zahl-Feld leer ist (E58)', () => {
    const ohne = e();
    inv(ohne).liste!.spalten[2].summe = false;
    const roh = mitglieder('AAAAAA', 10, [ZELT, KOCHER], ohne);
    expect(roh[0].fields!.some((f) => f.id === 902)).toBe(false);
    const a = liste(roh)[0];
    expect(listenSummeVon(inv(), a.einmal, e().ctFelder)).toBe(1384.5);
    expect(zellText(e(), 'summe:inv', a)).toBe('1.384,5 €');
  });

  it('je Person: Liste der Person kurz, ihre Summe, Summenzeile über Personen; Summe der Anmeldung ausgeblendet', () => {
    const zeilen = personZeilen(ANMELDUNGEN());
    const jonas = zeilen[0];
    const g = listeVon(mit(), jonas.p.werte, e().ctFelder)!;
    expect(personZellText(e(), 'frage:mit', jonas)).toBe(listeKurz(g));
    expect(personZellText(e(), 'summe:mit', jonas)).toBe('30 €');
    expect(personZellText(e(), 'summe:mit', zeilen[1])).toBe('');
    expect(personZellText(e(), 'summe:inv', jonas)).toBe('1.384,5 €');
    // Jonas aus beiden Anmeldungen: 2 × 30 €.
    expect(personSumme(e(), 'summe:mit', zeilen)).toEqual({ text: '60 €' });
    // Die Summe der Anmeldung zählt jede Anmeldung einmal.
    expect(personSumme(e(), 'summe:inv', zeilen)).toEqual({
      text: '1.384,5 €',
      klein: 'einmal je Anmeldung',
    });
    expect(vorgabeWahl(e(), 'person').aus).toContain('summe:inv');
    expect(vorgabeWahl(e(), 'person').aus).not.toContain('summe:mit');
  });
});

describe('Fenster einer Anmeldung – kleine Tabelle', () => {
  it('die Liste aus „(Daten)“, kein Text daneben', () => {
    const a = nr(ANMELDUNGEN(), 'AAAAAA');
    const z = antwortZeilen(e().formular.anmeldung, a.einmal, e().ctFelder).find(
      (x) => x.frage === 'Was bringst du mit?',
    )!;
    expect(z.liste).toEqual(listeGelesen(INV, a.einmal[901]));
    expect(z.text).toBe('');
  });

  it('ohne lesbare Daten der Text aus ChurchTools (mehrzeilig)', () => {
    const a = liste(vonHand(mitglieder('AAAAAA', 10, [ZELT]), 901, '{kaputt'))[0];
    const z = antwortZeilen(e().formular.anmeldung, a.einmal, e().ctFelder).find(
      (x) => x.frage === 'Was bringst du mit?',
    )!;
    expect(z.liste).toBeUndefined();
    expect(z.text).toBe(a.einmal[900]);
  });
});

describe('Druckliste – lesbar wie in ChurchTools', () => {
  it('ganze Liste in der Zelle (Kopfzeile + eine Zeile je Eintrag), ohne Eintrag leer', () => {
    const l = ANMELDUNGEN();
    const t = teilnehmerTabelle(e(), l, { spalten: ['frage:inv'], sortierung: 'anmeldung' }, false);
    const g = listeVon(inv(), nr(l, 'AAAAAA').einmal, e().ctFelder)!;
    const zellen = t.zeilen.flatMap((z) => ('zellen' in z ? [z.zellen[1]] : []));
    expect(zellen).toEqual([listeGelesenText(g), listeGelesenText(g), '', '']);
  });
});

describe('Filter – Liste wie Text, Summe wie Zahl (E59)', () => {
  it('Art der Filter; gemerkte Summen-Filter einer Ansicht bleiben', () => {
    expect(filterArt(e(), 'frage:inv')).toBe('text');
    expect(filterArt(e(), 'summe:inv')).toBe('zahl');
    expect(filterArt(e(), 'summe:gibtsnicht')).toBeNull();
    const f = { spalte: 'summe:inv', ab: 100, bis: null };
    expect(filterBereinigt(e(), [f])).toEqual([f]);
  });

  it('ausgefüllt/leer, „enthält“ sucht in den Einträgen (nicht in den Spaltennamen), Summe ab/bis', () => {
    const l = ANMELDUNGEN();
    const passt = (f: Parameters<typeof passtAnmeldung>[1][number]) =>
      l.filter((x) => passtAnmeldung(e(), [f], x)).map((x) => x.nr);
    expect(passt({ spalte: 'frage:inv', text: 'ausgefuellt' })).toEqual(['AAAAAA']);
    expect(passt({ spalte: 'frage:inv', text: 'leer' })).toEqual(['BBBBBB']);
    expect(passt({ spalte: 'frage:inv', text: 'enthaelt', suche: 'kocher' })).toEqual(['AAAAAA']);
    expect(passt({ spalte: 'frage:inv', text: 'enthaelt', suche: 'Anzahl' })).toEqual([]);
    expect(passt({ spalte: 'summe:inv', ab: 1000, bis: null })).toEqual(['AAAAAA']);
    expect(passt({ spalte: 'summe:inv', ab: null, bis: 1000 })).toEqual([]);
  });

  it('Summe einer Liste je Person filtert je Person – Rundmail/Druckliste nehmen nur die passende', () => {
    const l = gefilterteListe(e(), ANMELDUNGEN(), [{ spalte: 'summe:mit', ab: 1, bis: null }]);
    expect(l.map((x) => x.personen.map((p) => p.vor))).toEqual([['Jonas'], ['Jonas']]);
  });
});

describe('Regeln (antwortenAus) – die Liste als Zeilen, nie als Text', () => {
  it('aus „(Daten)“; kaputt, aber Text da → beantwortet ohne Zeilen; nichts → nicht beantwortet', () => {
    const l = ANMELDUNGEN();
    expect(antwortenAus(e(), nr(l, 'AAAAAA')).anmeldung.inv).toEqual(
      listeAusDaten(INV, nr(l, 'AAAAAA').einmal[901]),
    );
    expect(listeAus(antwortenAus(e(), nr(l, 'AAAAAA')).anmeldung.inv).zeilen).toHaveLength(2);
    expect(antwortenAus(e(), nr(l, 'BBBBBB')).anmeldung.inv).toBeUndefined();
    const kaputt = liste(vonHand(mitglieder('CCCCCC', 30, [ZELT]), 901, '{kaputt'))[0];
    expect(antwortenAus(e(), kaputt).anmeldung.inv).toEqual({ zeilen: [] });
  });
});

describe('Mails – nur der lesbare Text, nie „(Daten)“', () => {
  it('„Antwort einfügen“ bietet die Liste unter ihrem Kurznamen an, „(Daten)“ und die Summe nicht', () => {
    expect(mailFragen(e()).map((f) => f.id)).toContain('inv');
    const namen = mailBausteinNamen(e());
    expect(namen).toContain('Inventar');
    expect(namen.some((n) => n.includes('(Daten)') || n.includes('Summe'))).toBe(false);
  });
});
