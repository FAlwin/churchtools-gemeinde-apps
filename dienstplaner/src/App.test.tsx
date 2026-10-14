// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { App } from './App';
import { ladeStart, type Start } from './start';
import { ladeTermine, ladeZeitraum } from './ladeTermine';
import { startFuer } from './start.testutil';
import { LEERER_PLAN } from '@shared/dienstplan/zeile.testutil';

const KEINE_TERMINE = { zeilen: [], plan: LEERER_PLAN };

// Nur das Laden wird ersetzt – die Regeln aus start.ts (wer planen darf) laufen echt.
vi.mock('./start', async (original) => ({
  ...(await original<typeof import('./start')>()),
  ladeStart: vi.fn(),
}));
vi.mock('./ladeTermine', () => ({
  ladeTermine: vi.fn(),
  ladeZeitraum: vi.fn(),
  WOCHEN_JE_SCHRITT: 8,
  MAX_WOCHEN: 52,
}));
// Das Beiwerk der Startseite (Lieder, Abwesenheiten, Musik-App) – hier ohne Netz.
vi.mock('./ladeBeiwerk', () => ({
  ladeLieder: vi.fn(() => Promise.resolve(null)),
  ladeAbwesenheiten: vi.fn(() => Promise.resolve([])),
  ladeMusikApp: vi.fn(() => Promise.resolve(null)),
}));
const laden = vi.mocked(ladeStart);
const termineLaden = vi.mocked(ladeTermine);

// Ohne eigene Vorgabe im Test: keine Termine (sonst gäbe die Attrappe `undefined` zurück).
beforeEach(() => termineLaden.mockResolvedValue(KEINE_TERMINE));

function start(planbar: number[] | null, gruppen: Start['gruppen'] = []): Start {
  return startFuer({
    gruppen,
    rechte: {
      planbareDienstgruppen: planbar,
      sichtbareDienstgruppen: [],
      ablaufKalender: [],
      abwesenheitenAller: false,
    },
  });
}

