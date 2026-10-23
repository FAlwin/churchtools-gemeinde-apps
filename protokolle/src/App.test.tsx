// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { App } from './App';
import { ladeStart, type Start } from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
vi.mock('./Verwaltung', () => ({ Verwaltung: () => <p>VERWALTUNG</p> }));
const laden = vi.mocked(ladeStart);

const START: Start = {
  id: 1,
  vorname: 'Alwin',
  gemeinde: 'ECG Donrath',
  modul: 20,
  darfVerwalten: false,
  gruppen: [
    { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
    { id: 7, name: 'Jugendleitung', lage: 'unvollstaendig', protokolle: 70, mitarbeit: null },
  ],
};

beforeEach(() => {
  laden.mockResolvedValue(START);
  window.location.hash = '';
});

describe('App (S1)', () => {
  it('zeigt Gruß, Gemeinde und die Gruppen mit ihrem Stand', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    expect(screen.getByText('Protokolle · ECG Donrath')).toBeTruthy();
    const liste = screen.getByRole('list');
    const zeilen = within(liste)
      .getAllByRole('listitem')
      .map((z) => z.textContent);
    expect(zeilen).toEqual(['Leitungsteameingerichtet', 'Jugendleitungunvollständig eingerichtet']);
    expect(screen.getByText(/Fehlt eine Gruppe\? Ein Admin richtet sie ein/)).toBeTruthy();
  });

  it('ohne Gruppen: ein klarer Satz statt einer leeren Liste', async () => {
    laden.mockResolvedValue({ ...START, gruppen: [] });
    render(<App />);
    expect(
      await screen.findByText('Du bist in keiner Gruppe, die hier Protokolle führen kann.'),
    ).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('auch ohne Gruppen: der Hinweis, wie eine fehlende Gruppe dazukommt', async () => {
    laden.mockResolvedValue({ ...START, gruppen: [] });
    render(<App />);
    expect(await screen.findByText(/Fehlt eine Gruppe\?/)).toBeTruthy();
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
      new ApiError(404, 'Die Erweiterung „Protokolle“ ist in ChurchTools nicht zu finden.'),
    );
    render(<App />);
    expect(
      await screen.findByText('Die Erweiterung „Protokolle“ ist in ChurchTools nicht zu finden.'),
    ).toBeTruthy();
    expect(screen.queryByText(/keiner Gruppe/)).toBeNull();
  });

  it('kein Admin: keine Reiter – und #/verwaltung führt zum Start', async () => {
    window.location.hash = '#/verwaltung';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verwaltung' })).toBeNull();
    expect(screen.queryByText('VERWALTUNG')).toBeNull();
  });

  it('Admin: Reiter Start · Verwaltung; „Verwaltung“ zeigt die Verwaltung ohne Gruß', async () => {
    laden.mockResolvedValue({ ...START, darfVerwalten: true });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Verwaltung' }));
    expect(await screen.findByText('VERWALTUNG')).toBeTruthy();
    expect(window.location.hash).toBe('#/verwaltung');
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
  });
});
