// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LEERER_PLAN, zeile } from '@shared/dienstplan/zeile.testutil';
import { Termine } from './Termine';

const z = zeile;

const ZEILEN = [
  z(1, 'Gottesdienst', '2026-10-18', {
    meine: [
      { dienst: 'Ton', zugesagt: true },
      { dienst: 'Gesang', zugesagt: false },
    ],
    geplant: 3,
    frei: 2,
  }),
  z(2, 'Gebetsabend', '2026-10-21', { geplant: 1 }),
  z(3, 'Gottesdienst', '2026-11-01'),
  z(4, 'Gebetsabend', '2026-11-04'),
  z(5, 'Gemeindeversammlung', '2026-11-08', { abgesagt: true }),
];

function zeige(planer = true) {
  const onMehr = vi.fn();
  render(
    <Termine
      zustand={{ art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 }}
      planer={planer}
      onNochmal={() => {}}
      onMehr={onMehr}
    />,
  );
  return { onMehr };
}

const titel = () =>
  screen.queryAllByRole('listitem').map((li) => li.querySelector('b')?.textContent);

beforeEach(() => localStorage.clear());

describe('Termine (E3-2)', () => {
  it('Vorgabe „Meine“: nur Termine mit eigenem Dienst, mit zugesagt/angefragt', () => {
    zeige();
    expect(titel()).toEqual(['Gottesdienst']);
    const reihe = screen.getAllByRole('listitem')[0];
    expect(within(reihe).getByText('Ton')).toBeTruthy();
    expect(within(reihe).getByText(/Gesang · angefragt/)).toBeTruthy();
    expect(within(reihe).getByText('So, 18.10. · 10:00 Uhr')).toBeTruthy();
  });

  it('„Alle“: nach Monaten, Planer sehen „N frei“ und den Haken nur bei eigenen Plätzen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Oktober 2026',
      'November 2026',
    ]);
    expect(titel()).toHaveLength(5);
    expect(screen.getByText('2 frei')).toBeTruthy();
    // Termin 2 hat Plätze der eigenen Gruppen, alle besetzt → Haken; 3 und 4 haben keine → nichts.
    expect(screen.getAllByLabelText('alles besetzt')).toHaveLength(1);
    expect(screen.getByText('abgesagt')).toBeTruthy();
  });

  it('Nicht-Planer sehen keine freien Plätze', () => {
    zeige(false);
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(screen.queryByText(/frei$/)).toBeNull();
    expect(screen.queryByLabelText('alles besetzt')).toBeNull();
  });

  it('Filter nach Veranstaltung: Reihen und „Weitere“; abwählen blendet aus', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const filter = screen.getByRole('group', { name: 'Veranstaltungen' });
    expect(
      within(filter)
        .getAllByRole('checkbox')
        .map((b) => b.closest('label')!.textContent),
    ).toEqual(['Gebetsabend', 'Gottesdienst', 'Weitere']);
    fireEvent.click(within(filter).getByRole('checkbox', { name: 'Gebetsabend' }));
    fireEvent.click(within(filter).getByRole('checkbox', { name: 'Weitere' }));
    expect(titel()).toEqual(['Gottesdienst', 'Gottesdienst']);
    // Der Knopf sagt, wie viel ausgeblendet ist.
    expect(screen.getByRole('button', { name: 'Filter, 2 ausgeblendet' })).toBeTruthy();
  });

  it('die Wahl bleibt nach dem Neuladen erhalten (im Gerät gemerkt)', () => {
    const { unmount } = render(
      <Termine
        zustand={{ art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 }}
        planer
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    unmount();
    zeige();
    expect(titel()).toHaveLength(5);
  });

  it('keine eigenen Dienste → sagt es und verweist auf „Alle“; Nachladen bleibt möglich', () => {
    render(
      <Termine
        zustand={{
          art: 'fertig',
          zeilen: [z(2, 'Gebetsabend', '2026-10-21')],
          plan: LEERER_PLAN,
          wochen: 8,
        }}
        planer={false}
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );
    expect(screen.getByText(/in den nächsten 8 Wochen keine Dienste/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Weitere Termine laden' })).toBeTruthy();
  });

  it('„Weitere Termine laden“ ruft das Nachladen', () => {
    const { onMehr } = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Termine laden' }));
    expect(onMehr).toHaveBeenCalledTimes(1);
  });

  it('Ladefehler: gemeinsamer Fehlerkasten mit „Erneut versuchen“', () => {
    const onNochmal = vi.fn();
    render(
      <Termine
        zustand={{
          art: 'fehler',
          fehler: { text: 'ChurchTools antwortet gerade nicht.', nochmal: true },
        }}
        planer={false}
        onNochmal={onNochmal}
        onMehr={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onNochmal).toHaveBeenCalled();
  });
});
