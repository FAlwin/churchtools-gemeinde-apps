// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { App } from './App';
import { ladeStart, type Start } from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
const laden = vi.mocked(ladeStart);

const START: Start = {
  id: 1,
  vorname: 'Alwin',
  gemeinde: 'ECG Donrath',
  modul: 20,
  gruppen: [
    { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
    { id: 7, name: 'Jugendleitung', lage: 'unvollstaendig', protokolle: 70, mitarbeit: null },
    { id: 19, name: 'Technik-Team', lage: 'nicht-eingerichtet', protokolle: null, mitarbeit: null },
  ],
};

beforeEach(() => {
  laden.mockResolvedValue(START);
});

describe('App (S1)', () => {
  it('zeigt Gruß, Gemeinde und die Gruppen mit ihrem Stand', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    expect(screen.getByText('Sitzungen · ECG Donrath')).toBeTruthy();
    const liste = screen.getByRole('list');
    const zeilen = within(liste)
      .getAllByRole('listitem')
      .map((z) => z.textContent);
    expect(zeilen).toEqual([
      'Leitungsteameingerichtet',
      'Jugendleitungunvollständig eingerichtet',
      'Technik-Teamnicht eingerichtet',
    ]);
    expect(screen.getByText(/richtet ein Admin in ChurchTools einmal ein/)).toBeTruthy();
  });

  it('ohne Gruppen: ein klarer Satz statt einer leeren Liste', async () => {
    laden.mockResolvedValue({ ...START, gruppen: [] });
    render(<App />);
    expect(
      await screen.findByText('Du bist in keiner Gruppe, die Sitzungen nutzen kann.'),
    ).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('alle eingerichtet: kein Hinweis aufs Einrichten', async () => {
    laden.mockResolvedValue({ ...START, gruppen: [START.gruppen[0]] });
    render(<App />);
    await screen.findByText('Leitungsteam');
    expect(screen.queryByText(/richtet ein Admin/)).toBeNull();
  });

  it('vorübergehender Fehler: „Erneut versuchen“ lädt neu – nicht „keine Gruppen“', async () => {
    laden.mockRejectedValueOnce(new ApiError(503, 'ChurchTools antwortet gerade nicht.'));
    render(<App />);
    const knopf = await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(screen.queryByText(/keiner Gruppe/)).toBeNull();
    fireEvent.click(knopf);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy());
    expect(laden).toHaveBeenCalledTimes(2);
  });

  // Wie in allen Erweiterungen (`ui/ct/fehlerMeldung.ts`): 404 zeigt die Meldung von ChurchTools bzw. der
  // Modulsuche; „Erneut versuchen“ bleibt (nach dem Hochladen der Erweiterung hilft es).
  it('Erweiterung fehlt (404): sagt das, statt „keine Gruppen“ zu zeigen', async () => {
    laden.mockRejectedValue(
      new ApiError(404, 'Die Erweiterung „Sitzungen“ ist in ChurchTools nicht zu finden.'),
    );
    render(<App />);
    expect(
      await screen.findByText('Die Erweiterung „Sitzungen“ ist in ChurchTools nicht zu finden.'),
    ).toBeTruthy();
    expect(screen.queryByText(/keiner Gruppe/)).toBeNull();
  });
});
