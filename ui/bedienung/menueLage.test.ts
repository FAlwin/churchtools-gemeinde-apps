import { describe, expect, it } from 'vitest';
import { listenScroll, menueVersatz, menueVersatzRechts } from './menueLage';

describe('menueVersatz', () => {
  it('passt es, bleibt es; ragt es rechts hinaus, rückt es genau so weit nach links', () => {
    expect(menueVersatz(20, 320, 1280)).toBe(0);
    expect(menueVersatz(104, 320, 375)).toBe(-65);
  });
  it('links bleibt der Rand frei, auch wenn es dann rechts nicht ganz reicht', () => {
    expect(menueVersatz(30, 400, 375)).toBe(-14);
    expect(menueVersatz(10, 400, 375)).toBe(-0);
  });
});

describe('menueVersatzRechts (Menü hängt rechts am Knopf)', () => {
  it('passt es, bleibt es; ragt es links hinaus, rückt es genau bis an den Rand nach rechts', () => {
    expect(menueVersatzRechts(23, 230, 375)).toBe(0);
    // „Sortieren“ am Handy (gemessen 18.11.2026): Menü von -42 bis 188 → 58 nach rechts, links 16 frei.
    expect(menueVersatzRechts(-42, 230, 375)).toBe(58);
  });
  it('rechts bleibt der Rand frei, auch wenn es dann links nicht ganz reicht', () => {
    expect(menueVersatzRechts(-42, 380, 375)).toBe(21);
    expect(menueVersatzRechts(-42, 420, 375)).toBe(0);
  });
});

describe('listenScroll', () => {
  it('scrollt nur, wenn die Zeile oben oder unten aus dem Bild ragt', () => {
    expect(listenScroll(100, 300, 150, 30)).toBe(100); // ganz zu sehen
    expect(listenScroll(100, 300, 80, 30)).toBe(80); // ragt oben hinaus
    expect(listenScroll(100, 300, 390, 30)).toBe(120); // ragt unten hinaus
  });
});
