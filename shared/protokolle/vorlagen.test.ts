import { describe, expect, it } from 'vitest';
import { ableiten, BLOCK, textAus, type Block } from './dokument';
import { STANDARD_VORLAGEN, startDokument, wieLetztesMal } from './vorlagen';

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
