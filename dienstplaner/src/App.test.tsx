// @vitest-environment jsdom
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { App } from './App';
import { ladeStart, type Start } from './start';
import { ladeTermin, ladeTermine, ladeZeitraum } from './ladeTermine';
import { startFuer } from './start.testutil';
import { LEERER_PLAN, zeile } from '@shared/dienstplan/zeile.testutil';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';

const KEINE_TERMINE = { zeilen: [], plan: LEERER_PLAN };

// Nur das Laden wird ersetzt – die Regeln aus start.ts (wer planen darf) laufen echt.
vi.mock('./start', async (original) => ({
  ...(await original<typeof import('./start')>()),
  ladeStart: vi.fn(),
}));
vi.mock('./ladeTermine', () => ({
  ladeTermine: vi.fn(),
  ladeTermin: vi.fn(),
  ladeZeitraum: vi.fn(),
  WOCHEN_JE_SCHRITT: 8,
  MAX_WOCHEN: 52,
}));
// Das Beiwerk der Startseite (Lieder, Abwesenheiten, Musik-App) – hier ohne Netz.
vi.mock('./ladeBeiwerk', () => ({
  ladeLieder: vi.fn(() => Promise.resolve(null)),
  ladeAbwesenheiten: vi.fn(() => Promise.resolve([])),
  ladeMusikApp: vi.fn(() => Promise.resolve(null)),
  ladeAblauf: vi.fn(() => Promise.resolve(null)),
  ladeLiedAutoren: vi.fn(() => Promise.resolve(new Map())),
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

  it('Termine: im ersten Bild mit dem Fehler ist „Weitere Termine laden“ wieder frei – nicht noch „wird geladen …“', async () => {
    breite(false);
    window.location.hash = '#/termine';
    laden.mockResolvedValue(start([3]));
    // Wie bei Planen: `onRender` sieht jeden Commit vor den Effekten – vorher räumte ein Effekt „läuft“ ein Bild zu spät.
    const imFehlerBild: string[] = [];
    const pruefen = () => {
      if (imFehlerBild.length > 0 || !screen.queryByRole('button', { name: 'Erneut versuchen' }))
        return;
      const knopf = screen
        .getAllByRole('button')
        .find((b) => /Termine laden|wird geladen/.test(b.textContent ?? ''));
      imFehlerBild.push(
        `${knopf?.textContent} ${(knopf as HTMLButtonElement | undefined)?.disabled ? 'gesperrt' : 'frei'}`,
      );
    };
    render(
      <Profiler id="termine" onRender={pruefen}>
        <App />
      </Profiler>,
    );
    const mehr = await screen.findByRole('button', { name: 'Weitere Termine laden' });
    termineLaden.mockRejectedValueOnce(new ApiError(502, 'x'));
    fireEvent.click(mehr);
    await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(imFehlerBild).toEqual(['Weitere Termine laden frei']);
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
    // Schon im ERSTEN Bild mit dem Fehler muss ＋ wieder gehen. `onRender` läuft in jedem Commit nach dem Schreiben ins
    // DOM, aber vor den Effekten – genau dort stand ＋ vorher noch gesperrt (ein Bild lang; je nach Last sah der Test
    // es oder nicht).
    const imFehlerBild: { gesperrt: boolean; zeile: string }[] = [];
    const pruefen = () => {
      if (imFehlerBild.length > 0 || !screen.queryByRole('button', { name: 'Erneut versuchen' }))
        return;
      const plus = screen.getByRole('button', { name: 'Späteren Termin dazunehmen' });
      const leiste = plus.closest('[role="group"]');
      imFehlerBild.push({
        gesperrt: (plus as HTMLButtonElement).disabled,
        zeile: leiste?.textContent ?? '',
      });
    };
    render(
      <Profiler id="planen" onRender={pruefen}>
        <App />
      </Profiler>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Späteren Termin dazunehmen' }));
    await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(imFehlerBild).toHaveLength(1);
    expect(imFehlerBild[0].gesperrt).toBe(false);
    expect(imFehlerBild[0].zeile).not.toContain('werden geladen');
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
    // Dieselbe Zeitzone wie „ab heute“ (die des Browsers – in der CI UTC, nicht fest „Europe/Berlin“).
    expect(zeitzone).toBe(termineLaden.mock.calls[0][2]);
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

describe('Termin-Ansicht im Dienstplaner (E6-1b)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  // Drei Termine, wie sie die Liste geladen hat – ‹ › blättert in dieser Reihenfolge.
  const roh = (id: number, name: string, tag: string) =>
    ({
      id,
      name,
      startDate: `${tag}T08:00:00Z`,
      endDate: `${tag}T09:30:00Z`,
      eventServices: [],
    }) as RohTermin;
  const ROH = [
    roh(7, 'Gottesdienst', '2026-10-18'),
    roh(8, 'Gebetsabend', '2026-10-21'),
    roh(9, 'Jugend', '2026-10-24'),
  ];
  const s = start([3]);
  const plan = (r: RohTermin[]) =>
    planAus(r, {
      ichId: 1,
      dienste: s.dienste,
      dienstgruppen: s.dienstgruppen,
      zeitzone: 'Europe/Berlin',
      planbar: () => false,
      ganzSichtbar: () => true,
    });
  const MEIN = { meine: [{ dienst: 'Ton', zugesagt: true }] };

  it('aus „Termine“: Zeile antippen → #/termin/<id>; „Termine“ bleibt hervorgehoben; ‹ › und zurück', async () => {
    breite(false);
    window.location.hash = '#/termine';
    laden.mockResolvedValue(s);
    termineLaden.mockResolvedValue({
      zeilen: ROH.map((r) => zeile(r.id, r.name, r.startDate.slice(0, 10), MEIN)),
      plan: plan(ROH),
    });
    vi.mocked(ladeTermin).mockImplementation((_s, id) =>
      Promise.resolve({ zeilen: [], plan: plan(ROH.filter((r) => r.id === id)), ablaufTermin: {} }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Gebetsabend/ }));
    expect(window.location.hash).toBe('#/termin/8');
    expect(await screen.findByRole('heading', { name: 'Gebetsabend' })).toBeTruthy();
    // Statt der Liste, nicht daneben.
    expect(screen.queryByRole('region', { name: 'Termine' })).toBeNull();
    const bereiche = screen.getByRole('group', { name: 'Bereiche' });
    expect(
      within(bereiche).getByRole('button', { name: 'Termine' }).getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Termin' }));
    expect(await screen.findByRole('heading', { name: 'Jugend' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nächster Termin' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Voriger Termin' }));
    expect(await screen.findByRole('heading', { name: 'Gebetsabend' })).toBeTruthy();

    const zurueck = screen
      .getAllByRole('button', { name: 'Termine' })
      .find((b) => !bereiche.contains(b))!;
    fireEvent.click(zurueck);
    expect(window.location.hash).toBe('#/termine');
    expect(await screen.findByRole('region', { name: 'Termine' })).toBeTruthy();
  });

  it('direkt über die Adresse (Neuladen): Termin-Ansicht ohne Gruß, zurück zu „Start“', async () => {
    breite(false);
    window.location.hash = '#/termin/7';
    laden.mockResolvedValue(s);
    vi.mocked(ladeTermin).mockResolvedValue({ zeilen: [], plan: plan([ROH[0]]), ablaufTermin: {} });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
    expect(vi.mocked(ladeTermin).mock.calls[0][1]).toBe(7);
    expect(screen.queryByText('Hallo Alwin')).toBeNull();
    const bereiche = screen.getByRole('group', { name: 'Bereiche' });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Start' }).find((b) => !bereiche.contains(b))!,
    );
    expect(window.location.hash).toBe('');
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
  });
});
