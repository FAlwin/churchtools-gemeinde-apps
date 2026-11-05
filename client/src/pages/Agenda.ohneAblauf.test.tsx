// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_SITE_CONFIG, type Service, type SiteConfig } from '@shared/types/index';
import { heuteImKalender } from '@shared/ct/zeit';

const api = vi.hoisted(() => ({
  getServicesOhneAblauf: vi.fn(),
  getAblaufVorlagen: vi.fn(),
  getServices: vi.fn(),
}));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  getServicesOhneAblauf: api.getServicesOhneAblauf,
  getAblaufVorlagen: api.getAblaufVorlagen,
  getServices: api.getServices,
}));
const site = vi.hoisted(() => ({ getSiteConfig: vi.fn(), getKalender: vi.fn() }));
vi.mock('../services/siteConfigApi', async (orig) => ({
  ...(await orig<typeof import('../services/siteConfigApi')>()),
  getSiteConfig: site.getSiteConfig,
  getKalender: site.getKalender,
}));

const { Agenda } = await import('./Agenda');

/**
 * Termine ohne Ablauf in der Terminliste (13.10.2026): Sie erscheinen nur aus Kalendern mit „auch ohne Ablauf“, nie
 * doppelt, und „Ablauf anlegen" gibt es nur mit dem Recht dazu. Seit 05.11.2026 wählt das jede Person im Filter der
 * Liste (auf dem Gerät gemerkt); die frühere Einstellung der Gemeinde ist nur noch der Startwert.
 */
