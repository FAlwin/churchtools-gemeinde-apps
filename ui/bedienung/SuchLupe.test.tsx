// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuchLupe } from './SuchLupe';

const knoepfe = () => ({ onOeffnen: vi.fn(), onBegriff: vi.fn(), onSchliessen: vi.fn() });

/** So hält eine App den Zustand (Protokolle `App.tsx`): zu setzt auch den Begriff zurück. */
function Halter({ platzhalter }: { platzhalter?: string }) {
  const [s, setS] = useState({ offen: false, begriff: '' });
  return (
    <SuchLupe
      offen={s.offen}
      begriff={s.begriff}
      onOeffnen={() => setS({ offen: true, begriff: '' })}
      onBegriff={(begriff) => setS({ offen: true, begriff })}
      onSchliessen={() => setS({ offen: false, begriff: '' })}
      platzhalter={platzhalter}
    />
  );
}

describe('SuchLupe (R7, vorher SuchLeiste S3-4b)', () => {
  it('zu: nur die Lupe – ein Tipp öffnet', () => {
    const k = knoepfe();
    render(<SuchLupe offen={false} begriff="" {...k} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(k.onOeffnen).toHaveBeenCalledTimes(1);
  });

  it('offen: das Feld hat den Fokus, Tippen meldet den Begriff', () => {
    const k = knoepfe();
    render(<SuchLupe offen begriff="bea" {...k} />);
    const feld = screen.getByRole('searchbox', { name: 'Suchbegriff' });
    expect(document.activeElement).toBe(feld);
    fireEvent.change(feld, { target: { value: 'beamer' } });
    expect(k.onBegriff).toHaveBeenCalledWith('beamer');
  });

  it('✕ und Esc schließen – Esc auch mit Text im Feld, jeweils genau einmal', () => {
    const k = knoepfe();
    render(<SuchLupe offen begriff="x" {...k} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suche schließen' }));
    expect(k.onSchliessen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(k.onSchliessen).toHaveBeenCalledTimes(2);
  });

  it('Esc wirkt auch, wenn der Fokus nicht im Feld steht – aber nicht, solange die Suche zu ist', () => {
    const k = knoepfe();
    const { rerender } = render(<SuchLupe offen={false} begriff="" {...k} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(k.onSchliessen).not.toHaveBeenCalled();
    rerender(<SuchLupe offen begriff="" {...k} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(k.onSchliessen).toHaveBeenCalledTimes(1);
  });

  it('das Feld bleibt offen, solange niemand schließt (auch leer, auch nach Fokusverlust)', () => {
    render(<Halter />);
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    const feld = screen.getByRole('searchbox', { name: 'Suchbegriff' });
    expect(document.activeElement).toBe(feld);
    fireEvent.blur(feld);
    expect(screen.getByRole('searchbox')).toBe(feld);
    fireEvent.change(feld, { target: { value: 'beamer' } });
    fireEvent.blur(feld);
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('beamer');
    cleanup();
  });

  it('Esc bei Text: klappt zu und leert den Begriff; erneutes Öffnen beginnt leer (wie heute in den Protokollen)', () => {
    render(<Halter />);
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beamer' } });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
    cleanup();
  });

  it('der Platzhalter kommt von der App', () => {
    render(<Halter platzhalter="Beschlüsse, To-Dos, Protokolle …" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(screen.getByRole('searchbox').getAttribute('placeholder')).toBe(
      'Beschlüsse, To-Dos, Protokolle …',
    );
    cleanup();
  });

  it('die Namen kommen von der App („Person hervorheben“), Zusätze am Feld und darunter erscheinen', () => {
    const taste = vi.fn();
    render(
      <SuchLupe
        offen
        begriff="da"
        {...knoepfe()}
        feldName="Person hervorheben"
        feldAria={{ role: 'combobox' }}
        onTaste={taste}
        unter={<ul aria-label="Vorschläge" />}
      />,
    );
    const feld = screen.getByRole('combobox', { name: 'Person hervorheben' });
    fireEvent.keyDown(feld, { key: 'ArrowDown' });
    expect(taste).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('list', { name: 'Vorschläge' })).toBeTruthy();
    cleanup();
    render(<SuchLupe offen={false} begriff="" {...knoepfe()} knopfName="Person hervorheben" />);
    expect(screen.getByRole('button', { name: 'Person hervorheben' })).toBeTruthy();
    cleanup();
  });
});
