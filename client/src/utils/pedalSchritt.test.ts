import { describe, expect, it } from 'vitest';
import { pedalZiel } from './pedalSchritt';
import { SCHRITT_ANTEIL } from './scrollPosition';

/** Bildschirm 600 px hoch; ⅔ davon aus derselben Konstante wie die App. */
const H = 600;
const SCHRITT = Math.round(H * SCHRITT_ANTEIL);

describe('pedalZiel – Teil für Teil (#609)', () => {
  it('vorwärts: die nächste Halte-Stelle, wenn sie schon zu sehen ist', () => {
    expect(pedalZiel(0, H, [0, 250, 900], 1)).toBe(250);
    // genau am unteren Rand zählt noch als sichtbar
    expect(pedalZiel(300, H, [0, 900], 1)).toBe(900);
  });

  it('vorwärts: ist der Teil länger als der Bildschirm, erst ⅔ – nichts wird übersprungen', () => {
    expect(pedalZiel(0, H, [0, 1500], 1)).toBe(SCHRITT);
    expect(pedalZiel(SCHRITT, H, [0, 1500], 1)).toBe(2 * SCHRITT);
  });

  it('vorwärts: wo man schon steht, ist keine Halte-Stelle (Rundung beim Scrollen)', () => {
    expect(pedalZiel(249, H, [0, 250, 700], 1)).toBe(700);
  });

  it('ohne Halte-Stellen (hochgeladenes PDF): ⅔ wie bisher, in beide Richtungen', () => {
    expect(pedalZiel(1000, H, [], 1)).toBe(1000 + SCHRITT);
    expect(pedalZiel(1000, H, [], -1)).toBe(1000 - SCHRITT);
  });

  it('zurück: an den Anfang des aktuellen Teils, steht man mittendrin', () => {
    expect(pedalZiel(400, H, [0, 250, 900], -1)).toBe(250);
  });

  it('zurück: steht man am Teil-Anfang, zum vorigen', () => {
    expect(pedalZiel(250, H, [0, 250, 900], -1)).toBe(0);
  });

  it('zurück: liegt der Anfang mehr als einen Bildschirm oben, erst ⅔ – und nie unter 0', () => {
    expect(pedalZiel(2000, H, [0, 250], -1)).toBe(2000 - SCHRITT);
    expect(pedalZiel(100, H, [], -1)).toBe(0);
  });
});
