import { describe, it, expect } from 'vitest';
import {
  akkordVerschieben,
  akkordeImText,
  flowEinfuegen,
  flowSetzen,
  parseChordPro,
  parseLine,
  parseMetadata,
  teileImFlow,
} from './chordpro';

describe('parseLine', () => {
  it('gibt reinen Text ohne Akkorde als ein Paar zurück', () => {
    expect(parseLine('nur Text')).toEqual([{ chord: null, text: 'nur Text' }]);
  });

  it('trennt führenden Text vom ersten Akkord', () => {
    expect(parseLine('Hallo [C]Welt [G]nun')).toEqual([
      { chord: null, text: 'Hallo ' },
      { chord: 'C', text: 'Welt ' },
      { chord: 'G', text: 'nun' },
    ]);
  });

  it('behandelt einen Akkord am Zeilenanfang ohne führenden Text', () => {
    expect(parseLine('[C]Start')).toEqual([{ chord: 'C', text: 'Start' }]);
  });

  it('behandelt leere Klammern als chord=null', () => {
    expect(parseLine('[]leer')).toEqual([{ chord: null, text: 'leer' }]);
  });
});

describe('parseChordPro – Standard-Dialekt', () => {
  it('liest start_of/end_of-Blöcke mit Label', () => {
    const sections = parseChordPro('{start_of_verse: Strophe 1}\nText [C]hier\n{end_of_verse}');
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ type: 'verse', label: 'Strophe 1' });
    expect(sections[0].lines).toEqual(['Text [C]hier']);
  });

  it('liest die Kurzform {chorus: 2}', () => {
    const sections = parseChordPro('{chorus: 2}\nRefrain-Zeile');
    expect(sections[0]).toMatchObject({ type: 'chorus', label: '2' });
  });

  it('normalisiert Bindestriche im Typ (pre-chorus -> pre_chorus)', () => {
    const sections = parseChordPro('{pre-chorus}\nZeile');
    expect(sections[0].type).toBe('pre_chorus');
  });
});

describe('parseChordPro – SongSelect-Dialekt', () => {
  it('leitet aus {comment: …} den Abschnittstyp ab', () => {
    const sections = parseChordPro('{comment: Vers 1}\nZeile');
    expect(sections[0]).toMatchObject({ type: 'verse', label: 'Vers 1' });
  });

  it('erkennt deutsche und englische Labels', () => {
    expect(parseChordPro('{comment: Refrain}\nx')[0].type).toBe('chorus');
    expect(parseChordPro('{comment: Bridge}\nx')[0].type).toBe('bridge');
    expect(parseChordPro('{comment: Pre-Chorus}\nx')[0].type).toBe('pre_chorus');
  });
});

describe('parseChordPro – Sonderfälle', () => {
  it('öffnet einen impliziten Vers ohne Abschnitts-Direktive', () => {
    const sections = parseChordPro('Einfach Text\nZweite Zeile');
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ type: 'verse', label: '' });
    expect(sections[0].lines).toEqual(['Einfach Text', 'Zweite Zeile']);
  });

  it('überspringt Metadaten-Direktiven', () => {
    const sections = parseChordPro('{title: Lied}\n{key: G}\nInhalt');
    expect(sections).toHaveLength(1);
    expect(sections[0].lines).toEqual(['Inhalt']);
  });

  it('verwirft leere Abschnitte und entfernt nachlaufende Leerzeilen', () => {
    const sections = parseChordPro('{start_of_verse}\n{end_of_verse}\n{chorus}\nZeile\n\n');
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe('chorus');
    expect(sections[0].lines).toEqual(['Zeile']);
  });
});

describe('parseMetadata', () => {
  it('liest bekannte Metadaten-Felder', () => {
    const meta = parseMetadata('{title: Amazing Grace}\n{key: G}\n{ccli: 12345}');
    expect(meta).toEqual({ title: 'Amazing Grace', key: 'G', ccli: '12345' });
  });

  it('ignoriert unbekannte Direktiven', () => {
    const meta = parseMetadata('{foo: bar}\n{title: X}');
    expect(meta).toEqual({ title: 'X' });
  });
});