function inTagen(n: number): string {
  const d = new Date(`${heuteImKalender()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function termin(id: number, tag: string, name = 'Gottesdienst'): Service {
  return {
    id,
    day: tag.slice(8, 10),
    month: 'Okt',
    weekday: 'Sonntag',
    name,
    subtitle: null,
    date: tag,
    start: `${tag}T09:00:00Z`,
    time: '10:00 Uhr',
    location: '',
    songCount: 2,
    setlistChanged: false,
    kalenderId: 2,
  };
}

const MIT = termin(1, inTagen(3));
const OHNE = { ...termin(2, inTagen(10)), songCount: 0 };
const MIT_REGEL: SiteConfig = {
  ...DEFAULT_SITE_CONFIG,
  ablaufAnlegen: { kalenderIds: [2], suchwort: '' },
};

function zeige(
  kann: boolean | ((s: Service) => boolean),
  services: Service[] = [MIT],
  darfImKalender: (id: number) => boolean = () => true,
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Agenda
        services={services}
        onSelect={vi.fn()}
        onOpenSongs={vi.fn()}
        kannAblaufAnlegen={typeof kann === 'function' ? kann : () => kann}
        darfAblaufImKalender={darfImKalender}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  api.getServicesOhneAblauf.mockClear();
  site.getSiteConfig.mockResolvedValue(MIT_REGEL);
  site.getKalender.mockResolvedValue([
    { id: 2, name: 'Gottesdienste' },
    { id: 7, name: 'Jugend' },
  ]);
  api.getServicesOhneAblauf.mockResolvedValue([OHNE]);
  api.getAblaufVorlagen.mockResolvedValue([]);
});

describe('Terminliste: Termine ohne Ablauf', () => {
  it('stehen mit „Kein Ablauf" in der Liste; mit Recht öffnet ein Tipp „Ablauf anlegen"', async () => {
    zeige(true);
    expect(await screen.findByText('Kein Ablauf')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Ablauf anlegen'));
    expect(await screen.findByRole('button', { name: 'Anlegen' })).toBeTruthy();
  });

  it('das Recht gilt je Termin (#635): gefragt wird mit genau diesem Termin', async () => {
    const kann = vi.fn((s: Service) => s.id === OHNE.id);
    zeige(kann);
    expect(await screen.findByLabelText('Ablauf anlegen')).toBeTruthy();
    expect(kann.mock.calls.map(([s]) => s.id)).toContain(OHNE.id);
    cleanup();
    zeige((s) => s.id !== OHNE.id);
    expect(await screen.findByText('Kein Ablauf')).toBeTruthy();
    expect(screen.queryByLabelText('Ablauf anlegen')).toBeNull();
  });

  it('ohne Recht: kein „Ablauf anlegen", und ein Tipp öffnet kein Fenster', async () => {
    zeige(false);
    expect(await screen.findByText('Kein Ablauf')).toBeTruthy();
    expect(screen.queryByLabelText('Ablauf anlegen')).toBeNull();
    fireEvent.click(screen.getByText('Kein Ablauf'));
    expect(screen.queryByRole('button', { name: 'Anlegen' })).toBeNull();
  });

  it('hat er inzwischen einen Ablauf, steht er nur einmal da – als normaler Termin', async () => {
    zeige(true, [MIT, { ...OHNE, songCount: 3 }]);
    // Erst wenn die Liste ohne Ablauf geladen ist, kann sich ein Doppel zeigen – vorher prüfte der
    // Test ins Leere und blieb auch ohne den Schutz grün (Gegenprobe, 13.10.2026).
    await waitFor(() => expect(api.getServicesOhneAblauf).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Kein Ablauf')).toBeNull();
    expect(screen.getAllByText('Gottesdienst')).toHaveLength(2);
  });

  it('ohne gewählte Kalender wird gar nicht erst gefragt', async () => {
    site.getSiteConfig.mockResolvedValue(DEFAULT_SITE_CONFIG);
    zeige(true);
    await screen.findByText('Gottesdienst');
    expect(api.getServicesOhneAblauf).not.toHaveBeenCalled();
  });
});

describe('Terminliste: Filter (05.11.2026)', () => {
  const filterOeffnen = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /^Filter/ }));
  };

  it('Startwert = frühere Einstellung der Gemeinde: gefragt wird genau mit diesen Kalendern', async () => {
    zeige(true);
    await screen.findByText('Kein Ablauf');
    expect(api.getServicesOhneAblauf).toHaveBeenCalledWith([2]);
  });

  it('ohne Ablauf-Recht im Kalender wird nicht gefragt – auch nicht mit übernommenem Startwert', async () => {
    zeige(true, [MIT], () => false);
    await screen.findByText('Gottesdienst');
    await new Promise((r) => setTimeout(r, 30));
    expect(api.getServicesOhneAblauf).not.toHaveBeenCalled();
    expect(screen.queryByText('Kein Ablauf')).toBeNull();
  });

  it('„auch ohne Ablauf“ einschalten holt die Termine – und das Gerät merkt es sich', async () => {
    site.getSiteConfig.mockResolvedValue(DEFAULT_SITE_CONFIG);
    zeige(true);
    await filterOeffnen();
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Gottesdienste: auch ohne Ablauf' }),
    );
    expect(await screen.findByText('Kein Ablauf')).toBeTruthy();
    expect(api.getServicesOhneAblauf).toHaveBeenCalledWith([2]);
    expect(JSON.parse(localStorage.getItem('worship:termine-filter') ?? 'null')).toEqual({
      aus: [],
      ohneAblauf: [2],
    });
  });

  it('die Wahl des Geräts gilt vor dem Startwert der Gemeinde', async () => {
    localStorage.setItem('worship:termine-filter', JSON.stringify({ aus: [], ohneAblauf: [] }));
    zeige(true);
    await screen.findByText('Gottesdienst');
    await new Promise((r) => setTimeout(r, 30));
    expect(api.getServicesOhneAblauf).not.toHaveBeenCalled();
  });

  it('ein ausgeblendeter Kalender verschwindet ganz – auch seine Termine mit Ablauf', async () => {
    const jugend = { ...termin(3, inTagen(5), 'Jugendabend'), kalenderId: 7 };
    zeige(true, [MIT, jugend]);
    expect(await screen.findByText('Jugendabend')).toBeTruthy();
    await filterOeffnen();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Jugend' }));
    await waitFor(() => expect(screen.queryByText('Jugendabend')).toBeNull());
    expect(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' })).toBeTruthy();
  });

  it('der Filter gilt auch unter „Vergangene“', async () => {
    localStorage.setItem('worship:termine-filter', JSON.stringify({ aus: [7], ohneAblauf: [] }));
    api.getServices.mockResolvedValue([
      termin(4, inTagen(-7), 'Gottesdienst neulich'),
      { ...termin(5, inTagen(-5), 'Jugendabend neulich'), kalenderId: 7 },
    ]);
    zeige(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Vergangene' }));
    expect(await screen.findByText('Gottesdienst neulich')).toBeTruthy();
    expect(screen.queryByText('Jugendabend neulich')).toBeNull();
  });

  it('ein ausgeblendeter Kalender liefert auch keine Termine ohne Ablauf mehr', async () => {
    zeige(true);
    expect(await screen.findByText('Kein Ablauf')).toBeTruthy();
    await filterOeffnen();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gottesdienste' }));
    await waitFor(() => expect(screen.queryByText('Kein Ablauf')).toBeNull());
    expect(screen.queryByText('Gottesdienst')).toBeNull();
    expect(screen.getByText(/Der Filter blendet Kalender aus/)).toBeTruthy();
  });
});

describe('Terminliste: Monatsüberschriften', () => {
  it('je Monat eine Überschrift „Monat JJJJ“ (Namen aus der gemeinsamen Quelle, 14.10.2026)', async () => {
    api.getServicesOhneAblauf.mockResolvedValue([]);
    zeige(false, [termin(5, '2027-03-07'), termin(6, '2027-03-14'), termin(7, '2027-10-03')]);
    expect(await screen.findByText('März 2027')).toBeTruthy();
    expect(screen.getByText('Oktober 2027')).toBeTruthy();
    expect(screen.getAllByText('März 2027')).toHaveLength(1);
  });
});
