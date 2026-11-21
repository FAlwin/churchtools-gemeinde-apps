// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { praefix } from '@shared/protokolle/tabellenZeile';
import { cursorIn, editorMit, tabelle, taste, zellen } from './tabellenTest.testutil';
import { KLASSE, ersteZelleDerZeile, zeileUmschalten, zeilenDekoration } from './tabellenZeile';

const unter = (t: string) => `${praefix({ unter: true, info: false })}${t}`;
const info = (t: string) => `${praefix({ unter: false, info: true })}${t}`;

const zelleMit = (e: ReturnType<typeof editorMit>) =>
  e.prosemirrorState.selection.$head.parent.textContent;

describe('Tab und Umschalt+Tab in der ersten Zelle einer Zeile (W13)', () => {
  it('Tab am Anfang der ersten Zelle setzt „↳ “ – der Cursor steht dahinter, nicht in der nächsten Zelle', () => {
    const e = editorMit([tabelle(['17.04.', 'Was'], ['18.04.', 'Wann'])]);
    cursorIn(e, '17.04.', 0);
    taste(e, 'Tab');
    expect(zellen(e)[0]).toEqual([unter('17.04.'), 'Was']);
    expect(e.prosemirrorState.selection.$head.parentOffset).toBe(
      praefix({ unter: true, info: false }).length,
    );
    expect(zelleMit(e)).toBe(unter('17.04.'));
  });

  it('steht der Cursor im Präfix („ⓘ| “), landet er nach Tab hinter dem neuen Präfix', () => {
    const e = editorMit([tabelle([info('17.04.'), 'Was'])]);
    cursorIn(e, info('17.04.'), 1);
    taste(e, 'Tab');
    const neu = praefix({ unter: true, info: true });
    expect(zellen(e)[0][0]).toBe(`${neu}17.04.`);
    expect(e.prosemirrorState.selection.$head.parentOffset).toBe(neu.length);
  });

  it('Umschalt+Tab dort nimmt es wieder weg – gleich nach dem Tab und auch am Zellanfang', () => {
    const e = editorMit([tabelle(['17.04.', 'Was'])]);
    cursorIn(e, '17.04.', 0);
    taste(e, 'Tab');
    taste(e, 'Tab', true);
    expect(zellen(e)[0][0]).toBe('17.04.');
    const f = editorMit([tabelle([unter('17.04.'), 'Was'])]);
    cursorIn(f, unter('17.04.'), 0);
    taste(f, 'Tab', true);
    expect(zellen(f)[0][0]).toBe('17.04.');
  });

  it('das andere Kennzeichen bleibt: „ⓘ “ + Tab = „↳ ⓘ “, Umschalt+Tab zurück', () => {
    const e = editorMit([tabelle([info('17.04.'), 'Was'])]);
    cursorIn(e, info('17.04.'), 0);
    taste(e, 'Tab');
    expect(zellen(e)[0][0]).toBe(`${praefix({ unter: true, info: true })}17.04.`);
    taste(e, 'Tab', true);
    expect(zellen(e)[0][0]).toBe(info('17.04.'));
  });

  it('Ist die Zeile schon eine Unterzeile, springt Tab weiter in die nächste Zelle (wie bisher)', () => {
    const e = editorMit([tabelle([unter('17.04.'), 'Was'])]);
    cursorIn(e, unter('17.04.'), 0);
    taste(e, 'Tab');
    expect(zellen(e)[0][0]).toBe(unter('17.04.'));
    expect(zelleMit(e)).toBe('Was');
  });

  it('Tab mitten oder am Ende des Textes springt wie bisher – setzt nichts', () => {
    const e = editorMit([tabelle(['17.04.', 'Was'])]);
    cursorIn(e, '17.04.', 3);
    taste(e, 'Tab');
    expect(zellen(e)[0][0]).toBe('17.04.');
    expect(zelleMit(e)).toBe('Was');
  });

  it('Tab am Anfang einer ZWEITEN Zelle setzt nichts – nur die erste Zelle einer Zeile', () => {
    const e = editorMit([tabelle(['a', 'Was', 'Wer'], ['b', 'c', 'd'])]);
    cursorIn(e, 'Was', 0);
    taste(e, 'Tab');
    expect(zellen(e)[0]).toEqual(['a', 'Was', 'Wer']);
    expect(zelleMit(e)).toBe('Wer');
  });

  it('Umschalt+Tab ohne Unterzeile springt wie bisher zurück', () => {
    const e = editorMit([tabelle(['a', 'b'], ['17.04.', 'Was'])]);
    cursorIn(e, '17.04.', 0);
    taste(e, 'Tab', true);
    expect(zellen(e)[1][0]).toBe('17.04.');
    expect(zelleMit(e)).toBe('b');
  });

  it('eine leere erste Zelle: Tab springt weiter (so kommt man durch eine neue Zeile)', () => {
    const e = editorMit([tabelle(['', 'Was'])]);
    const start = ersteZelleDerZeile(e.prosemirrorState, 't', 0)!.start;
    e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, start)));
    taste(e, 'Tab');
    expect(zellen(e)[0][0]).toBe('');
    expect(zelleMit(e)).toBe('Was');
  });

  it('Tab außerhalb von Tabellen bleibt Sache von einrückenTasten – wir greifen nicht ein', () => {
    const e = editorMit([
      { id: 'a', type: 'paragraph', content: 'eins' },
      { id: 'b', type: 'paragraph', content: 'zwei' },
    ]);
    e.setTextCursorPosition('b', 'start');
    taste(e, 'Tab');
    expect(e.document[0].children?.map((k) => k.id)).toEqual(['b']);
  });
});

