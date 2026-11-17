// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HilfeKnopf } from './HilfeKnopf';

afterEach(cleanup);

const abschnitte = [
  { titel: 'Eintragen', punkte: ['Freien Platz antippen.', 'Gesendet wird erst mit „Senden“.'] },
  { titel: 'Filter', punkte: ['Einzelne Dienste ausblenden.'] },
];

describe('HilfeKnopf', () => {
  it('zeigt nur den Knopf; das Fenster geht erst auf Klick auf', () => {
    render(<HilfeKnopf seite="Planen" abschnitte={abschnitte} />);
    expect(screen.getByRole('button', { name: 'Hilfe zu Planen' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('öffnet „Hilfe · Planen“ mit Abschnitten und Stichpunkten, schließt mit X', () => {
    render(<HilfeKnopf seite="Planen" abschnitte={abschnitte} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe zu Planen' }));
    const fenster = screen.getByRole('dialog', { name: 'Hilfe · Planen' });
    expect(fenster.querySelectorAll('h3')).toHaveLength(2);
    expect(fenster.querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByText('Gesendet wird erst mit „Senden“.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('schließt auch mit Esc', () => {
    render(<HilfeKnopf seite="Planen" abschnitte={abschnitte} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe zu Planen' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
