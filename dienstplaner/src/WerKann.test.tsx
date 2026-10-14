// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { RohKandidat } from '@shared/dienstplan/werKann';
import { WerKann, type FreierPlatz } from './WerKann';
import { ladeWerKann } from './ladeWerKann';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn() }));
const laden = vi.mocked(ladeWerKann);
afterEach(() => laden.mockReset());

const PLATZ: FreierPlatz = {
  eventId: 166,
  serviceId: 6,
  dienst: 'Ton',
  termin: 'Gottesdienst',
  tag: 'So 08.11.',
  uhrzeit: '10:00',
  monat: '2026-11',
  monatName: 'November',
  nr: 1,
  von: 2,
  schonDa: [9],
};
const k = (id: number, name: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
  person: { domainIdentifier: String(id), title: name },
  score: 0,
  ...o,
});

describe('WerKann', () => {
  it('Kopf, Kandidaten mit Hinweis und „N× im Monat“; wer schon da ist, fehlt', async () => {
    laden.mockResolvedValue([
      k(1, 'Anna', { monthlyUtilization: { '2026-11': 2 } }),
      k(2, 'David', { score: -1000, absences: [{ absenceReason: { nameTranslated: 'Urlaub' } }] }),
      k(9, 'Schon Da'),
    ]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    expect(screen.getByText('Ton · So 08.11.')).toBeTruthy();
    expect(screen.getByText('Gottesdienst um 10:00 Uhr · Platz 1 von 2')).toBeTruthy();
    const liste = await screen.findByRole('list', { name: 'Wer kann?' });
    const zeilen = within(liste)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(zeilen).toEqual(['Annafrei2× im November', 'Davidabwesend: Urlaub0× im November']);
    expect(laden).toHaveBeenCalledWith(166, 6);
  });

  it('niemand vorgeschlagen → sagt es', async () => {
    laden.mockResolvedValue([]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    expect(await screen.findByText(/schlägt ChurchTools niemanden vor/)).toBeTruthy();
  });

  it('ab 7 Kandidaten ein Suchfeld, das filtert', async () => {
    laden.mockResolvedValue(
      ['Anna', 'Ben', 'Clara', 'David', 'Ella', 'Finn', 'Greta'].map((n, i) => k(i + 1, n)),
    );
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    const suche = await screen.findByRole('searchbox', { name: 'Name suchen' });
    fireEvent.change(suche, { target: { value: 'fi' } });
    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Finnfrei0× im November']);
  });

  it('weniger als 7 → kein Suchfeld', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    await screen.findByRole('list');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('Ladefehler → Fehlerkasten; „Nochmal“ lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(503, 'ChurchTools antwortet gerade nicht.'));
    laden.mockResolvedValueOnce([k(1, 'Anna')]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('list');
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('„Schließen“ schließt', async () => {
    laden.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<WerKann platz={PLATZ} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
