// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { App } from './App';
import { ladeStart, type Start } from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
vi.mock('./Verwaltung', () => ({ Verwaltung: () => <p>VERWALTUNG</p> }));
vi.mock('./Sitzungen', () => ({
  Sitzungen: ({
    auswahl,
  }: {
    auswahl?: { gruppe: number; sitzung?: string; punkt?: string | null } | null;
  }) => (
    <p>
      SITZUNGEN{' '}
      {auswahl
        ? `${auswahl.gruppe}/${auswahl.sitzung ?? '-'}${auswahl.punkt ? `#${auswahl.punkt}` : ''}`
        : 'ohne Auswahl'}
    </p>
  ),
}));
vi.mock('./lesen', () => ({ ladeUebersicht: vi.fn(() => Promise.resolve([])) }));
vi.mock('./Suche', () => ({
  Suche: ({
    begriff,
    onTreffer,
  }: {
    begriff: string;
    onTreffer: (g: number, s: string, p: string | null) => void;
  }) => (
    <div>
      <p>SUCHE „{begriff}“</p>
      <button type="button" onClick={() => onTreffer(7, 'p:okt', 'pkt-2')}>
        TREFFER
      </button>
    </div>
  ),
}));
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

  it('kein Admin: Reiter Start · Sitzungen, kein „Verwaltung“ – und #/verwaltung führt zum Start', async () => {
    window.location.hash = '#/verwaltung';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sitzungen' })).toBeTruthy();
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

  it('„Sitzungen“ zeigt die Sitzungen ohne Gruß', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByText('SITZUNGEN ohne Auswahl')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
  });

  it('S3-3: eine Gruppe auf der Startseite öffnet „Sitzungen“ mit dieser Gruppe', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Jugendleitung/ }));
    expect(await screen.findByText('SITZUNGEN 7/-')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
  });

  it('S3-3: über den Reiter zurück und wieder hin – die alte Auswahl gilt nicht mehr', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Jugendleitung/ }));
    await screen.findByText('SITZUNGEN 7/-');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByText('SITZUNGEN ohne Auswahl')).toBeTruthy();
  });

  it('S3-4b: die Lupe klappt die Suche auf – sie ersetzt den Inhalt, der Gruß verschwindet', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beamer' } });
    expect(screen.getByText('SUCHE „beamer“')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
    expect(screen.queryByText(/Deine Gruppen/)).toBeNull();
  });

  it('S3-4b: ✕ führt zurück – der Begriff ist beim nächsten Öffnen leer', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beamer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suche schließen' }));
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(screen.getByText('SUCHE „“')).toBeTruthy();
  });

  it('S3-4b: ein Reiter schließt die Suche', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByText('SITZUNGEN ohne Auswahl')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('S3-4b: ein Treffer öffnet „Sitzungen“ mit Gruppe, Sitzung und Punkt – die Suche ist zu', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.click(screen.getByRole('button', { name: 'TREFFER' }));
    expect(await screen.findByText('SITZUNGEN 7/p:okt#pkt-2')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});
