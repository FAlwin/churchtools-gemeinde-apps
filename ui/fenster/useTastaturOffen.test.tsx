// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { syncAppHeight } from './appHeight';
import {
  TASTATUR_AB_PX,
  schreibtGerade,
  tastaturHoehe,
  useTastaturOffen,
} from './useTastaturOffen';

/** Lied-Editor (23.10.2026): Schreibansicht nur bei offener Bildschirmtastatur. */
class Ansicht extends EventTarget {
  height = 800;
  offsetTop = 0;
}
const echt = Object.getOwnPropertyDescriptor(window, 'visualViewport');
afterEach(() => {
  if (echt) Object.defineProperty(window, 'visualViewport', echt);
  document.body.innerHTML = '';
});
/** Ein Feld mit Fokus – ohne das gibt es keine Tastatur (30.10.2026). */
function feld(art = 'text'): HTMLInputElement {
  const el = document.createElement('input');
  el.type = art;
  document.body.append(el);
  el.focus();
  return el;
}
function ansicht(): Ansicht {
  const vv = new Ansicht();
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return vv;
}

describe('tastaturHoehe', () => {
  it('Unterschied zwischen Fensterhöhe und sichtbarem Bereich, nie negativ', () => {
    feld();
    const vv = ansicht();
    vv.height = 420;
    expect(tastaturHoehe(vv as unknown as VisualViewport, 800)).toBe(380);
    vv.height = 900;
    expect(tastaturHoehe(vv as unknown as VisualViewport, 800)).toBe(0);
  });

  it('ohne Feld, in dem geschrieben wird, ist keine Tastatur offen – auch wenn iOS den Bereich noch klein meldet', () => {
    // Alwin am iPad (30.10.2026): iOS hielt die Höhe nach dem Schreiben klein, jedes Fenster sparte die Tastatur aus.
    const vv = ansicht();
    vv.height = 120;
    expect(tastaturHoehe(vv as unknown as VisualViewport, 800)).toBe(0);
    feld('checkbox'); // ein angetipptes Häkchen hat den Fokus, öffnet aber keine Tastatur
    expect(tastaturHoehe(vv as unknown as VisualViewport, 800)).toBe(0);
    feld('search');
    expect(tastaturHoehe(vv as unknown as VisualViewport, 800)).toBe(680);
  });
});

describe('schreibtGerade', () => {
  it('Textfelder, Textbereiche und bearbeitbare Flächen ja – Häkchen, Knöpfe und nichts nein', () => {
    expect(schreibtGerade(null)).toBe(false);
    expect(schreibtGerade(document.body)).toBe(false);
    for (const art of ['text', 'search', 'email', 'number', 'tel', 'url', 'password'])
      expect(schreibtGerade(feld(art)), art).toBe(true);
    for (const art of ['checkbox', 'radio', 'button', 'submit', 'range', 'file'])
      expect(schreibtGerade(feld(art)), art).toBe(false);
    expect(schreibtGerade(document.createElement('textarea'))).toBe(true);
    expect(schreibtGerade(document.createElement('button'))).toBe(false);
    const flaeche = document.createElement('div');
    // jsdom kennt `isContentEditable` nicht – der Browser setzt es für `contenteditable` (CodeMirror im Lied-Editor).
    Object.defineProperty(flaeche, 'isContentEditable', { value: true });
    expect(schreibtGerade(flaeche)).toBe(true);
  });
});

describe('syncAppHeight nutzt dieselbe Regel', () => {
  it('hält die App-Höhe nur an, solange in einem Feld geschrieben wird – ein Häkchen hält nichts an', () => {
    const wurzel = document.documentElement.style;
    Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
    feld();
    wurzel.removeProperty('--app-h');
    syncAppHeight();
    expect(wurzel.getPropertyValue('--app-h')).toBe('');
    feld('checkbox');
    syncAppHeight();
    expect(wurzel.getPropertyValue('--app-h')).toBe('700px');
  });
});

describe('useTastaturOffen', () => {
  it('offen erst ab der Schwelle – die schmale Leiste einer Hardware-Tastatur zählt nicht', () => {
    feld();
    const vv = ansicht();
    const { result } = renderHook(() => useTastaturOffen());
    expect(result.current).toBe(false);
    act(() => {
      vv.height = 800 - (TASTATUR_AB_PX - 1);
      vv.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
    act(() => {
      vv.height = 400;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
    act(() => {
      vv.height = 800;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });
});
