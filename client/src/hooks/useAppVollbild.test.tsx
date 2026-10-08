// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setzeAppVollbild, useAppVollbild } from './useAppVollbild';

/**
 * Das Vollbild der ganzen App in der Erweiterung (Entwurf mit Alwin, 08.10.2026): EIN Zustand für
 * Liederliste, Ablauf und Liedblatt, sichtbar als `data-vollbild` an `#root`. Ob die App damit die
 * ChurchTools-Leiste wirklich verdeckt, prüft nur das Gerät (TF-EXT-11).
 */
let root: HTMLElement;
beforeEach(() => {
  root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
});
afterEach(() => {
  act(() => setzeAppVollbild(false));
  root.remove();
});

describe('useAppVollbild', () => {
  it('Umschalten setzt und entfernt data-vollbild an #root', () => {
    const { result } = renderHook(() => useAppVollbild());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(root.hasAttribute('data-vollbild')).toBe(true);
    act(() => result.current[1]());
    expect(root.hasAttribute('data-vollbild')).toBe(false);
  });

  it('ein Zustand für alle Knöpfe: Liste schaltet ein, das Liedblatt sieht es', () => {
    const liste = renderHook(() => useAppVollbild());
    const blatt = renderHook(() => useAppVollbild());
    act(() => liste.result.current[1]());
    expect(blatt.result.current[0]).toBe(true);
  });

  it('bleibt beim Wechsel der Ansicht erhalten (Liste weg, Liedblatt neu)', () => {
    const liste = renderHook(() => useAppVollbild());
    act(() => liste.result.current[1]());
    liste.unmount();
    const blatt = renderHook(() => useAppVollbild());
    expect(blatt.result.current[0]).toBe(true);
    expect(root.hasAttribute('data-vollbild')).toBe(true);
  });
});
