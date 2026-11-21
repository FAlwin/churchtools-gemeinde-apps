import { describe, expect, it } from 'vitest';
import {
  anzahlInfo,
  artDesTextes,
  ausgeblendet,
  dokumentHatInfo,
  INFO_ZEICHEN,
  mitArt,
  ohneKennzeichen,
  praefix,
  UNTER_ZEICHEN,
  umschalten,
  zeilenArten,
} from './tabellenZeile';
import type { Block } from './dokument';

describe('Kennzeichen einer Tabellenzeile (W13)', () => {
  it('die Reihenfolge steht an einer Stelle: erst ↳, dann ⓘ', () => {
    expect(praefix({ unter: true, info: true })).toBe(`${UNTER_ZEICHEN} ${INFO_ZEICHEN} `);
    expect(praefix({ unter: false, info: true })).toBe(`${INFO_ZEICHEN} `);
    expect(praefix({ unter: false, info: false })).toBe('');
  });

  it('liest das Präfix – nur in der festen Reihenfolge und mit Leerzeichen', () => {
    expect(artDesTextes('↳ ⓘ 17.04.')).toEqual({ art: { unter: true, info: true }, laenge: 4 });
    expect(artDesTextes('ⓘ 17.04.').art).toEqual({ unter: false, info: true });
    expect(artDesTextes('↳ 17.04.').art).toEqual({ unter: true, info: false });
    expect(artDesTextes('17.04. ⓘ').laenge).toBe(0);
    expect(artDesTextes('ⓘ↳ 17.04.').art.unter).toBe(false);
    expect(artDesTextes('ⓘ17.04.').laenge).toBe(0);
  });

  it('umschalten setzt und nimmt weg, das andere Kennzeichen bleibt', () => {
    expect(umschalten('17.04.', 'info')).toBe('ⓘ 17.04.');
    expect(umschalten('ⓘ 17.04.', 'unter')).toBe('↳ ⓘ 17.04.');
    expect(umschalten('↳ ⓘ 17.04.', 'info')).toBe('↳ 17.04.');
    expect(umschalten('↳ 17.04.', 'unter')).toBe('17.04.');
    expect(umschalten('', 'unter')).toBe('↳ ');
  });

  it('mitArt ersetzt die alten Kennzeichen statt sie zu verdoppeln', () => {
    expect(mitArt('↳ ⓘ 17.04.', { unter: true, info: false })).toBe('↳ 17.04.');
    expect(mitArt('x', { unter: true, info: true })).toBe('↳ ⓘ x');
  });

  it('ohneKennzeichen schneidet das Präfix aus dem Inhalt – auch über Textstücke, ohne den Eingang zu ändern', () => {
    const inhalt = [
      { type: 'text', text: '↳ ', styles: {} },
      { type: 'text', text: 'ⓘ 17', styles: { bold: true } },
      { type: 'text', text: '.04.', styles: {} },
    ];
    const r = ohneKennzeichen(inhalt);
    expect(r.art).toEqual({ unter: true, info: true });
    expect(r.inhalt).toEqual([
      { type: 'text', text: '17', styles: { bold: true } },
      { type: 'text', text: '.04.', styles: {} },
    ]);
    expect(inhalt[0].text).toBe('↳ ');
  });

  it('ohneKennzeichen: ohne Präfix und bei Nicht-Listen bleibt alles, wie es ist', () => {
    const inhalt = [{ type: 'text', text: '17.04.', styles: {} }];
    expect(ohneKennzeichen(inhalt)).toEqual({ art: { unter: false, info: false }, inhalt });
    expect(ohneKennzeichen('x')).toEqual({ art: { unter: false, info: false }, inhalt: 'x' });
  });

  it('ohneKennzeichen: Präfix allein ergibt einen leeren Inhalt', () => {
    expect(ohneKennzeichen([{ type: 'text', text: 'ⓘ ', styles: {} }]).inhalt).toEqual([]);
  });

  it('zeilenArten liest die erste Zelle jeder Zeile; anzahlInfo zählt nur Info', () => {
    const z = (t: string) => [{ inhalt: [{ type: 'text', text: t, styles: {} }] }, { inhalt: [] }];
    const arten = zeilenArten([z('a'), z('ⓘ b'), z('↳ c'), z('↳ ⓘ d')]);
    expect(arten.map((a) => [a.unter, a.info])).toEqual([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]);
    expect(anzahlInfo(arten)).toBe(2);
    expect(zeilenArten([[]])).toEqual([{ unter: false, info: false }]);
  });

  it('dokumentHatInfo findet Info-Zeilen auch in einer Tabelle unter einem Absatz – und sonst nichts', () => {
    const tab = (...erste: string[]): Block => ({
      id: 't',
      type: 'table',
      content: {
        type: 'tableContent',
        rows: erste.map((e) => ({ cells: [[{ type: 'text', text: e, styles: {} }]] })),
      },
      children: [],
    });
    const absatz = (...kinder: Block[]): Block => ({
      id: 'p',
      type: 'paragraph',
      content: [],
      children: kinder,
    });
    expect(dokumentHatInfo([])).toBe(false);
    expect(dokumentHatInfo([tab('a', '↳ b')])).toBe(false);
    expect(dokumentHatInfo([tab('a', 'ⓘ b')])).toBe(true);
    expect(dokumentHatInfo([absatz(absatz(tab('ⓘ x')))])).toBe(true);
    expect(dokumentHatInfo([absatz(tab('x'))])).toBe(false);
  });
});

describe('ausgeblendet – „Nur Themen dieses Treffens“', () => {
  const z = (info: boolean, unter: boolean) => ({ info, unter });
  it('Info-Zeilen und ihre Unterzeilen gehen weg, Unterzeilen anderer Zeilen bleiben', () => {
    expect(
      ausgeblendet([
        z(false, false),
        z(true, false),
        z(false, true),
        z(true, true),
        z(false, false),
        z(false, true),
      ]),
    ).toEqual([false, true, true, true, false, false]);
  });
  it('eine Unterzeile mit ⓘ unter einer normalen Zeile geht allein weg; ihre Nachbarn bleiben', () => {
    expect(ausgeblendet([z(false, false), z(false, true), z(true, true), z(false, true)])).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });
  it('ohne Info nichts', () => {
    expect(ausgeblendet([z(false, false), z(false, true)])).toEqual([false, false]);
  });
});