describe('App des Dienstplaners (E2/E3-3)', () => {
  const planenKnoepfe = () =>
    within(screen.getByRole('region', { name: 'Planen' }))
      .getAllByRole('button')
      .map((b) => b.querySelector('b')?.textContent);

  it('Gruß, Gemeinde und – für Planer – die Dienstgruppen in der Reihenfolge der Gemeinde', async () => {
    laden.mockResolvedValue(start([4, 3]));
    render(<App />);
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(screen.getByText(/Dienstplaner · Evangeliumschristen- Gemeinde e\.V\./)).toBeTruthy();
    expect(planenKnoepfe()).toEqual(['Technik', 'Musik']);
  });

  it('Recht ohne Aufzählung (null) → alle Dienstgruppen', async () => {
    laden.mockResolvedValue(start(null));
    render(<App />);
    await screen.findByText('Hallo Alwin');
    expect(planenKnoepfe()).toHaveLength(3);
  });

  it('ohne Planer-Recht keine Karte „Planen“', async () => {
    laden.mockResolvedValue(start([]));
    render(<App />);
    await screen.findByText('Hallo Alwin');
    expect(screen.queryByRole('region', { name: 'Planen' })).toBeNull();
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

describe('Termine im Reiter (E3-2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('Start und Termine teilen eine Liste: einmal geladen, beim Wechseln nicht neu; „Weitere“ +8 Wochen', async () => {
    breite(false);
    laden.mockResolvedValue(start([3]));
    termineLaden.mockResolvedValue(KEINE_TERMINE);
    render(<App />);
    const bereiche = await screen.findByRole('group', { name: 'Bereiche' });
    // Schon die Startseite braucht die Termine („Als Nächstes“, deine Dienste).
    await waitFor(() => expect(termineLaden).toHaveBeenCalledTimes(1));
    fireEvent.click(within(bereiche).getByRole('button', { name: 'Termine' }));
    await screen.findByRole('button', { name: 'Weitere Termine laden' });
    fireEvent.click(within(bereiche).getByRole('button', { name: 'Start' }));
    fireEvent.click(within(bereiche).getByRole('button', { name: 'Termine' }));
    await screen.findByRole('button', { name: 'Weitere Termine laden' });
    expect(termineLaden).toHaveBeenCalledTimes(1);
    expect(termineLaden.mock.calls[0][1]).toBe(8);
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Termine laden' }));
    expect(termineLaden).toHaveBeenCalledTimes(2);
    expect(termineLaden.mock.calls[1][1]).toBe(16);
  });

  it('Ladefehler der Termine → Fehlerkasten, „Erneut versuchen“ lädt neu', async () => {
    breite(false);
    window.location.hash = '#/termine';
    laden.mockResolvedValue(start([3]));
    termineLaden.mockRejectedValueOnce(new ApiError(502, 'x')).mockResolvedValueOnce(KEINE_TERMINE);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('button', { name: 'Weitere Termine laden' });
    expect(termineLaden).toHaveBeenCalledTimes(2);
  });

  it('Nachladen ist still: das Bisherige bleibt stehen; ein Fehler dabei bleibt neben der Liste (14.10.2026)', async () => {
    breite(false);
    window.location.hash = '#/termine';
    laden.mockResolvedValue(start([3]));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Termine laden' }));
    // Nicht wieder „lädt …“ über die ganze Seite – die Liste und ihr Knopf bleiben.
    expect(screen.getByRole('button', { name: 'wird geladen …' })).toBeTruthy();
    termineLaden.mockRejectedValueOnce(new ApiError(502, 'x'));
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Termine laden' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(screen.getByRole('button', { name: 'wird geladen …' })).toBeTruthy();
    expect(termineLaden.mock.calls.map((c) => c[1])).toEqual([8, 16, 24, 24]);
  });

  it('Planen: nach einem gescheiterten Nachladen zählt, was geladen ist – › bleibt bis zur Grenze möglich', async () => {
    breite(false);
    window.location.hash = '#/planen';
    localStorage.clear();
    laden.mockResolvedValue(start([3]));
    // Leer bis 48 Wochen, der Schritt auf 56 scheitert.
    termineLaden.mockImplementation((_s, w) =>
      w > 48 ? Promise.reject(new ApiError(502, 'x')) : Promise.resolve(KEINE_TERMINE),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Späteren Termin dazunehmen' }));
    await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(termineLaden.mock.calls.map((c) => c[1])).toEqual([8, 16, 24, 32, 40, 48, 56]);
    // Geladen sind 48 Wochen – also noch nicht am Ende, auch wenn der Versuch schon bei 56 war.
    expect(screen.getByRole('button', { name: 'Späteren Termin dazunehmen' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('Planen: ein gewählter Monat lädt über `ladeZeitraum` genau diesen Monat', async () => {
    breite(false);
    window.location.hash = '#/planen';
    localStorage.clear();
    laden.mockResolvedValue(start([3]));
    vi.mocked(ladeZeitraum).mockResolvedValue(KEINE_TERMINE);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Dieser Monat/ }));
    await screen.findByText(/^Im .* stehen keine Termine an\.$/);
    const [, von, bis, zeitzone] = vi.mocked(ladeZeitraum).mock.calls[0];
    expect([von.slice(0, 7), von.slice(8)]).toEqual([bis.slice(0, 7), '01']);
    expect(zeitzone).toBe('Europe/Berlin');
    localStorage.clear();
  });
});

describe('Startseite → Termine (E3-3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('„Alle“ bei „Deine nächsten Dienste“ öffnet die Termine in der Ansicht „Meine“ – auch wenn „Alle“ gemerkt war', async () => {
    breite(false);
    localStorage.setItem(
      'dienstplaner.termine.auswahl',
      JSON.stringify({ nurMeine: false, ausgeblendet: [] }),
    );
    laden.mockResolvedValue(start([3]));
    render(<App />);
    const dienste = await screen.findByRole('region', { name: 'Deine nächsten Dienste' });
    fireEvent.click(within(dienste).getByRole('button', { name: /Alle/ }));
    expect(window.location.hash).toBe('#/termine');
    const welche = await screen.findByRole('group', { name: 'Welche Termine' });
    expect(within(welche).getByRole('button', { name: 'Meine' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('Planen für Gruppenleiter (E3-4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('Leitung der Gruppe eines Dienstes ohne globales Recht → Reiter „Planen“ mit der Matrix', async () => {
    breite(false);
    laden.mockResolvedValue(start([], [{ id: 7, name: 'Technik', leitung: true }]));
    render(<App />);
    const bereiche = await screen.findByRole('group', { name: 'Bereiche' });
    fireEvent.click(within(bereiche).getByRole('button', { name: 'Planen' }));
    expect(window.location.hash).toBe('#/planen');
    expect(
      await screen.findByText(/In den nächsten 8 Wochen stehen keine Termine an/),
    ).toBeTruthy();
  });

  it('nur Mitglied, ohne Recht → kein Reiter „Planen“', async () => {
    breite(false);
    laden.mockResolvedValue(start([], [{ id: 7, name: 'Technik', leitung: false }]));
    render(<App />);
    const bereiche = await screen.findByRole('group', { name: 'Bereiche' });
    expect(within(bereiche).queryByRole('button', { name: 'Planen' })).toBeNull();
  });
});
