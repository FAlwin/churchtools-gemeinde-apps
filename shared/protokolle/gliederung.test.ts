import { describe, expect, it } from 'vitest';
import { ableiten, type Block } from './dokument';
import { geschwisterVon, gibtZuOrdnen, gliederung, punktVerschieben } from './gliederung';

/** Punkte ordnen (W7) – gerechnet gegen dieselbe Ableitung (`ableiten`), die Text, Lese-Ansicht und Bereiche zählt. */

const h = (id: string, text: string, level = 1): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: text,
});
const p = (id: string, text = 'Text'): Block => ({ id, type: 'paragraph', content: text });
const punkt = (id: string): Block => ({ id, type: 'bulletListItem', content: `Stichpunkt ${id}` });

/** Das Protokoll aus dem Entwurf: Vorspann, sechs Punkte, Punkt 4 mit drei Unterpunkten (Bild mit „Überschrift“). */
const DOK: Block[] = [
  p('vor', 'Willkommen zum Treffen'),
  h('P1', 'Anwesenheit'),
  { id: 'anw', type: 'verweis', props: { art: 'anwesenheit' } },
  h('P2', 'Andacht'),
  punkt('a1'),
  h('P3', 'Rückblick'),
  punkt('r1'),
  punkt('r2'),
  punkt('r3'),
  { id: 'todo', type: 'aufgabe', props: { aufgabe: 'aufgabe-7' }, content: 'Lautstärke messen' },
  h('P4', 'Abläufe je Bereich'),
  h('U1', 'Ton', 2),
  punkt('t1'),
  punkt('t2'),
  h('U2', 'Bild', 2),
  punkt('b1'),
  { id: 'besch', type: 'beschluss', content: 'Beamer bleibt' },
  h('Ue', 'Nachtrag', 3),
  p('ue1', 'Gehört zur Überschrift'),
  h('U3', 'Stream', 2),
  punkt('s1'),
  h('P5', 'Organisation'),
  punkt('o1'),
  h('P6', 'Ausblick'),
  { id: 'termin', type: 'termin', props: { datum: '2027-01-21' }, content: 'Teamtreffen' },
];

const ids = (l: readonly Block[]) => l.map((b) => b.id);
const nach = (id: string, index: number, dok: readonly Block[] = DOK) => {
  const r = punktVerschieben(dok, id, index);
  if (!r) throw new Error(`kein Schritt für ${id} → ${index}`);
  return r;
};

describe('gliederung', () => {
  const g = gliederung(DOK);

  it('Punkte und Unterpunkte mit Nummer wie im Text – aus derselben Ableitung', () => {
    expect(g.map((k) => [k.id, k.nummer, k.titel])).toEqual([
      ['P1', '1.', 'Anwesenheit'],
      ['P2', '2.', 'Andacht'],
      ['P3', '3.', 'Rückblick'],
      ['P4', '4.', 'Abläufe je Bereich'],
      ['P5', '5.', 'Organisation'],
      ['P6', '6.', 'Ausblick'],
    ]);
    expect(g[3].kinder.map((k) => [k.id, k.nummer])).toEqual([
      ['U1', '4.1'],
      ['U2', '4.2'],
      ['U3', '4.3'],
    ]);
    // Wirklich dieselbe Zählung wie `ableiten` (nicht nachgerechnet).
    const aus = ableiten(DOK).punkte.map((x) => x.blockId);
    const flach = (l: typeof g): string[] => l.flatMap((k) => [k.id, ...flach(k.kinder)]);
    expect(flach(g)).toEqual(aus);
  });

  it('„Überschrift“ (Rang 6) wird nicht gelistet', () => {
    const flach = (l: typeof g): string[] => l.flatMap((k) => [k.id, ...flach(k.kinder)]);
    expect(flach(g)).not.toContain('Ue');
  });

  it('sagt, was mitwandert – ohne den Inhalt der Unterpunkte, mit deren Zahl', () => {
    expect(g[0].mit).toBe('fester Punkt · Anwesenheitsliste');
    expect(g[0].fest).toBe(true);
    expect(g[1].mit).toBe('1 Stichpunkt');
    expect(g[2].mit).toBe('3 Stichpunkte · 1 To-Do');
    expect(g[3].mit).toBe('3 Unterpunkte');
    expect(g[3].kinder[1].mit).toBe('1 Stichpunkt · 1 Beschluss · 1 Absatz');
    expect(g[5].mit).toBe('1 Termin');
    expect(g[1].fest).toBe(false);
  });

  it('ein Punkt ohne Inhalt – und leere Zeilen zählen nicht', () => {
    const l = gliederung([
      h('A', 'Leer'),
      p('x', ''),
      { id: 'y', type: 'bulletListItem', content: '' },
    ]);
    expect(l[0].mit).toBe('noch ohne Inhalt');
  });

  it('Inhalt vor dem ersten Punkt gehört zu keinem Punkt', () => {
    expect(gliederung([p('x'), h('A', 'Erster')])[0].mit).toBe('noch ohne Inhalt');
    expect(gliederung([p('x')])).toEqual([]);
  });
});

