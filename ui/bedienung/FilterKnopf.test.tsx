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

/** Ist das Häkchen gesetzt? (Hilfsfunktion: so passt der Typ für Compiler und Lint gleichermaßen.) */
const angehakt = (el: HTMLElement): boolean => (el as HTMLInputElement).checked;

describe('FilterKnopf (Entwurf A, 14.10.2026)', () => {
  it('zu, bis man tippt; dann je Abschnitt eine Überschrift und Häkchen = wird gezeigt', () => {
    render(<Mit start={['Gebetsabend']} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' }));
    const arten = within(screen.getByRole('group', { name: 'Veranstaltungen' }));
    expect(angehakt(arten.getByRole('checkbox', { name: 'Gottesdienst' }))).toBe(true);
    expect(angehakt(arten.getByRole('checkbox', { name: 'Gebetsabend' }))).toBe(false);
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

  it('am Handy nur das Symbol – „Filter“ steht in eigenem Element, die Zahl daneben (E8-3, 05.11.2026)', () => {
    render(<Mit start={['Gebetsabend']} />);
    const knopf = screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' });
    expect([...knopf.querySelectorAll('span')].map((s) => s.textContent)).toEqual(['Filter', '1']);
  });

  it('Zusatz-Häkchen (Terminliste, 05.11.2026): eingerückt, eigener Name, aus solange die Möglichkeit aus ist', () => {
    const umschalten = vi.fn();
    const abschnitt = (aus: string[]) => ({
      titel: 'Kalender',
      optionen: [
        {
          wert: '2',
          text: 'Gottesdienste',
          zusatz: { text: 'auch ohne Ablauf', an: true, onUmschalten: umschalten },
        },
        { wert: '7', text: 'Jugend' },
      ],
      aus,
      onAus: vi.fn(),
      hinweis: 'Nur, wo du Abläufe anlegen darfst.',
    });
    const { rerender } = render(<FilterKnopf abschnitte={[abschnitt([])]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const zusatz = screen.getByRole('checkbox', { name: 'Gottesdienste: auch ohne Ablauf' });
    expect(angehakt(zusatz)).toBe(true);
    fireEvent.click(zusatz);
    expect(umschalten).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Nur, wo du Abläufe anlegen darfst.')).toBeTruthy();
    // Die Zahl am Knopf zählt nur die Möglichkeiten, nicht den Zusatz.
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();

    rerender(<FilterKnopf abschnitte={[abschnitt(['2'])]} />);
    const ausgegraut = screen.getByRole('checkbox', { name: 'Gottesdienste: auch ohne Ablauf' });
    expect(angehakt(ausgegraut)).toBe(false);
    expect((ausgegraut as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' })).toBeTruthy();
  });

  it('eine einzige Möglichkeit MIT Zusatz-Häkchen ist eine Wahl – der Knopf erscheint', () => {
    render(
      <FilterKnopf
        abschnitte={[
          {
            titel: 'Kalender',
            optionen: [
              {
                wert: '2',
                text: 'Gottesdienste',
                zusatz: { text: 'auch ohne Ablauf', an: false, onUmschalten: vi.fn() },
              },
            ],
            aus: [],
            onAus: vi.fn(),
          },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
  });
});