describe('Weiterschalt-Punkt ---- (#606)', () => {
  it('erscheint nicht als Text, die Stelle wird gemerkt', () => {
    const [vers] = parseChordPro('{comment: Vers 1}\nZeile 1\nZeile 2\n----\nZeile 3\nZeile 4');
    expect(vers.lines).toEqual(['Zeile 1', 'Zeile 2', 'Zeile 3', 'Zeile 4']);
    expect(vers.umbrueche).toEqual([2]);
  });

  it('auch mit mehr Strichen und Leerraum drumherum', () => {
    const [vers] = parseChordPro('{comment: Vers}\nA\n   ------   \nB');
    expect(vers.umbrueche).toEqual([1]);
  });

  it('am Anfang oder Ende eines Teils trennt er nichts – und fällt weg', () => {
    const [vers] = parseChordPro('{comment: Vers}\n----\nA\nB\n----\n');
    expect(vers.lines).toEqual(['A', 'B']);
    expect(vers.umbrueche).toBeUndefined();
  });

  it('drei Bindestriche sind normaler Text', () => {
    const [vers] = parseChordPro('{comment: Vers}\nA\n---\nB');
    expect(vers.lines).toEqual(['A', '---', 'B']);
  });
});

describe('teileImFlow – {flow: …} (#606)', () => {
  const TEXT = [
    '{flow: Intro, Vers 1, Chorus 1, Vers 2, Chorus 1, Outro}',
    '{comment: Intro}',
    '[C]',
    '{comment: Vers 1}',
    'V1',
    '{comment: Vers 2}',
    'V2',
    '{comment: Chorus 1}',
    'C1',
    '{comment: Bridge}',
    'B',
    '{comment: Outro}',
    'O',
  ].join('\n');

  it('liest die Flow-Zeile als Angabe', () => {
    expect(parseMetadata(TEXT).flow).toBe('Intro, Vers 1, Chorus 1, Vers 2, Chorus 1, Outro');
  });

  it('ordnet nach dem Flow, wiederholt voll, lässt Nicht-Genanntes weg', () => {
    const { teile, unbekannt } = teileImFlow(parseChordPro(TEXT), parseMetadata(TEXT).flow);
    expect(teile.map((t) => t.label)).toEqual([
      'Intro',
      'Vers 1',
      'Chorus 1',
      'Vers 2',
      'Chorus 1',
      'Outro',
    ]);
    expect(teile.map((t) => t.label)).not.toContain('Bridge');
    expect(unbekannt).toEqual([]);
  });

  it('jeder Teil behält seine Stelle im Original (daran hängt die Abschnitts-Transponierung)', () => {
    const { teile } = teileImFlow(parseChordPro(TEXT), parseMetadata(TEXT).flow);
    expect(teile.map((t) => t.index)).toEqual([0, 1, 3, 2, 3, 5]);
  });

  it('Groß-/Kleinschreibung und Leerzeichen zählen nicht', () => {
    const { teile } = teileImFlow(parseChordPro(TEXT), 'vers  1 ,CHORUS 1');
    expect(teile.map((t) => t.label)).toEqual(['Vers 1', 'Chorus 1']);
  });

  it('meldet Namen ohne Teil – einmal je Name', () => {
    const { teile, unbekannt } = teileImFlow(parseChordPro(TEXT), 'Vers 1, Refrain, Refrain, Coda');
    expect(teile.map((t) => t.label)).toEqual(['Vers 1']);
    expect(unbekannt).toEqual(['Refrain', 'Coda']);
  });

  it('passt KEIN Name, bleibt alles wie im Text – ein vertippter Flow macht das Blatt nicht leer', () => {
    const { teile, unbekannt, flow } = teileImFlow(parseChordPro(TEXT), 'Refrain');
    expect(teile).toHaveLength(6);
    expect(unbekannt).toEqual(['Refrain']);
    expect(flow).toEqual([]);
  });

  it('ohne Flow: alle Teile in Original-Reihenfolge', () => {
    const { teile, flow } = teileImFlow(parseChordPro(TEXT), undefined);
    expect(teile.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(flow).toEqual([]);
  });
});

describe('flowEinfuegen – wohin der Editor die Flow-Zeile setzt (#606)', () => {
  it('nach den allgemeinen Angaben, vor dem ersten Teil, vorbefüllt mit den Teilen', () => {
    const text = '{title: Treu}\n{key: E}\n\n{comment: Vers}\nA\n{comment: Chorus}\nB';
    const z = flowEinfuegen(text);
    expect(z).toEqual({
      vorhanden: false,
      pos: text.indexOf('{comment: Vers}'),
      zeile: '{flow: Vers, Chorus}',
    });
  });

  it('auch vor Standard-Abschnitten und vor Liedzeilen ohne Überschrift', () => {
    expect(flowEinfuegen('{title: X}\n{start_of_verse: V1}\nA').pos).toBe(11);
    expect(flowEinfuegen('{title: X}\nGleich Text').pos).toBe(11);
  });

  it('gibt es schon eine Flow-Zeile, wird keine zweite eingefügt', () => {
    const text = '{title: X}\n{flow: Vers}\n{comment: Vers}\nA';
    expect(flowEinfuegen(text)).toEqual({ vorhanden: true, pos: 11 });
  });
});

describe('flowSetzen – Ablauf aus den Kärtchen in den Text (Lied-Editor L2)', () => {
  /** Die Änderung anwenden – so, wie der Editor es tut. */
  function anwenden(text: string, eintraege: string[]): string {
    const a = flowSetzen(text, eintraege);
    return a ? text.slice(0, a.from) + a.insert + text.slice(a.to) : text;
  }
  const LIED = '{title: X}\n{key: G}\n\n{comment: Vers 1}\nA\n\n{comment: Refrain}\nB';

  it('ohne Flow-Zeile: kommt nach den Kopfangaben – und wirkt wie gewünscht', () => {
    const neu = anwenden(LIED, ['Refrain', 'Vers 1', 'Refrain']);
    expect(neu).toContain('{key: G}\n\n{flow: Refrain, Vers 1, Refrain}\n{comment: Vers 1}');
    expect(teileImFlow(parseChordPro(neu), parseMetadata(neu).flow).flow).toEqual([
      'Refrain',
      'Vers 1',
      'Refrain',
    ]);
  });

  it('mit Flow-Zeile: genau diese Zeile wird ersetzt, sonst nichts', () => {
    const alt = anwenden(LIED, ['Vers 1', 'Refrain']);
    const neu = anwenden(alt, ['Refrain']);
    expect(neu).toBe(alt.replace('{flow: Vers 1, Refrain}', '{flow: Refrain}'));
  });

  it('leer = „wie im Text": die Zeile fällt samt Zeilenende weg – der Text ist wie vorher', () => {
    const mit = anwenden(LIED, ['Refrain', 'Vers 1']);
    expect(anwenden(mit, [])).toBe(LIED);
  });

  it('Flow-Zeile ganz am Ende: weg ohne Leerzeile', () => {
    expect(anwenden('A\n{flow: Vers 1}', [])).toBe('A');
  });

  it('nichts zu tun: null', () => {
    expect(flowSetzen(LIED, [])).toBeNull();
    const mit = anwenden(LIED, ['Vers 1']);
    expect(flowSetzen(mit, ['Vers 1'])).toBeNull();
  });
});

describe('akkordeImText (L5)', () => {
  it('häufigste zuerst, Direktiven zählen nicht, jeder Akkord einmal', () => {
    const text =
      '{title: [X]}\n{comment: Vers}\n[G]Ein [D]Lied [G]heute\n{comment: Chorus}\n[Em7]la [G]la';
    expect(akkordeImText(text)).toEqual(['G', 'D', 'Em7']);
  });
});

describe('akkordVerschieben (L5-2)', () => {
  /** Wendet die gelieferte Änderung an – so, wie der Editor es tut. */
  function schieben(text: string, akkord: string, richtung: -1 | 1) {
    const von = text.indexOf(akkord);
    const a = akkordVerschieben(text, von, von + akkord.length, richtung);
    if (!a) return null;
    const neu = text.slice(0, a.from) + a.insert + text.slice(a.to);
    expect(neu.slice(a.neuVon, a.neuVon + akkord.length)).toBe(akkord);
    return neu;
  }
  it('tauscht mit dem Nachbarzeichen', () => {
    expect(schieben('Du [E]bleibst', '[E]', 1)).toBe('Du b[E]leibst');
    expect(schieben('Du [E]bleibst', '[E]', -1)).toBe('Du[E] bleibst');
  });
  it('springt über einen Nachbar-Akkord ganz hinweg', () => {
    expect(schieben('a[E][F#m7]b', '[E]', 1)).toBe('a[F#m7][E]b');
    expect(schieben('a[E][F#m7]b', '[F#m7]', -1)).toBe('a[F#m7][E]b');
  });
  it('nicht über den Zeilenrand', () => {
    expect(schieben('Zeile eins\n[E]zwei', '[E]', -1)).toBeNull();
    expect(schieben('eins[E]\nzwei', '[E]', 1)).toBeNull();
    expect(schieben('[E]', '[E]', 1)).toBeNull();
  });
});
