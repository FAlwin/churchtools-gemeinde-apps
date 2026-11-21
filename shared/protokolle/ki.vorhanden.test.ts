import { describe, expect, it } from 'vitest';
import { ableiten, BLOCK, textAus, type Block } from './dokument';
import {
  antwortLesen,
  auftragBauen,
  kennungNormal,
  namenSuchtext,
  uebernahmePlanen,
  vorhandeneZeilen,
  type AntwortKontext,
  type Eintrag,
  type Einfuegung,
} from './ki';
import { namenFinden, platzhalterAnwenden, type Person } from './platzhalter';

/**
 * **W12 – „Keine Doppelten“**: Der ganze Weg gegen die Erzeuger, kein handgeschriebenes Literal für den Auftrag:
 * `auftragBauen` → (KI-Antwort aus den Kennungen DES Auftrags) → `antwortLesen` → `uebernahmePlanen` → Dokument.
 */

const PETER: Person = { id: 3, vorname: 'Peter', nachname: 'Wiens' };
const MARIA: Person = { id: 5, vorname: 'Maria', nachname: 'Dück' };
const GRUPPE = [PETER, MARIA];

const text = (t: string) => [{ type: 'text', text: t, styles: {} }];
const heading = (id: string, t: string, level = 1): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: text(t),
  children: [],
});
const zeile = (id: string, t: string, children: Block[] = [], type = 'bulletListItem'): Block => ({
  id,
  type,
  content: text(t),
  children,
});

/**
 * 1 Feste 2027: Z1 Absatz (mit Name) · Z2 Aufzählung MIT eingerückter Zeile Z3 · Z4 Aufzählung mit Kind Z5 (Zeile mit
 *   Kindern, deren Kind NICHT ersetzt wird)
 * 2 Ostern: Z6, Z7 · 3 Rückblick (fester Punkt, Absatz darin zählt nicht) · 4 Verschiedenes (leer)
 */
function dokument(): Block[] {
  return [
    heading('h1', 'Feste 2027'),
    zeile('a1', 'Eislaufen am 06.01. mit Peter.', [], 'paragraph'),
    zeile('b1', 'Eishalle Troisdorf anfragen, sonst Wiehl.', [
      zeile('b2', 'Getränketisch klären.'),
    ]),
    zeile('b3', 'Danach Essen im Gemeindehaus.', [zeile('b4', 'Kuchen mitbringen.')]),
    heading('h2', 'Ostern'),
    zeile('b5', 'Gründonnerstag 19 Uhr mit Abendmahl.'),
    zeile('b6', 'Ab 18 Uhr Stehimbiss.'),
    heading('h3', 'Rückblick'),
    { id: 'v1', type: BLOCK.verweis, props: { art: 'letztes-protokoll' }, children: [] },
    zeile('f1', 'Steht im festen Punkt.', [], 'paragraph'),
    heading('h4', 'Verschiedenes'),
    zeile('leer', '', [], 'paragraph'),
  ];
}

