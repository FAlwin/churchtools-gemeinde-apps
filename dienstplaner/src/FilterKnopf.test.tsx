// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FilterKnopf } from './FilterKnopf';

/** Wie Termine und Planen: der Aufrufer hält die Liste der ausgeschalteten Werte. */
function Mit({ start = [] as string[], gruppen = ['Programm', 'Technik'] }) {
  const [arten, setArten] = useState(start);
  const [aus, setAus] = useState<string[]>([]);
  return (
    <>
      <FilterKnopf
        abschnitte={[
          {
            titel: 'Veranstaltungen',
            optionen: ['Gottesdienst', 'Gebetsabend'].map((t) => ({ wert: t, text: t })),
            aus: arten,
            onAus: setArten,
          },
          {
            titel: 'Gruppen',
            optionen: gruppen.map((t) => ({ wert: t, text: t })),
            aus,
            onAus: setAus,
          },
        ]}
      />
      <p>draußen</p>
      <output>{[...arten, ...aus].join(',')}</output>
    </>
  );
}

describe('FilterKnopf (Entwurf A, 14.10.2026)', () => {
  it('zu, bis man tippt; dann je Abschnitt eine Überschrift und Häkchen = wird gezeigt', () => {
    render(<Mit start={['Gebetsabend']} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' }));
    const arten = within(screen.getByRole('group', { name: 'Veranstaltungen' }));
    expect(arten.getByRole('checkbox', { name: 'Gottesdienst' }).checked).toBe(true);
    expect(arten.getByRole('checkbox', { name: 'Gebetsabend' }).checked).toBe(false);
    expect(screen.getByRole('group', { name: 'Gruppen' })).toBeTruthy();
  });

  it('Häkchen schaltet um; die Zahl am Knopf zählt mit', () => {
    render(<Mit />);
    expect(screen.getByRole('button', { name: 'Filter' }).textContent).toBe('Filter');
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Technik' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gottesdienst' }));
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('Gottesdienst,Technik');
    expect(screen.getByRole('button', { name: 'Filter, 2 ausgeblendet' }).textContent).toBe(
      'Filter2',
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Technik' }));
    expect(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' })).toBeTruthy();
  });

  it('schließt bei Tipp daneben und mit Escape – ein Tipp ins Menü schließt nicht', () => {
    render(<Mit />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.pointerDown(screen.getByRole('checkbox', { name: 'Technik' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.pointerDown(screen.getByText('draußen'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Abschnitte mit nur einer Möglichkeit fehlen; ganz ohne Wahl kein Knopf', () => {
    render(<Mit gruppen={['Technik']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.queryByRole('group', { name: 'Gruppen' })).toBeNull();
    const leer = render(
      <FilterKnopf
        abschnitte={[{ titel: 'X', optionen: [{ wert: 'a', text: 'A' }], aus: [], onAus: vi.fn() }]}
      />,
    );
    expect(leer.container.textContent).toBe('');
  });
});