describe('Zeile umschalten (Zeilenmenü)', () => {
  it('setzt und nimmt weg, je Kennzeichen, nur an dieser Zeile; Rückgängig macht es zurück', () => {
    const e = editorMit([tabelle(['a', 'x'], ['b', 'y'], ['c', 'z'])]);
    expect(zeileUmschalten(e, 't', 1, 'info')).toBe(true);
    expect(zellen(e).map((z) => z[0])).toEqual(['a', info('b'), 'c']);
    expect(zeileUmschalten(e, 't', 1, 'unter')).toBe(true);
    expect(zellen(e)[1][0]).toBe(`${praefix({ unter: true, info: true })}b`);
    expect(zeileUmschalten(e, 't', 1, 'info')).toBe(false);
    expect(zellen(e)[1][0]).toBe(unter('b'));
    e.undo(); // schnell hintereinander = ein Schritt im Verlauf
    expect(zellen(e)[1][0]).toBe('b');
  });

  it('eine Zeile, die es nicht gibt, ändert nichts', () => {
    const e = editorMit([tabelle(['a', 'x'])]);
    expect(zeileUmschalten(e, 't', 5, 'info')).toBe(false);
    expect(zeileUmschalten(e, 'gibtsnicht', 0, 'info')).toBe(false);
    expect(zellen(e)).toEqual([['a', 'x']]);
  });

  it('die Auszeichnung des Zelltextes bleibt, nur der Anfang ändert sich', () => {
    const e = editorMit([
      {
        id: 't',
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [{ cells: [[{ type: 'text', text: 'fett', styles: { bold: true } }], ['x']] }],
        },
      },
    ]);
    zeileUmschalten(e, 't', 0, 'info');
    const c = (
      e.document[0].content as unknown as {
        rows: { cells: { content: { text: string; styles: object }[] }[] }[];
      }
    ).rows[0].cells[0].content;
    expect(c.map((s) => s.text).join('')).toBe(info('fett'));
    expect(c.find((s) => s.text.includes('fett'))?.styles).toEqual({ bold: true });
  });
});

describe('Darstellung im Editor (Dekoration)', () => {
  it('Zeilen mit Kennzeichen bekommen Klassen, ihre Zeichen auch – andere Zeilen nichts', () => {
    const e = editorMit([
      tabelle(
        ['a', 'x'],
        [unter('b'), 'y'],
        [info('c'), 'z'],
        [`${praefix({ unter: true, info: true })}d`, 'w'],
      ),
    ]);
    const zeilen = [...e._tiptapEditor.view.dom.querySelectorAll('tr')].map((r) => r.className);
    expect(zeilen[0]).toBe('');
    expect(zeilen[1]).toBe(KLASSE.unterZeile);
    expect(zeilen[2]).toBe(KLASSE.infoZeile);
    expect(zeilen[3]).toBe(`${KLASSE.unterZeile} ${KLASSE.infoZeile}`);
    const dom = e._tiptapEditor.view.dom;
    expect(dom.querySelectorAll(`.${KLASSE.unterZeichen}`).length).toBe(2);
    expect(dom.querySelectorAll(`.${KLASSE.infoZeichen}`).length).toBe(2);
    expect(dom.querySelector(`.${KLASSE.unterZeichen}`)?.textContent).toBe('↳ ');
    expect(dom.querySelector(`.${KLASSE.infoZeichen}`)?.textContent).toBe('ⓘ ');
  });

  it('folgt dem Text: Präfix getippt oder weggenommen ändert die Klasse', () => {
    const e = editorMit([tabelle(['a', 'x'])]);
    const dom = e._tiptapEditor.view.dom;
    expect(dom.querySelectorAll(`.${KLASSE.unterZeile}`).length).toBe(0);
    zeileUmschalten(e, 't', 0, 'unter');
    expect(dom.querySelectorAll(`.${KLASSE.unterZeile}`).length).toBe(1);
    zeileUmschalten(e, 't', 0, 'unter');
    expect(dom.querySelectorAll(`.${KLASSE.unterZeile}`).length).toBe(0);
  });

  it('eine Tabelle ohne Kennzeichen: keine Dekoration', () => {
    const e = editorMit([tabelle(['a', 'x'])]);
    expect(zeilenDekoration(e.prosemirrorState.doc).find().length).toBe(0);
  });
});
