// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockInhalt, griffVersatz } from './griffLage';

/** Wo der Griff steht (K1) – Aufbau wie im Editor, Lagen von Hand (jsdom rechnet kein Layout). */

const rechteck = (top: number, height: number) =>
  ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top }) as DOMRect;

/** Ein Block wie BlockNote ihn baut – eigene Blöcke mit einer Hülle mehr, Unterpunkte in einer eigenen Gruppe. */
function block(id: string, html: string, huelle = false): HTMLElement {
  const aussen = document.createElement('div');
  aussen.className = 'bn-block-outer';
  aussen.dataset.id = id;
  const inhalt = `<div class="bn-block-content">${html}</div>`;
  aussen.innerHTML = `<div class="bn-block">${
    huelle ? `<div class="bn-react-node-view-renderer">${inhalt}</div>` : inhalt
  }<div class="bn-block-group"><div class="bn-block-outer" data-id="${id}-kind"><div class="bn-block"><div class="bn-block-content"><p class="bn-inline-content">Kind</p></div></div></div></div></div>`;
  document.body.appendChild(aussen);
  return aussen;
}

/** Lage der ersten Textzeile – jsdom kennt `Range.getClientRects` nicht, also hier gesetzt. */
const zeileBei = (r: DOMRect) =>
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [r],
  });

beforeEach(() => {
  vi.stubGlobal('CSS', { escape: (s: string) => s });
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
});

describe('blockInhalt', () => {
  it('findet den eigenen Inhalt – nicht den des Unterpunkts', () => {
    block('h', '<h1 class="bn-inline-content">Punkt</h1>');
    expect(blockInhalt(document, 'h')?.textContent).toBe('Punkt');
  });

  it('auch bei eigenen Blöcken mit Hülle (Aufgabe, Termin, feste Punkte) – beim Durchklicken gefunden', () => {
    block('a', '<span>Wer?</span><p class="bn-inline-content">Beamer</p>', true);
    expect(blockInhalt(document, 'a')?.textContent).toBe('Wer?Beamer');
  });

  it('unbekannter Block: nichts', () => {
    expect(blockInhalt(document, 'weg')).toBeNull();
  });
});

describe('griffVersatz', () => {
  it('rückt die Mitte des Griffs auf die Mitte der ersten Textzeile', () => {
    block('h', '<h1 class="bn-inline-content">Punkt</h1>');
    const inhalt = blockInhalt(document, 'h')!;
    vi.spyOn(inhalt, 'getBoundingClientRect').mockReturnValue(rechteck(100, 40));
    zeileBei(rechteck(112, 24));
    // Zeilenmitte 124 → 24 unter der Oberkante; Griff 30 hoch → 24 − 15 = 9
    expect(griffVersatz(inhalt, 30)).toBe(9);
  });

  it('ohne Text: die (leere) Textzeile des Blocks', () => {
    block('h', '<h1 class="bn-inline-content"></h1>');
    const inhalt = blockInhalt(document, 'h')!;
    vi.spyOn(inhalt, 'getBoundingClientRect').mockReturnValue(rechteck(100, 40));
    vi.spyOn(inhalt.querySelector('.bn-inline-content')!, 'getBoundingClientRect').mockReturnValue(
      rechteck(112, 24),
    );
    expect(griffVersatz(inhalt, 30)).toBe(9);
  });

  it('nie nach oben, und ohne Block oder Zeile gar nicht', () => {
    block('p', '<p class="bn-inline-content">x</p>');
    const inhalt = blockInhalt(document, 'p')!;
    vi.spyOn(inhalt, 'getBoundingClientRect').mockReturnValue(rechteck(100, 20));
    zeileBei(rechteck(100, 10));
    expect(griffVersatz(inhalt, 30)).toBe(0);
    expect(griffVersatz(null, 30)).toBe(0);
  });
});
