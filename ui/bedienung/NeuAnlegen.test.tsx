// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useNeuAnlegen } from './NeuAnlegen';

/**
 * **„Etwas Neues anlegen“ – groß grün im Kopf, am Handy das runde Plus** (29.10.2026, „Neues Lied“ und Abwesenheiten).
 */
function geraet(handy: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: handy,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('useNeuAnlegen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('iPad/Rechner: grüner Knopf im Kopf, kein Plus', () => {
    geraet(false);
    const onClick = vi.fn();
    const { result } = renderHook(() => useNeuAnlegen({ label: 'Neues Lied', onClick }));
    expect(result.current.schwebend).toBeNull();
    render(<>{result.current.kopf}</>);
    const knopf = screen.getByRole('button', { name: /Neues Lied/ });
    expect(knopf.className).toMatch(/neu/);
    fireEvent.click(knopf);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Handy: das runde Plus, nichts im Kopf', () => {
    geraet(true);
    const onClick = vi.fn();
    const { result } = renderHook(() => useNeuAnlegen({ label: 'Neues Lied', onClick }));
    expect(result.current.kopf).toBeNull();
    render(<>{result.current.schwebend}</>);
    const plus = screen.getByRole('button', { name: 'Neues Lied' });
    expect(plus.className).toMatch(/plus/);
    fireEvent.click(plus);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ohne Recht oder solange nichts anzulegen ist: weder Knopf noch Plus', () => {
    for (const handy of [true, false]) {
      geraet(handy);
      const { result } = renderHook(() =>
        useNeuAnlegen({ label: 'Neues Lied', onClick: () => {}, sichtbar: false }),
      );
      expect(result.current).toEqual({ kopf: null, schwebend: null });
    }
  });
});
