// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { App } from './App';
import { ladeStart, type Start } from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
const laden = vi.mocked(ladeStart);

const DIENSTGRUPPEN = [
  { id: 1, name: 'Programm' },
  { id: 3, name: 'Technik' },
  { id: 4, name: 'Musik' },
];

function start(planbar: number[] | null, gruppen: Start['gruppen'] = []): Start {
  return {
    vorname: 'Alwin',
    gemeinde: 'Evangeliumschristen- Gemeinde e.V.',
    gruppen,
    dienstgruppen: DIENSTGRUPPEN,
    rechte: { planbareDienstgruppen: planbar, ablaufKalender: [], abwesenheitenAller: false },
  };
}

const karte = (name: string) => within(screen.getByRole('region', { name }));

describe('App des Dienstplaners (E2)', () => {
  it('Gruß, Gemeinde, geplante Dienstgruppen in der Reihenfolge der Gemeinde, Gruppen mit Rolle', async () => {
    laden.mockResolvedValue(
      start(
        [4, 3],
        [
          { id: 9, name: 'Lobpreisteam', leitung: false },
          { id: 7, name: 'Technik', leitung: true },
        ],
      ),
    );
    render(<App />);
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(screen.getByText(/Dienstplaner · Evangeliumschristen- Gemeinde e\.V\./)).toBeTruthy();
    expect(
      karte('Planen')
        .getAllByRole('listitem')
        .map((z) => z.textContent),
    ).toEqual(['Technik', 'Musik']);
    expect(
      karte('Deine Gruppen')
        .getAllByRole('listitem')
        .map((z) => z.textContent),
    ).toEqual(['LobpreisteamMitglied', 'TechnikLeitung']);
  });

  it('Recht ohne Aufzählung (null) → alle Dienstgruppen', async () => {
    laden.mockResolvedValue(start(null));
    render(<App />);
    await screen.findByText('Hallo Alwin');
    expect(karte('Planen').getAllByRole('listitem')).toHaveLength(3);
  });

  it('ohne Planer-Recht und ohne Gruppen → sagt beides, statt leere Karten zu zeigen', async () => {
    laden.mockResolvedValue(start([]));
    render(<App />);
    expect(await screen.findByText(/planst du keine Dienstgruppe/)).toBeTruthy();
    expect(screen.getByText('Du bist in keiner Gruppe.')).toBeTruthy();
  });

  it('vorübergehender Fehler → „Erneut versuchen“ lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(502, 'x')).mockResolvedValueOnce(start([3]));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('abgemeldet (401) → Hinweis ohne „Erneut versuchen“', async () => {
    laden.mockRejectedValue(new ApiError(401, 'x'));
    render(<App />);
    expect(await screen.findByText(/nicht mehr angemeldet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });
});

/** `matchMedia` wie im Browser: `handy` = schmaler als 760 px. */
function breite(handy: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: handy && q.includes('max-width: 759px'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('Reiter des Dienstplaners (E3-1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('Computer: Reiter oben als Umschalter, Planen nur mit Recht; Gruß nur auf Start', async () => {
    breite(false);
    laden.mockResolvedValue(start([3]));
    render(<App />);
    const bereiche = await screen.findByRole('group', { name: 'Bereiche' });
    expect(
      within(bereiche)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Start', 'Termine', 'Planen', 'Abwesenheiten']);
    expect(screen.getByText('Hallo Alwin')).toBeTruthy();
    fireEvent.click(within(bereiche).getByRole('button', { name: 'Termine' }));
    expect(window.location.hash).toBe('#/termine');
    expect(await screen.findByRole('region', { name: 'Termine' })).toBeTruthy();
    expect(screen.queryByText('Hallo Alwin')).toBeNull();
  });

  it('ohne Planer-Recht kein Reiter „Planen“ – auch nicht über die Adresse', async () => {
    breite(false);
    window.location.hash = '#/planen';
    laden.mockResolvedValue(start([]));
    render(<App />);
    const bereiche = await screen.findByRole('group', { name: 'Bereiche' });
    expect(within(bereiche).queryByRole('button', { name: 'Planen' })).toBeNull();
    expect(screen.getByText('Hallo Alwin')).toBeTruthy();
  });

  it('Handy: Reiter unten als Leiste, oben keine', async () => {
    breite(true);
    laden.mockResolvedValue(start([3]));
    render(<App />);
    const leiste = await screen.findByRole('navigation', { name: 'Bereiche' });
    expect(within(leiste).getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('group', { name: 'Bereiche' })).toBeNull();
  });

  it('beim Laden und im Fehlerfall noch keine Reiter', async () => {
    breite(false);
    laden.mockRejectedValue(new ApiError(502, 'x'));
    render(<App />);
    await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(screen.queryByRole('group', { name: 'Bereiche' })).toBeNull();
  });
});
