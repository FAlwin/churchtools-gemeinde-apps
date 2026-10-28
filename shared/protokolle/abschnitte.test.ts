import { describe, expect, it } from 'vitest';
import type { Block } from './dokument';
import { ablegeStelle, abschnittEnde, abschnittVerschoben, nachbarStelle } from './abschnitte';

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

describe('ablegeStelle – nur an Abschnittsgrenzen', () => {
  it('genau an einer Grenze: dort', () => {
    expect(ablegeStelle(DOK, 10, 1)).toBe(1); // C vor A
    expect(ablegeStelle(DOK, 1, 12)).toBe(12); // A ans Ende
  });
  it('mitten in einen anderen Punkt: an die nächste Grenze, bei gleichem Abstand nach oben', () => {
    expect(ablegeStelle(DOK, 10, 4)).toBe(3); // in B, nahe am Anfang → vor B
    expect(ablegeStelle(DOK, 1, 7)).toBe(10); // A in B hinein, näher am Ende → hinter B
    expect(ablegeStelle(DOK, 1, 11)).toBe(10); // A in C, gleich weit → nach oben
  });
  it('nie vor den Vorspann – Index 0 ist keine Grenze', () => {
    expect(ablegeStelle(DOK, 3, 0)).toBe(1);
  });
  it('auf sich selbst oder an die eigenen Ränder: bleibt (null)', () => {
    expect(ablegeStelle(DOK, 3, 3)).toBeNull();
    expect(ablegeStelle(DOK, 3, 6)).toBeNull();
    expect(ablegeStelle(DOK, 3, 10)).toBeNull();
    expect(ablegeStelle(DOK, 10, 9)).toBeNull(); // die nächste Grenze wäre der eigene Anfang
  });
  it('Überschrift 2 darf an Grenzen von 2 und 1 – nicht vor eine Überschrift 3', () => {
    expect(ablegeStelle(DOK, 8, 6)).toBe(5); // vor B1 (6 ist B1x, Stufe 3 – keine Grenze)
    expect(ablegeStelle(DOK, 8, 4)).toBe(3); // in B zwischen Überschrift und Text: gleich weit → nach oben, ans Ende von A
  });
  it('kein Abschnitt (keine Überschrift): null', () => {
    expect(ablegeStelle(DOK, 4, 0)).toBeNull();
  });
});

describe('nachbarStelle – „Nach oben“ / „Nach unten“', () => {
  it('springt um einen ganzen Abschnitt derselben Stufe', () => {
    expect(nachbarStelle(DOK, 3, 'hoch')).toBe(1);
    expect(nachbarStelle(DOK, 3, 'runter')).toBe(12);
    expect(nachbarStelle(DOK, 8, 'hoch')).toBe(5);
    expect(nachbarStelle(DOK, 5, 'runter')).toBe(10);
  });
  it('nicht über die übergeordnete Überschrift, nicht vor den Vorspann, nicht übers Ende', () => {
    expect(nachbarStelle(DOK, 1, 'hoch')).toBeNull();
    expect(nachbarStelle(DOK, 10, 'runter')).toBeNull();
    expect(nachbarStelle(DOK, 5, 'hoch')).toBeNull(); // darüber steht B (Stufe 1)
    expect(nachbarStelle(DOK, 8, 'runter')).toBeNull(); // darunter kommt C (Stufe 1)
    expect(nachbarStelle(DOK, 6, 'hoch')).toBeNull(); // B1x: darüber B1 (Stufe 2)
  });
  it('kein Abschnitt: null', () => {
    expect(nachbarStelle(DOK, 4, 'hoch')).toBeNull();
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
  it('„Nach unten“ und „Nach oben“ heben sich auf', () => {
    const runter = abschnittVerschoben(DOK, 5, nachbarStelle(DOK, 5, 'runter')!);
    expect(ids(runter).slice(5, 10)).toEqual(['B2', 'b2', 'B1', 'B1x', 'b1']);
    const start = runter.findIndex((b) => b.id === 'B1');
    expect(ids(abschnittVerschoben(runter, start, nachbarStelle(runter, start, 'hoch')!))).toEqual(
      ids(DOK),
    );
  });
  it('dieselben Blöcke, nichts geht verloren', () => {
    const neu = abschnittVerschoben(DOK, 3, 12);
    expect([...ids(neu)].sort()).toEqual([...ids(DOK)].sort());
  });
});