const TRANSKRIPT = 'Peter: Wir laufen Eis. Maria kümmert sich um die Halle.';
const funde = namenFinden(
  namenSuchtext({ gruppe: 'Festplanung', transkript: TRANSKRIPT, dokument: dokument() }),
  { alle: GRUPPE, gruppe: GRUPPE },
);
const angewendet = platzhalterAnwenden(TRANSKRIPT, funde);
const ph = (name: string): string => {
  const f = funde.find((x) => x.text === name);
  if (!f) throw new Error(`kein Fund für ${name}`);
  return f.platzhalter;
};
const auftrag = auftragBauen({
  gruppe: 'Festplanung',
  datum: '2026-11-21',
  dokument: dokument(),
  transkript: angewendet.text,
  funde,
});
/** Die Kennung der Zeile mit diesem Text – aus dem Auftrag gelesen, nicht von Hand angenommen. */
const kennung = (t: string): string => {
  const m = new RegExp(`^\\s*(Z\\d+) ${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').exec(
    auftrag,
  );
  if (!m) throw new Error(`keine Kennung für „${t}“ im Auftrag`);
  return m[1];
};

const kontext = (dok: readonly Block[] = dokument()): AntwortKontext => ({
  dokument: dok,
  zuordnung: angewendet.zuordnung,
  funde,
  gruppe: GRUPPE,
});
const lesen = (antwort: object, dok?: readonly Block[]): Eintrag[] => {
  const r = antwortLesen(JSON.stringify(antwort), kontext(dok));
  if (!r.ok) throw new Error(r.meldung);
  return r.eintraege;
};

/** Führt die Einfügungen aus, wie `EditorGriff.einfuegungen` es tut (Gegenstück im Editor-Test `bloeckeEinfuegen.test`). */
function anwenden(dok: Block[], einfuegungen: readonly Einfuegung[]): Block[] {
  const doc: Block[] = structuredClone(dok);
  const suche = (liste: Block[], id: string): { liste: Block[]; i: number } | null => {
    for (let i = 0; i < liste.length; i++) {
      if (liste[i].id === id) return { liste, i };
      const k = suche(liste[i].children ?? [], id);
      if (k) return k;
    }
    return null;
  };
  for (const e of einfuegungen) {
    const ziel = e.nach ? suche(doc, e.nach) : e.vor ? suche(doc, e.vor) : null;
    if (ziel) ziel.liste.splice(ziel.i + (e.nach ? 1 : 0), 0, ...e.bloecke);
    else {
      // Ende: vor die leere Schlusszeile
      const i = doc.findIndex((b) => b.id === 'leer');
      doc.splice(i < 0 ? doc.length : i, 0, ...e.bloecke);
    }
    for (const id of e.entfernen ?? []) {
      const r = suche(doc, id);
      if (r && !(r.liste[r.i].children ?? []).length) r.liste.splice(r.i, 1);
    }
  }
  return doc;
}
const flach = (bs: readonly Block[], tiefe = 0): string[] =>
  bs.flatMap((b) => [
    `${'>'.repeat(tiefe)}${b.type === 'bulletListItem' || b.type === 'paragraph' ? '' : `[${b.type}] `}${textAus(b.content)}`,
    ...flach(b.children ?? [], tiefe + 1),
  ]);

describe('vorhandeneZeilen und Auftrag', () => {
  it('Kennungen laufen durchs Dokument; eingerückte zählen mit, Ebene und Kinder stimmen; feste Punkte, Überschriften und Leeres nicht', () => {
    const z = vorhandeneZeilen(dokument());
    expect(z.map((x) => [x.kennung, x.ebene, x.kinder])).toEqual([
      ['Z1', 0, false],
      ['Z2', 0, true],
      ['Z3', 1, false],
      ['Z4', 0, true],
      ['Z5', 1, false],
      ['Z6', 0, false],
      ['Z7', 0, false],
    ]);
    expect(z.map((x) => x.punktId)).toEqual(['h1', 'h1', 'h1', 'h1', 'h1', 'h2', 'h2']);
    expect(new Set(z.map((x) => x.kennung)).size).toBe(z.length);
  });

  it('Bausteine und Tabellen sind keine Zeilen', () => {
    const dok = [
      heading('h', 'P'),
      { id: 'be', type: BLOCK.beschluss, content: text('Beschluss'), children: [] },
      { id: 'td', type: BLOCK.aufgabe, content: text('To-Do'), children: [] },
      {
        id: 'tm',
        type: BLOCK.termin,
        props: { datum: '2026-12-01' },
        content: text('Termin'),
        children: [],
      },
      { id: 'tab', type: 'table', content: { type: 'tableContent', rows: [] }, children: [] },
    ];
    expect(vorhandeneZeilen(dok)).toEqual([]);
  });

  it('der Auftrag zeigt die Zeilen mit Kennung unter ihrem Punkt, eingerückte eingerückt, feste Punkte ohne', () => {
    expect(auftrag).toContain(
      [
        '1. Feste 2027',
        `  Z1 Eislaufen am 06.01. mit ${ph('Peter')}.`,
        '  Z2 Eishalle Troisdorf anfragen, sonst Wiehl.',
        '    Z3 Getränketisch klären.',
        '  Z4 Danach Essen im Gemeindehaus.',
        '    Z5 Kuchen mitbringen.',
        '2. Ostern',
        '  Z6 Gründonnerstag 19 Uhr mit Abendmahl.',
        '  Z7 Ab 18 Uhr Stehimbiss.',
        '3. Rückblick (fester Punkt – nichts zuordnen)',
        '4. Verschiedenes',
      ].join('\n'),
    );
    expect(auftrag).not.toContain('Steht im festen Punkt');
  });

  it('Namensschutz: kein gefundener Name steht im Auftrag – auch nicht aus dem vorhandenen Text', () => {
    expect(funde.length).toBeGreaterThan(0);
    for (const f of funde) {
      const wort = new RegExp(`(?<![\\p{L}\\p{N}_])${f.text}(?![\\p{L}\\p{N}_])`, 'u');
      expect(auftrag, f.text).not.toMatch(wort);
    }
    // „Peter“ kommt NUR im vorhandenen Text vor: Ohne `namenSuchtext` wäre er nicht gefunden worden (Gegenprobe).
    const nurTranskript = namenFinden('Maria: ja', { alle: GRUPPE, gruppe: GRUPPE });
    expect(nurTranskript.some((f) => f.text === 'Peter')).toBe(false);
    expect(funde.some((f) => f.text === 'Peter')).toBe(true);
  });

  it('der Auftrag erklärt „ersetzt“ und „nach“ und hat das erweiterte Beispiel', () => {
    expect(auftrag).toContain('Wiederhole diese Zeilen nicht als Stichpunkt');
    expect(auftrag).toContain('"ersetzt":["Z3"]');
    expect(auftrag).toContain('"nach":"Z2"');
    expect(auftrag).toContain('"ersetzt":["Z4","Z5"]');
  });

  it('ohne vorhandenen Text: keine Kennung, kein „ersetzt“, kein neuer Satz', () => {
    const leer = auftragBauen({
      gruppe: 'G',
      datum: '2026-11-21',
      dokument: [heading('h', 'Andacht'), zeile('l', '', [], 'paragraph')],
      transkript: 'x',
    });
    expect(leer).not.toMatch(/\bZ\d+\b/);
    expect(leer).not.toContain('"ersetzt"');
    expect(leer).not.toContain('"nach"');
    expect(leer).not.toContain('Kennung');
  });

  it('kennungNormal liest Z3, z3, „Z 3“ und die Zahl 3; sonst leer', () => {
    expect(['Z3', 'z3', ' Z 3 ', 3, '3'].map(kennungNormal)).toEqual([
      'Z3',
      'Z3',
      'Z3',
      'Z3',
      'Z3',
    ]);
    expect(['', 'Zeile 3', 'Z', 'Z3a', null, {}].map(kennungNormal)).toEqual([
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });
});

describe('antwortLesen mit ersetzt / nach / doppelt', () => {
  const z = { z1: () => kennung(`Eislaufen am 06.01. mit ${ph('Peter')}.`) };

  it('liest ersetzt (Liste, Zahl, kleines z) und nach – mit Block-ID und Text von damals', () => {
    const e = lesen({
      beschluesse: [
        { nr: '1', text: 'Essen', ersetzt: [kennung('Danach Essen im Gemeindehaus.')] },
      ],
      todos: [{ nr: '2', text: 'Auf', ersetzt: 6, nach: 'z7' }],
    });
    const b = e[0];
    expect(b.art === 'beschluss' && b.ersetzt).toEqual([
      { kennung: 'Z4', blockId: 'b3', text: 'Danach Essen im Gemeindehaus.' },
    ]);
    const t = e[1];
    expect(t.art === 'todo' && t.ersetzt?.map((x) => x.blockId)).toEqual(['b5']);
    expect(t.art === 'todo' && t.nach?.blockId).toBe('b6');
  });

  it('unbekannte Kennung wird verworfen, der Eintrag bleibt', () => {
    const e = lesen({
      beschluesse: [{ nr: '1', text: 'X', ersetzt: ['Z99', 'Quatsch', 5.5, null, { a: 1 }] }],
    });
    expect(e).toHaveLength(1);
    expect(e[0].art === 'beschluss' && e[0].ersetzt).toBeUndefined();
  });

  it('eine Kennung aus einem ANDEREN Punkt wird verworfen (ersetzt wie nach)', () => {
    const e = lesen({
      beschluesse: [{ nr: '2', text: 'X', ersetzt: [z.z1()], nach: z.z1() }],
    });
    const b = e[0];
    expect(b.art === 'beschluss' && b.ersetzt).toBeUndefined();
    expect(b.art === 'beschluss' && b.nach).toBeUndefined();
  });

  it('eine Kennung, die zweimal ersetzt wird: nur der erste Eintrag ersetzt sie', () => {
    const e = lesen({
      beschluesse: [{ nr: '1', text: 'Erster', ersetzt: ['Z1'] }],
      todos: [{ nr: '1', text: 'Zweiter', ersetzt: ['Z1', 'Z2'] }],
      termine: [{ nr: '1', text: 'Dritter', datum: '2026-12-01', ersetzt: ['Z1'] }],
    });
    const ids = (x: Eintrag) => ('ersetzt' in x ? (x.ersetzt ?? []).map((r) => r.kennung) : []);
    expect(ids(e[0])).toEqual(['Z1']);
    expect(ids(e[1])).toEqual(['Z2']);
    expect(ids(e[2])).toEqual([]);
  });

  it('dieselbe Kennung zweimal im selben Eintrag zählt einmal', () => {
    const e = lesen({ beschluesse: [{ nr: '1', text: 'X', ersetzt: ['Z1', 'z1', 1] }] });
    expect(e[0].art === 'beschluss' && e[0].ersetzt).toHaveLength(1);
  });

  it('alte Antworten ohne die neuen Felder lesen sich wie bisher', () => {
    const e = lesen({
      punkte: [{ nr: '1', stichpunkte: ['Neu'] }],
      beschluesse: [{ nr: '1', text: 'B' }],
      todos: [{ nr: '1', text: 'T' }],
      termine: [{ nr: '1', datum: '2026-12-01', text: 'M' }],
    });
    for (const x of e) {
      expect('ersetzt' in x).toBe(false);
      expect('nach' in x).toBe(false);
      expect('doppelt' in x).toBe(false);
    }
  });

  it('ein Stichpunkt, der schon dasteht, trägt die vorhandene Zeile in „doppelt“; ein neuer nicht', () => {
    const e = lesen({
      punkte: [
        { nr: '2', stichpunkte: ['Stehimbiss ab 18 Uhr', 'Kinderchor singt am Sonntag'] },
        // derselbe Text unter einem ANDEREN Punkt ist kein Doppelter
        { nr: '1', stichpunkte: ['Stehimbiss ab 18 Uhr'] },
      ],
    });
    expect(e[0].art === 'stichpunkt' && e[0].doppelt?.kennung).toBe('Z7');
    expect(e[1].art === 'stichpunkt' && e[1].doppelt).toBeUndefined();
    expect(e[2].art === 'stichpunkt' && e[2].doppelt).toBeUndefined();
  });

  it('Stichpunkt mit „nach“ – an der Gruppe oder je Stichpunkt als Objekt', () => {
    const e = lesen({
      punkte: [
        { nr: '2', nach: 'Z6', stichpunkte: ['Kinderchor singt am Sonntag'] },
        { nr: '2', stichpunkte: [{ text: 'Predigt von Maria', nach: 'Z7' }] },
      ],
    });
    expect(e[0].art === 'stichpunkt' && e[0].nach?.blockId).toBe('b5');
    expect(e[1].art === 'stichpunkt' && e[1].nach?.blockId).toBe('b6');
    expect(e[1].art === 'stichpunkt' && e[1].text).toContain('Predigt');
  });

  it('Namen im Text kommen zurück (Platzhalter aus dem vorhandenen Text und dem Transkript)', () => {
    const e = lesen({
      beschluesse: [{ nr: '1', text: `${ph('Peter')} organisiert`, ersetzt: ['Z1'] }],
    });
    expect(e[0].art === 'beschluss' && e[0].text).toBe('Peter organisiert');
  });
});

describe('Der ganze Weg: Auftrag → Antwort → Lesen → Übernehmen', () => {
  const k = {
    getraenke: () => kennung('Getränketisch klären.'),
  };
  const antwort = () => ({
    punkte: [
      {
        nr: '2',
        stichpunkte: ['Stehimbiss ab 18 Uhr', 'Kinderchor singt am Sonntag'],
      },
    ],
    beschluesse: [
      // Z4 hat ein Kind (Z5) → bleibt, der Baustein kommt darunter
      {
        nr: '1',
        text: 'Essen im Gemeindehaus.',
        ersetzt: [kennung('Danach Essen im Gemeindehaus.')],
      },
      // Z6 wird ersetzt, ersetzen später abgewählt
      {
        nr: '2',
        text: 'Gründonnerstag mit Abendmahl um 19 Uhr.',
        ersetzt: [kennung('Gründonnerstag 19 Uhr mit Abendmahl.')],
      },
    ],
    todos: [
      // Z2 hat ein Kind (Z3, eingerückt): Z3 wird ersetzt, Z2 bleibt
      {
        nr: '1',
        text: 'Eishalle anfragen und Getränke klären',
        wer: [ph('Maria')],
        ersetzt: [kennung('Eishalle Troisdorf anfragen, sonst Wiehl.'), k.getraenke()],
      },
    ],
    termine: [
      {
        nr: '1',
        datum: '2026-01-06',
        text: 'Eislaufen',
        ersetzt: [kennung(`Eislaufen am 06.01. mit ${ph('Peter')}.`)],
      },
      // „nach“ einer Zeile, die ein anderer Baustein ersetzt (Z1): folgt diesem Baustein
      {
        nr: '1',
        datum: '2026-01-07',
        text: 'Zweiter Tag',
        nach: kennung(`Eislaufen am 06.01. mit ${ph('Peter')}.`),
      },
    ],
  });
  const alle = lesen(antwort());
  const plan = (ersetzenAus: string[] = [], gewaehlt: readonly Eintrag[] = alle) =>
    uebernahmePlanen(
      gewaehlt,
      dokument(),
      (() => {
        let n = 0;
        return () => `neu-${++n}`;
      })(),
      {
        ersetzenAus: new Set(ersetzenAus),
      },
    );
  const idVon = (t: string) => alle.find((e) => 'text' in e && e.text.startsWith(t))!.id;

  it('Bausteine stehen an der Stelle der Zeile, ersetzte Zeilen sind weg, Zeilen mit Kindern bleiben – kein Text geht verloren', () => {
    const nachher = anwenden(dokument(), plan().einfuegungen);
    const f = flach(nachher);
    // Z1 ersetzt durch den Termin (Z1 stand ganz oben im Punkt) – der zweite Termin folgt ihm
    expect(f.slice(0, 3)).toEqual([
      '[heading] Feste 2027',
      '[termin] Eislaufen',
      '[termin] Zweiter Tag',
    ]);
    // Z2 (mit Kind) bleibt; Z3 ersetzt: To-Do steht an Z3s Stelle, eingerückt unter Z2
    const i2 = f.indexOf('Eishalle Troisdorf anfragen, sonst Wiehl.');
    expect(f[i2 + 1]).toBe('>[aufgabe] Eishalle anfragen und Getränke klären');
    expect(f).not.toContain('>Getränketisch klären.');
    // Z4 (mit Kind Z5) bleibt UND sein Kind; der Beschluss kommt darunter
    const i4 = f.indexOf('Danach Essen im Gemeindehaus.');
    expect(f[i4 + 1]).toBe('>Kuchen mitbringen.');
    expect(f[i4 + 2]).toBe('[beschluss] Essen im Gemeindehaus.');
    // Z6 ersetzt
    expect(f).not.toContain('Gründonnerstag 19 Uhr mit Abendmahl.');
    expect(f).toContain('[beschluss] Gründonnerstag mit Abendmahl um 19 Uhr.');
    // Z1, Z3, Z6 weg – alles andere noch da
    const text = f.join('\n');
    for (const bleibt of [
      'Eishalle Troisdorf',
      'Danach Essen',
      'Kuchen mitbringen',
      'Ab 18 Uhr Stehimbiss',
      'Steht im festen Punkt',
    ])
      expect(text).toContain(bleibt);
    // Ableitung: die Bausteine gehören zu ihren Punkten
    const a = ableiten(nachher);
    expect(a.beschluesse.map((b) => b.punkt)).toEqual(['h1', 'h2']);
    expect(a.termine.map((t) => t.punkt)).toEqual(['h1', 'h1']);
  });

  it('der Stichpunkt, der schon dasteht, ist markiert; abgewählt kommt er nicht ins Dokument, der neue ans Ende des Punkts', () => {
    const doppelt = alle.filter((e) => e.art === 'stichpunkt' && e.doppelt);
    expect(doppelt.map((e) => e.art === 'stichpunkt' && e.text)).toEqual(['Stehimbiss ab 18 Uhr']);
    const gewaehlt = alle.filter((e) => !doppelt.includes(e));
    const f = flach(anwenden(dokument(), plan([], gewaehlt).einfuegungen));
    expect(f.join('\n')).not.toContain('Stehimbiss ab 18 Uhr\n');
    expect(f.filter((x) => x.includes('Stehimbiss')).length).toBe(1); // nur die vorhandene Zeile
    expect(f).toContain('Kinderchor singt am Sonntag');
    // Ende des Punkts „Ostern“: vor „Rückblick“
    expect(f.indexOf('Kinderchor singt am Sonntag')).toBeLessThan(f.indexOf('[heading] Rückblick'));
  });

  it('„ersetzen“ abgewählt: die Zeile bleibt, der Baustein kommt darunter', () => {
    const f = flach(anwenden(dokument(), plan([idVon('Gründonnerstag')]).einfuegungen));
    const i = f.indexOf('Gründonnerstag 19 Uhr mit Abendmahl.');
    expect(i).toBeGreaterThan(-1);
    expect(f[i + 1]).toBe('[beschluss] Gründonnerstag mit Abendmahl um 19 Uhr.');
  });

  it('alle ersetzten Zeilen mit Kindern: keine wird entfernt', () => {
    const e = lesen({ beschluesse: [{ nr: '1', text: 'B', ersetzt: ['Z2', 'Z4'] }] });
    const p = plan([], e);
    expect(p.einfuegungen.flatMap((x) => x.entfernen ?? [])).toEqual([]);
    const f = flach(anwenden(dokument(), p.einfuegungen));
    expect(f.join('\n')).toContain('Kuchen mitbringen.');
    expect(f.join('\n')).toContain('Getränketisch klären.');
    // darunter: hinter der letzten (Z4 samt Kind)
    expect(f[f.indexOf('>Kuchen mitbringen.') + 1]).toBe('[beschluss] B');
  });

  it('Zeile inzwischen geändert: nichts wird entfernt, der Baustein kommt ans Ende des Punkts', () => {
    const dok = dokument();
    (dok[5].content as { text: string }[])[0].text = 'Gründonnerstag jetzt um 20 Uhr.';
    const p = uebernahmePlanen(alle, dok, () => 'x' + Math.random());
    const f = flach(anwenden(dok, p.einfuegungen));
    expect(f).toContain('Gründonnerstag jetzt um 20 Uhr.');
    expect(f.indexOf('[beschluss] Gründonnerstag mit Abendmahl um 19 Uhr.')).toBeGreaterThan(
      f.indexOf('Ab 18 Uhr Stehimbiss.'),
    ); // Ende von „Ostern“
  });

  it('Zeile inzwischen weg: der Baustein kommt ans Ende des Punkts, nichts bricht', () => {
    const dok = dokument().filter((b) => b.id !== 'b5');
    const p = uebernahmePlanen(alle, dok, () => 'x' + Math.random());
    const f = flach(anwenden(dok, p.einfuegungen));
    expect(f).toContain('[beschluss] Gründonnerstag mit Abendmahl um 19 Uhr.');
    expect(f).toContain('Ab 18 Uhr Stehimbiss.');
  });

  it('ohne ersetzt/nach wie heute: alles ans Ende des Punkts, vor den nächsten Punkt', () => {
    const e = lesen({ beschluesse: [{ nr: '1', text: 'Nur ein Beschluss' }] });
    const p = uebernahmePlanen(e, dokument(), () => 'n1');
    expect(p.einfuegungen).toEqual([
      { vor: 'h2', bloecke: [expect.objectContaining({ type: BLOCK.beschluss })] },
    ]);
  });

  it('Block-IDs sind eindeutig und nichts wird doppelt entfernt', () => {
    const p = plan();
    const neueIds = p.einfuegungen.flatMap((x) => x.bloecke.map((b) => b.id));
    expect(new Set(neueIds).size).toBe(neueIds.length);
    const weg = p.einfuegungen.flatMap((x) => x.entfernen ?? []);
    expect(new Set(weg).size).toBe(weg.length);
    expect(weg.sort()).toEqual(['a1', 'b2', 'b5']);
  });
});
