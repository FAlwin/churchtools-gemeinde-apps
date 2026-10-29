// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardInsets } from './useKeyboardInsets';

/**
 * **Ohne Tastatur wird nichts angehoben – auch wenn `html` höher ist als das sichtbare Fenster** (29.10.2026).
 *
 * In der installierten App meldet iOS `innerHeight` mal 812, mal 874; `html` ist seitdem die volle Bildschirmhöhe (874,
 * `ui/fenster/appHeight.ts`). Gemessen gegen die Höhe von `html` sähe der Hook 874 − 812 = 62 px „Tastatur“ – über
 * seiner Schwelle (60) – und hübe den Akkord-Bereich an, obwohl keine Tastatur offen ist. Gemessen wird deshalb gegen
 * `grundHoehe()` (`innerHeight` bzw. die eingefrorene `--app-h`), im selben Maß wie `visualViewport`.
 */
describe('useKeyboardInsets – Grundhöhe', () => {
  const vorher = { inner: window.innerHeight, vv: window.visualViewport };
  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: vorher.inner, configurable: true });
    Object.defineProperty(window, 'visualViewport', { value: vorher.vv, configurable: true });
    document.documentElement.style.removeProperty('--app-h');
  });

  it('installierte App mit innerHeight 812, html 874: kein Anheben ohne Tastatur', () => {
    Object.defineProperty(window, 'innerHeight', { value: 812, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 874,
      configurable: true,
    });
    document.documentElement.style.setProperty('--app-h', '812px');
    const vv = {
      height: 812,
      offsetTop: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });

    const root = document.createElement('div');
    const feld = document.createElement('span');
    root.appendChild(feld);
    document.body.appendChild(root);
    // Das Feld liegt knapp über der Unterkante des sichtbaren Fensters – mit 62 px „Tastatur“ würde es angehoben.
    feld.getBoundingClientRect = () => ({ bottom: 805 }) as DOMRect;

    renderHook(() =>
      useKeyboardInsets({
        rootRef: { current: root },
        editRefs: { current: [feld, null] },
        anyPending: true,
        pendingSlot: 0,
      }),
    );
    expect(root.style.transform).toBe('');
    root.remove();
  });
});
