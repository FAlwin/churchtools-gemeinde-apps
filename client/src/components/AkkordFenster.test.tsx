// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('@ui/fenster/useOverlayKeyboardInset', () => ({
  useOverlayKeyboardInset: () => undefined,
}));
const { AkkordFenster } = await import('./AkkordFenster');

/** Lied-Editor L5 (22.10.2026): „Anderer Akkord“ – eintippen oder zusammenstellen, dann EINMAL einfügen. */
function zeige(props: Partial<Parameters<typeof AkkordFenster>[0]> = {}) {
  const fertig = vi.fn();
  render(<AkkordFenster grundton="E" fertig={fertig} onClose={vi.fn()} {...props} />);
  return { fertig, feld: screen.getByPlaceholderText(/Em7/) };
}
const gruppe = (lbl: string) => screen.getByText(lbl).nextElementSibling as HTMLElement;

describe('AkkordFenster', () => {
  it('eintippen: „em7“ wird Em7, die Eingabetaste fügt ein', () => {
    const { fertig, feld } = zeige();
    fireEvent.change(feld, { target: { value: 'em7' } });
    expect(screen.getByText('Em7', { selector: 'span' })).toBeTruthy();
    fireEvent.keyDown(feld, { key: 'Enter' });
    expect(fertig).toHaveBeenCalledWith('Em7');
  });

  it('Unlesbares: rot, Hauptknopf gesperrt, Eingabetaste tut nichts', () => {
    const { fertig, feld } = zeige();
    fireEvent.change(feld, { target: { value: 'Vers' } });
    expect(feld.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Einfügen' }).disabled).toBe(true);
    fireEvent.keyDown(feld, { key: 'Enter' });
    expect(fertig).not.toHaveBeenCalled();
  });

  it('zusammenstellen: Grundton, Art, Bass – beginnt beim Grundton der Tonart', () => {
    const { fertig } = zeige();
    expect(within(gruppe('Grundton')).getByRole('button', { pressed: true }).textContent).toBe('E');
    fireEvent.click(within(gruppe('Grundton')).getByRole('button', { name: 'G' }));
    fireEvent.click(within(gruppe('Art')).getByRole('button', { name: 'sus4' }));
    fireEvent.click(within(gruppe('Bass (Slash-Akkord)')).getByRole('button', { name: '/B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Einfügen' }));
    expect(fertig).toHaveBeenCalledWith('Gsus4/B');
  });

  it('Getipptes stellt die Knöpfe mit um', () => {
    const { feld } = zeige();
    fireEvent.change(feld, { target: { value: 'd/f#' } });
    expect(within(gruppe('Grundton')).getByRole('button', { pressed: true }).textContent).toBe('D');
    expect(
      within(gruppe('Bass (Slash-Akkord)')).getByRole('button', { pressed: true }).textContent,
    ).toBe('/F#');
  });

  it('beim Ändern steht der vorhandene Akkord schon da', () => {
    const { fertig } = zeige({ start: 'F#m7/A', knopf: 'Übernehmen' });
    expect(screen.getByText('Akkord ändern')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(fertig).toHaveBeenCalledWith('F#m7/A');
  });
});
