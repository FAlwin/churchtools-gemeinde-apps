// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resetRevealScrolls } from './useKeyboardInsets';

/** iOS scrollt beim Öffnen der Tastatur Vorfahren mit – das wird zurückgedreht. Aber nicht im Scroll-Modus. */
describe('resetRevealScrolls', () => {
  function baum() {
    const aussen = document.createElement('div');
    const scroller = document.createElement('div');
    const feld = document.createElement('span');
    scroller.appendChild(feld);
    aussen.appendChild(scroller);
    aussen.scrollTop = 0;
    Object.defineProperty(aussen, 'scrollTop', { value: 40, writable: true });
    Object.defineProperty(scroller, 'scrollTop', { value: 900, writable: true });
    return { aussen, scroller, feld };
  }

  it('dreht das Mitscrollen der Vorfahren zurück', () => {
    const { aussen, scroller, feld } = baum();
    resetRevealScrolls(feld);
    expect(scroller.scrollTop).toBe(0);
    expect(aussen.scrollTop).toBe(0);
  });

  it('ein Container, der absichtlich scrollt (Scroll-Modus, #608), behält seine Stelle', () => {
    const { aussen, scroller, feld } = baum();
    scroller.dataset.eigenerScroll = '';
    resetRevealScrolls(feld);
    expect(scroller.scrollTop).toBe(900);
    expect(aussen.scrollTop).toBe(0);
  });
});
