import { describe, expect, it } from 'vitest';
import { ableiten, BLOCK, textAus, type Block } from './dokument';
import {
  alsFormular,
  ausFormular,
  formularPruefen,
  istVorlage,
  STANDARD_VORLAGEN,
  startDokument,
  vorlageKurz,
  wieLetztesMal,
  type VorlagenFormular,
} from './vorlagen';

let n = 0;
const neueId = (): string => `id${++n}`;

describe('STANDARD_VORLAGEN', () => {
  it('haben eindeutige IDs und Namen', () => {
    expect(new Set(STANDARD_VORLAGEN.map((v) => v.id)).size).toBe(STANDARD_VORLAGEN.length);
    expect(new Set(STANDARD_VORLAGEN.map((v) => v.name)).size).toBe(STANDARD_VORLAGEN.length);
  });
  it('beginnen jeweils mit einem Tagesordnungspunkt', () => {
    for (const v of STANDARD_VORLAGEN)
      expect(ableiten(v.bloecke).punkte[0]?.blockId).toBe(v.bloecke[0].id);
  });
});

describe('startDokument', () => {
  it('gibt jedem Block eine neue ID und lässt die Vorlage unverändert', () => {
    const v = STANDARD_VORLAGEN[0];
    const vorher = JSON.stringify(v);
    const dok = startDokument(v, neueId);
    expect(dok.map((b) => b.id).some((id) => v.bloecke.some((b) => b.id === id))).toBe(false);
    expect(JSON.stringify(v)).toBe(vorher);
  });
  it('legt feste Aufgaben ohne Verweis an – gespeichert wird erst in der Sitzung', () => {
    const dok = startDokument(STANDARD_VORLAGEN[2], neueId);
    expect(ableiten(dok).aufgaben.map((a) => a.aufgabe)).toEqual([null]);
  });
});

describe('wieLetztesMal', () => {
  const letztes: Block[] = [
    {
      id: 'p1',
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Finanzen', styles: { bold: true } }],
      children: [],
    },
    {
      id: 'x',
      type: 'paragraph',
      content: [{ type: 'text', text: 'Notiz der letzten Sitzung', styles: {} }],
      children: [],
    },
    {
      id: 'b',
      type: BLOCK.beschluss,
      content: [{ type: 'text', text: 'Alter Beschluss', styles: {} }],
      children: [],
    },
    {
      id: 'p2',
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Offene To-Dos', styles: {} }],
      children: [],
    },
    { id: 'v', type: BLOCK.verweis, props: { art: 'offene-aufgaben' }, children: [] },
    {
      id: 'h2',
      type: 'heading',
      props: { level: 2 },
      content: [{ type: 'text', text: 'Zwischen', styles: {} }],
      children: [],
    },
  ];

  it('übernimmt Punkte und Verweise, nichts sonst', () => {
    const dok = wieLetztesMal(letztes, neueId);
    expect(dok.map((b) => [b.type, textAus(b.content)])).toEqual([
      ['heading', 'Finanzen'],
      ['heading', 'Offene To-Dos'],
      [BLOCK.verweis, ''],
    ]);
    const a = ableiten(dok);
    expect(a.beschluesse).toEqual([]);
    expect(dok.some((b) => letztes.some((l) => l.id === b.id))).toBe(false);
  });
});

/** Ein Dokument ohne IDs – zum Vergleich, ob die Umwandlung etwas verliert. */
const ohneIds = (bloecke: readonly Block[]): unknown =>
  bloecke.map(({ id: _id, children, ...rest }) => ({ ...rest, children: ohneIds(children ?? []) }));

describe('Vorlage ↔ Formular (S2-3)', () => {
  it('Standard-Vorlagen: hin und zurück ohne Verlust (bis auf neue IDs)', () => {
    for (const v of STANDARD_VORLAGEN) {
      const zurueck = ausFormular(alsFormular(v), v.id, neueId);
      expect(ohneIds(zurueck.bloecke)).toEqual(ohneIds(v.bloecke));
      expect(zurueck.name).toBe(v.name);
      expect(zurueck.id).toBe(v.id);
    }
  });

  it('liest Punkte, Text, feste Punkte und Aufgaben wie im Entwurf', () => {
    const f = alsFormular(STANDARD_VORLAGEN[0]);
    expect(f.punkte.map((p) => [p.titel, p.verweis, p.text])).toEqual([
      ['Andacht & Gebet', null, ''],
      ['Protokoll der letzten Sitzung', 'letztes-protokoll', ''],
      ['Offene To-Dos', 'offene-aufgaben', ''],
      ['Termine & Gemeindeleben', null, 'Was steht in den nächsten vier Wochen an?'],
      ['Verschiedenes', null, ''],
    ]);
    expect(f.aufgaben).toEqual(['Raum für die nächste Sitzung prüfen']);
  });

  it('mehrzeiliger Text = ein Absatz je Zeile; leere Punkte, Zeilen und Aufgaben fallen weg; getrimmt', () => {
    const f: VorlagenFormular = {
      name: '  Jahresplanung ',
      punkte: [
        { titel: ' Rückblick ', text: 'Zeile eins\n\n  Zeile zwei ', verweis: null },
        { titel: '   ', text: 'geht verloren', verweis: null },
        { titel: 'Offene To-Dos', text: '', verweis: 'offene-aufgaben' },
      ],
      aufgaben: [' Saal buchen ', ''],
    };
    const v = ausFormular(f, 'neu', neueId);
    expect(v.name).toBe('Jahresplanung');
    expect(v.bloecke.map((b) => [b.type, textAus(b.content), b.props?.art ?? null])).toEqual([
      ['heading', 'Rückblick', null],
      ['paragraph', 'Zeile eins', null],
      ['paragraph', 'Zeile zwei', null],
      ['heading', 'Offene To-Dos', null],
      [BLOCK.verweis, '', 'offene-aufgaben'],
      [BLOCK.aufgabe, 'Saal buchen', null],
    ]);
    expect(alsFormular(v).punkte[0].text).toBe('Zeile eins\nZeile zwei');
    // Eine feste Aufgabe ist ein Aufgaben-Block der Ableitung – ohne gespeichertes To-Do
    expect(ableiten(v.bloecke).aufgaben).toEqual([
      expect.objectContaining({ text: 'Saal buchen', aufgabe: null }),
    ]);
  });

  it('formularPruefen: Name und mindestens ein Punkt mit Titel', () => {
    const gut = alsFormular(STANDARD_VORLAGEN[1]);
    expect(formularPruefen(gut)).toEqual([]);
    expect(formularPruefen({ ...gut, name: ' ' })).toEqual(['Die Vorlage braucht einen Namen.']);
    expect(formularPruefen({ ...gut, punkte: [{ titel: '', text: 'x', verweis: null }] })).toEqual([
      'Die Vorlage braucht mindestens einen Tagesordnungspunkt.',
    ]);
  });

  it('istVorlage und vorlageKurz', () => {
    expect(istVorlage(STANDARD_VORLAGEN[0])).toBe(true);
    expect(istVorlage({ ...STANDARD_VORLAGEN[0], art: 'einstellung' })).toBe(false);
    expect(istVorlage(null)).toBe(false);
    expect(vorlageKurz(STANDARD_VORLAGEN[0])).toBe('5 Punkte · 1 feste Aufgabe');
    expect(vorlageKurz(STANDARD_VORLAGEN[1])).toBe('4 Punkte');
  });
});
