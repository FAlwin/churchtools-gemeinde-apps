// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { seiteNachOben } from './seiteNachOben';

describe('seiteNachOben', () => {
  it('scrollt sofort nach oben – ohne Animation, auch wenn die Seite `scroll-behavior: smooth` hat', () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true });
    seiteNachOben();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('schaltet das weiche Scrollen nur für den Aufruf ab und stellt es danach wieder her', () => {
    const html = document.documentElement;
    html.style.scrollBehavior = 'smooth';
    let waehrend = '';
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(() => {
        waehrend = html.style.scrollBehavior;
      }),
      configurable: true,
    });
    seiteNachOben();
    expect(waehrend).toBe('auto');
    expect(html.style.scrollBehavior).toBe('smooth');
    html.style.scrollBehavior = '';
  });
});
