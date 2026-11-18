import { describe, expect, it } from 'vitest';
import type { Block } from './dokument';
import { abschnittEnde, abschnittVerschoben } from './abschnitte';

const h = (id: string, level = 1): Block => ({ id, type: 'heading', props: { level } });
const p = (id: string): Block => ({ id, type: 'paragraph' });

// Vorspann, dann drei Tagesordnungspunkte; Punkt B hat zwei Unterabschnitte (Überschrift 2), B1 eine Überschrift 3.
const DOK: Block[] = [
  p('vor'), //          0  Vorspann (gehört zu keinem Punkt)
  h('A'), //            1
  p('a1'), //           2
  h('B'), //            3
  p('b'), //            4
  h('B1', 2), //        5
  h('B1x', 3), //       6
  p('b1'), //           7
  h('B2', 2), //        8
  p('b2'), //           9
  h('C'), //           10
  p('c1'), //          11
];
const ids = (l: readonly Block[]) => l.map((b) => b.id);

describe('abschnittEnde', () => {
  it('Überschrift 1 bis zum nächsten Tagesordnungspunkt – mit allen Unterüberschriften', () => {
    expect(abschnittEnde(DOK, 1)).toBe(3);
    expect(abschnittEnde(DOK, 3)).toBe(10);
    expect(abschnittEnde(DOK, 10)).toBe(12);
  });
  it('Überschrift 2 bis zur nächsten 2 oder 1, Überschrift 3 bis zur nächsten 3, 2 oder 1', () => {
    expect(abschnittEnde(DOK, 5)).toBe(8);
    expect(abschnittEnde(DOK, 8)).toBe(10);
    expect(abschnittEnde(DOK, 6)).toBe(8);
  });
  it('anderer Block: nur er selbst', () => {
    expect(abschnittEnde(DOK, 4)).toBe(5);
  });
});

describe('abschnittVerschoben', () => {
  it('verschiebt den ganzen Abschnitt nach oben und nach unten', () => {
    expect(ids(abschnittVerschoben(DOK, 10, 1))).toEqual([
      'vor',
      'C',
      'c1',
      'A',
      'a1',
      'B',
      'b',
      'B1',
      'B1x',
      'b1',
      'B2',
      'b2',
    ]);
    expect(ids(abschnittVerschoben(DOK, 1, 12))).toEqual([
      'vor',
      'B',
      'b',
      'B1',
      'B1x',
      'b1',
      'B2',
      'b2',
      'C',
      'c1',
      'A',
      'a1',
    ]);
  });
  it('ein Abschnitt hinter den nächsten gleicher Stufe und wieder zurück: wie vorher', () => {
    const ende = abschnittEnde(DOK, abschnittEnde(DOK, 5));
    const runter = abschnittVerschoben(DOK, 5, ende);
    expect(ids(runter).slice(5, 10)).toEqual(['B2', 'b2', 'B1', 'B1x', 'b1']);
    const start = runter.findIndex((b) => b.id === 'B1');
    const zurueck = abschnittVerschoben(
      runter,
      start,
      runter.findIndex((b) => b.id === 'B2'),
    );
    expect(ids(zurueck)).toEqual(ids(DOK));
  });
  it('dieselben Blöcke, nichts geht verloren', () => {
    const neu = abschnittVerschoben(DOK, 3, 12);
    expect([...ids(neu)].sort()).toEqual([...ids(DOK)].sort());
  });
});

describe('Abschnitte mit Unterpunkten (K3b): der Rang zählt, nicht die gespeicherte Stufe', () => {
  // A · 1.1 (Stufe 2) · 1.1.1 (Stufe 4) · „Überschrift“ (Stufe 3) · 1.2 (Stufe 2)
  const D: Block[] = [h('A'), h('A1', 2), h('A1a', 4), h('Ue', 3), p('x'), h('A2', 2), p('y')];

  it('eine „Überschrift“ (Stufe 3) zerschneidet keinen Unterpunkt 1.1.1 (Stufe 4)', () => {
    expect(abschnittEnde(D, 2)).toBe(5);
  });

  it('Unterpunkt 1.1 nimmt 1.1.1 und die „Überschrift“ mit, endet vor 1.2', () => {
    expect(abschnittEnde(D, 1)).toBe(5);
  });
});