/** Wer ist der Elternpunkt von wem – aus dem Baum, nicht aus den Blöcken. */
const eltern = (dok: readonly Block[]): Record<string, string | null> => {
  const m: Record<string, string | null> = {};
  const lauf = (l: ReturnType<typeof gliederung>, e: string | null): void =>
    l.forEach((k) => {
      m[k.id] = e;
      lauf(k.kinder, k.id);
    });
  lauf(gliederung(dok), null);
  return m;
};

describe('punktVerschieben', () => {
  it('ein Punkt mit Unterpunkten und To-Do: alles wandert mit, IDs und Ebenen bleiben', () => {
    const { bloecke } = nach('P4', 1);
    expect(ids(bloecke)).toEqual([
      'vor',
      'P1',
      'anw',
      'P4',
      'U1',
      't1',
      't2',
      'U2',
      'b1',
      'besch',
      'Ue',
      'ue1',
      'U3',
      's1',
      'P2',
      'a1',
      'P3',
      'r1',
      'r2',
      'r3',
      'todo',
      'P5',
      'o1',
      'P6',
      'termin',
    ]);
    // Dieselben Blöcke, unverändert (Aufgaben-ID, Stufen) – nur in anderer Reihenfolge.
    for (const alt of DOK) expect(bloecke.find((b) => b.id === alt.id)).toEqual(alt);
    expect(bloecke).toHaveLength(DOK.length);
    expect(bloecke.find((b) => b.id === 'todo')?.props).toEqual({ aufgabe: 'aufgabe-7' });
  });

  it('die Nummern folgen der neuen Reihenfolge', () => {
    const g = gliederung(nach('P4', 1).bloecke);
    expect(g.map((k) => [k.id, k.nummer])).toEqual([
      ['P1', '1.'],
      ['P4', '2.'],
      ['P2', '3.'],
      ['P3', '4.'],
      ['P5', '5.'],
      ['P6', '6.'],
    ]);
    expect(g[1].kinder.map((k) => k.nummer)).toEqual(['2.1', '2.2', '2.3']);
  });

  it('ein Unterpunkt nur innerhalb seines Punkts – nie heraus', () => {
    const { bloecke } = nach('U1', 2);
    expect(ids(bloecke).slice(10, 21)).toEqual([
      'P4',
      'U2',
      'b1',
      'besch',
      'Ue',
      'ue1',
      'U3',
      's1',
      'U1',
      't1',
      't2',
    ]);
    // Außerhalb der Geschwister (0–2) gibt es keinen Schritt.
    expect(punktVerschieben(DOK, 'U1', 3)).toBeNull();
    expect(punktVerschieben(DOK, 'U1', -1)).toBeNull();
    expect(gliederung(bloecke)[3].kinder.map((k) => k.id)).toEqual(['U2', 'U3', 'U1']);
  });

  it('die „Überschrift“ (Rang 6) wandert mit ihrem Abschnitt', () => {
    const { bloecke } = nach('U2', 0);
    expect(ids(bloecke).slice(10, 21)).toEqual([
      'P4',
      'U2',
      'b1',
      'besch',
      'Ue',
      'ue1',
      'U1',
      't1',
      't2',
      'U3',
      's1',
    ]);
  });

  it('der Inhalt vor dem ersten Punkt bleibt oben – bei jedem Schritt', () => {
    for (const k of gliederung(DOK)) {
      const r = punktVerschieben(DOK, k.id, k.id === 'P1' ? 5 : 0);
      expect(r && ids(r.bloecke)[0]).toBe('vor');
    }
    expect(ids(nach('P1', 5).bloecke).slice(0, 2)).toEqual(['vor', 'P2']);
  });

  it('ein fester Punkt wandert ganz normal mit', () => {
    const { bloecke } = nach('P1', 2);
    const i = ids(bloecke);
    expect(i.indexOf('anw')).toBe(i.indexOf('P1') + 1);
    expect(gliederung(bloecke).map((k) => k.id)).toEqual(['P2', 'P3', 'P1', 'P4', 'P5', 'P6']);
  });

  it('der Satz sagt, was passiert ist', () => {
    expect(nach('P4', 1).hinweis).toBe('„Abläufe je Bereich“ nach oben verschoben (jetzt 2.)');
    expect(nach('U1', 1).hinweis).toBe('„Ton“ nach unten verschoben (jetzt 4.2)');
  });

  it('derselbe Platz oder ein Block ohne Punkt: kein Schritt', () => {
    expect(punktVerschieben(DOK, 'P2', 1)).toBeNull();
    expect(punktVerschieben(DOK, 'a1', 0)).toBeNull();
    expect(punktVerschieben(DOK, 'Ue', 0)).toBeNull();
  });

  it('jeder mögliche Schritt (alle Punkte × alle Plätze) erhält Blöcke, Eltern und Tiefe – gegen die Ableitung', () => {
    const vorher = ableiten(DOK).punkte;
    let schritte = 0;
    const lauf = (liste: ReturnType<typeof gliederung>): void => {
      for (const k of liste) {
        const g = geschwisterVon(gliederung(DOK), k.id)!;
        for (let i = 0; i < g.liste.length; i++) {
          const r = punktVerschieben(DOK, k.id, i);
          if (i === g.index) {
            expect(r).toBeNull();
            continue;
          }
          expect(r).not.toBeNull();
          schritte++;
          expect([...ids(r!.bloecke)].sort()).toEqual([...ids(DOK)].sort());
          expect(eltern(r!.bloecke)).toEqual(eltern(DOK));
          const nachher = ableiten(r!.bloecke).punkte;
          for (const x of vorher)
            expect(nachher.find((y) => y.blockId === x.blockId)?.tiefe).toBe(x.tiefe);
        }
        lauf(k.kinder);
      }
    };
    lauf(gliederung(DOK));
    expect(schritte).toBeGreaterThan(20);
  });

  it('Unterpunkte verschiedener Stufe nebeneinander: der Schritt, der einen in den anderen hängte, fehlt', () => {
    // A · X (Stufe 4, zählt als 1.1) · Y (Stufe 2, 1.2). X hinter Y gestellt, hinge unter Y (1.1.1) – die Ebene bliebe nicht.
    const D: Block[] = [h('A', 'A'), h('X', 'X', 4), p('x'), h('Y', 'Y', 2), p('y')];
    expect(gliederung(D)[0].kinder.map((k) => k.id)).toEqual(['X', 'Y']);
    expect(punktVerschieben(D, 'X', 1)).toBeNull();
    expect(punktVerschieben(D, 'Y', 0)).toBeNull();
  });
});

describe('gibtZuOrdnen', () => {
  it('ab zwei Punkten unter demselben Punkt', () => {
    expect(gibtZuOrdnen(DOK)).toBe(true);
    expect(gibtZuOrdnen([h('A', 'A'), p('x')])).toBe(false);
    expect(gibtZuOrdnen([p('v'), h('A', 'A'), h('A1', 'A1', 2), h('A2', 'A2', 2)])).toBe(true);
    expect(gibtZuOrdnen([h('A', 'A'), h('A1', 'A1', 2)])).toBe(false);
    expect(gibtZuOrdnen([])).toBe(false);
  });
});
