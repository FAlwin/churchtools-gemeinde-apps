import { describe, expect, it } from 'vitest';
import { COLORS_DARK_MODE_DEFAULT, COLORS_DEFAULT } from '@blocknote/core';
import {
  EIGENE_HINTERGRUENDE,
  farbWert,
  MARKIER_FARBEN,
  MARKIERT_PAPIER,
  papierFarbe,
} from './farben';

/**
 * K3a: Leiste, Lese-Ansicht (und später das PDF) färben wie der Editor – gegen BlockNote geprüft. Dass der Editor-Stil
 * dieselben Abweichungen hat, prüft `ui/design/markierFarben.test.ts` (liest Quelltexte; hier gibt es kein `node:fs`).
 */
describe('Markier-Farben (K3a)', () => {
  it('alle neun Farben des Editors, deutsch benannt, in BlockNotes Reihenfolge', () => {
    expect(MARKIER_FARBEN.map((f) => f.titel)).toEqual([
      'Grau',
      'Braun',
      'Rot',
      'Orange',
      'Gelb',
      'Grün',
      'Blau',
      'Lila',
      'Rosa',
    ]);
    expect(MARKIER_FARBEN.map((f) => f.name)).toEqual(Object.keys(COLORS_DEFAULT));
  });

  it('Werte aus BlockNotes Tabellen, hell und dunkel – außer den eigenen Hintergründen', () => {
    for (const { name } of MARKIER_FARBEN) {
      expect(farbWert(name, 'schrift', 'light')).toBe(COLORS_DEFAULT[name].text);
      expect(farbWert(name, 'schrift', 'dark')).toBe(COLORS_DARK_MODE_DEFAULT[name].text);
      const eigen = EIGENE_HINTERGRUENDE[name];
      expect(farbWert(name, 'hintergrund', 'light')).toBe(eigen ?? COLORS_DEFAULT[name].background);
      expect(farbWert(name, 'hintergrund', 'dark')).toBe(
        eigen ?? COLORS_DARK_MODE_DEFAULT[name].background,
      );
    }
  });

  it('„keine“, Unbekanntes und Fremdes: keine Farbe', () => {
    for (const x of ['default', '', 'neonpink', 'toString', '__proto__', undefined, 3])
      expect(farbWert(x, 'hintergrund', 'light')).toBeUndefined();
  });
});

describe('Farben im PDF (S6-3a)', () => {
  it('dieselben Farben wie auf dem hellen Blatt, als Rot/Grün/Blau; Gelb als Hintergrund = Textmarker', () => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    for (const { name } of MARKIER_FARBEN) {
      expect(papierFarbe(name, 'schrift')).toEqual(rgb(COLORS_DEFAULT[name].text));
      expect(papierFarbe(name, 'hintergrund')).toEqual(
        EIGENE_HINTERGRUENDE[name] ? MARKIERT_PAPIER : rgb(COLORS_DEFAULT[name].background),
      );
    }
  });

  it('„keine“ und Unbekanntes: keine Farbe', () => {
    for (const x of ['default', 'neonpink', undefined])
      expect(papierFarbe(x, 'schrift')).toBeNull();
  });
});
