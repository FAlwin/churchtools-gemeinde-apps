// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_SITE_CONFIG, type Service } from '@shared/types/index';
import { heuteImKalender } from '@shared/ct/zeit';

const netz = vi.hoisted(() => ({ online: true }));
vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => netz.online }));
const api = vi.hoisted(() => ({
  getServicesOhneAblauf: vi.fn(),
  getAblaufVorlagen: vi.fn(),
  getServices: vi.fn(),
}));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  ...api,
}));
const site = vi.hoisted(() => ({ getSiteConfig: vi.fn(), getKalender: vi.fn() }));
vi.mock('../services/siteConfigApi', async (orig) => ({
  ...(await orig<typeof import('../services/siteConfigApi')>()),
  ...site,
}));

const { Agenda } = await import('./Agenda');

/**
 * **Termine als Werkzeugzeile** (B8, „Ruhige Bedienung“): oben EINE Zeile – links Kommende | Vergangene, rechts der Filter, still.
 * Vollbild steht neben den Reitern (`VollbildImReiter`), „+ Ablauf anlegen“ ist das leise gestrichelte Feld in der Zeile.
 */
function tag(n: number): string {
  const d = new Date(`${heuteImKalender()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const termin = (id: number, kalenderId: number): Service => ({
  id,
  day: '01',
  month: 'Dez',
  weekday: 'Sonntag',
  name: `Termin ${id}`,
  subtitle: null,
  date: tag(3),
  start: `${tag(3)}T09:00:00Z`,
  time: '10:00 Uhr',
  location: '',
  songCount: 1,
  setlistChanged: false,
  kalenderId,
});

function geraet(handy: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: handy,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
function zeige(onVorlagen?: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Agenda
        services={[termin(1, 2), termin(2, 7)]}
        onSelect={vi.fn()}
        onOpenSongs={vi.fn()}
        darfAblaufImKalender={() => true}
        onVorlagen={onVorlagen}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  netz.online = true;
  site.getSiteConfig.mockResolvedValue(DEFAULT_SITE_CONFIG);
  site.getKalender.mockResolvedValue([
    { id: 2, name: 'Gottesdienste' },
    { id: 7, name: 'Jugend' },
  ]);
  api.getServicesOhneAblauf.mockResolvedValue([]);
  api.getAblaufVorlagen.mockResolvedValue([]);
  api.getServices.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Termine: Werkzeugzeile (B8)', () => {
  it('Rechner: Kommende | Vergangene links, der stille Filter rechts – in EINER Zeile', async () => {
    geraet(false);
    zeige();
    const zeile = within(await screen.findByRole('toolbar', { name: 'Termine' }));
    const umschalter = zeile.getByRole('group', { name: 'Ansicht' });
    expect(
      within(umschalter)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Kommende', 'Vergangene']);
    const filter = zeile.getByRole('button', { name: /^Filter/ });
    expect(filter.className).toMatch(/still/);
    // Das Ziel der Einführung sitzt an der Hülle des Filters – gleich geblieben.
    expect(filter.closest('[data-tour="termine-filter"]')).not.toBeNull();
  });

  it('Handy: die Ansicht ist ein Auswahlknopf; ein Tipp zeigt beide, die Wahl wechselt', async () => {
    geraet(true);
    zeige();
    const zeile = within(await screen.findByRole('toolbar', { name: 'Termine' }));
    fireEvent.click(zeile.getByRole('button', { name: 'Ansicht: Kommende' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vergangene' }));
    expect(await screen.findByRole('button', { name: 'Ansicht: Vergangene' })).toBeTruthy();
    // Der Filter ist am Handy derselbe Baustein (die Zeile rahmt ihn, R12).
    expect(zeile.getByRole('button', { name: /^Filter/ })).toBeTruthy();
  });

  it('ohne Netz: „Vergangene“ ausgegraut, ein Tipp erklärt es und bleibt bei „Kommende“', async () => {
    geraet(false);
    netz.online = false;
    zeige();
    const vergangene = await screen.findByRole('button', { name: 'Vergangene' });
    expect(vergangene.className).toMatch(/off/);
    fireEvent.click(vergangene);
    expect(await screen.findByText(/offline nicht verfügbar/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kommende' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('der Wechsel auf „Vergangene“ lädt diese und zeigt „Mehr laden“ als stilles Wort', async () => {
    geraet(false);
    api.getServices.mockResolvedValue([{ ...termin(9, 2), date: tag(-7), name: 'Neulich' }]);
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Vergangene' }));
    expect(await screen.findByText('Neulich')).toBeTruthy();
    const mehr = screen.getByRole('button', { name: 'Mehr laden' });
    fireEvent.click(mehr);
    expect(api.getServices.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('Termine: „⋯“ mit den Ablaufvorlagen (R13, früher eine Zeile unter „Mehr“)', () => {
  it('Rechner: Menü unter dem „⋯“ in der Werkzeugzeile; der Eintrag öffnet die Vorlagen – genau einmal', async () => {
    geraet(false);
    const onVorlagen = vi.fn();
    zeige(onVorlagen);
    const zeile = within(await screen.findByRole('toolbar', { name: 'Termine' }));
    const mehr = zeile.getByRole('button', { name: 'Mehr' });
    // Das Ziel der Einführung sitzt am „⋯“ (an der Hülle des Knopfs).
    expect(mehr.closest('[data-tour="ablaufvorlagen"]')).not.toBeNull();
    fireEvent.click(mehr);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ablaufvorlagen' }));
    expect(onVorlagen).toHaveBeenCalledTimes(1);
    // Das Menü ist danach zu – die Aktion läuft nicht gegen ein offenes Menü (Lehre 05.08.2026).
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Handy: das Blatt von unten, der Eintrag öffnet die Vorlagen und schließt das Blatt', async () => {
    geraet(true);
    const onVorlagen = vi.fn();
    zeige(onVorlagen);
    const zeile = within(await screen.findByRole('toolbar', { name: 'Termine' }));
    fireEvent.click(zeile.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ablaufvorlagen' }));
    expect(onVorlagen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Ablaufvorlagen' })).toBeNull();
  });

  it('ohne Angebot der App (kein Recht, Abläufe zu sehen) gibt es kein „⋯“ – und der Filter bleibt', async () => {
    geraet(false);
    zeige();
    const zeile = within(await screen.findByRole('toolbar', { name: 'Termine' }));
    expect(zeile.queryByRole('button', { name: 'Mehr' })).toBeNull();
    expect(zeile.getByRole('button', { name: /^Filter/ })).toBeTruthy();
  });
});
