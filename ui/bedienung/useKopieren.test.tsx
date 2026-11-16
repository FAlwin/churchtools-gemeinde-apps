// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useKopieren } from './useKopieren';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
});

let ergebnis: boolean | undefined;

function Probe({ text }: { text: string }) {
  const feld = useRef<HTMLTextAreaElement>(null);
  const { stand, kopieren } = useKopieren(text, feld);
  return (
    <>
      <textarea ref={feld} readOnly value={text} aria-label="Text" />
      <button
        type="button"
        onClick={() =>
          void kopieren().then((ok) => {
            ergebnis = ok;
          })
        }
      >
        kopieren
      </button>
      <output>{stand}</output>
    </>
  );
}

const zwischenablage = (writeText: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('useKopieren', () => {
  it('kopiert den Text, steht kurz auf „kopiert“ und ist nach 1,6 s wieder bereit', async () => {
    const schreiben = vi.fn().mockResolvedValue(undefined);
    zwischenablage(schreiben);
    vi.useFakeTimers();
    render(<Probe text="Hallo" />);
    fireEvent.click(screen.getByRole('button', { name: 'kopieren' }));
    await act(async () => {});
    expect(schreiben).toHaveBeenCalledWith('Hallo');
    expect(screen.getByRole('status').textContent).toBe('kopiert');
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByRole('status').textContent).toBe('bereit');
  });

  it('Browser verweigert → „vonHand“, und das Feld ist markiert', async () => {
    zwischenablage(vi.fn().mockRejectedValue(new Error('nein')));
    render(<Probe text="Hallo Welt" />);
    fireEvent.click(screen.getByRole('button', { name: 'kopieren' }));
    await act(async () => {});
    expect(screen.getByRole('status').textContent).toBe('vonHand');
    const feld = screen.getByLabelText<HTMLTextAreaElement>('Text');
    expect(feld.selectionStart).toBe(0);
    expect(feld.selectionEnd).toBe('Hallo Welt'.length);
  });

  it('gar keine Zwischenablage (unsichere Seite) → ebenfalls „vonHand“, kein Absturz', async () => {
    render(<Probe text="Hallo" />);
    fireEvent.click(screen.getByRole('button', { name: 'kopieren' }));
    await act(async () => {});
    expect(screen.getByRole('status').textContent).toBe('vonHand');
  });

  it('kopieren() meldet, ob es geklappt hat (true / false) – für Aufrufer, die danach weiterleiten', async () => {
    zwischenablage(vi.fn().mockResolvedValue(undefined));
    ergebnis = undefined;
    render(<Probe text="Hallo" />);
    fireEvent.click(screen.getByRole('button', { name: 'kopieren' }));
    await act(async () => {});
    expect(ergebnis).toBe(true);
    cleanup();
    zwischenablage(vi.fn().mockRejectedValue(new Error('nein')));
    ergebnis = undefined;
    render(<Probe text="Hallo" />);
    fireEvent.click(screen.getByRole('button', { name: 'kopieren' }));
    await act(async () => {});
    expect(ergebnis).toBe(false);
  });
});
