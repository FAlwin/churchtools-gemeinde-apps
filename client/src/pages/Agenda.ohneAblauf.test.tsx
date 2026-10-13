// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_SITE_CONFIG, type Service, type SiteConfig } from '@shared/types/index';
import { heuteIso } from '../utils/heute';

const api = vi.hoisted(() => ({ getServicesOhneAblauf: vi.fn(), getAblaufVorlagen: vi.fn() }));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  getServicesOhneAblauf: api.getServicesOhneAblauf,
  getAblaufVorlagen: api.getAblaufVorlagen,
}));
const site = vi.hoisted(() => ({ getSiteConfig: vi.fn() }));
vi.mock('../services/siteConfigApi', async (orig) => ({
  ...(await orig<typeof import('../services/siteConfigApi')>()),
  getSiteConfig: site.getSiteConfig,
}));

const { Agenda } = await import('./Agenda');

/**
 * Termine ohne Ablauf in der Terminliste (13.10.2026): Sie erscheinen nur mit eingestellter Regel,
 * nie doppelt, und „Ablauf anlegen" gibt es nur mit dem Recht dazu.
 */
function inTagen(n: number): string {
  const d = new Date(`${heuteIso()}T12:00:00Z`);
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

function zeige(kann: boolean, services: Service[] = [MIT]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Agenda
        services={services}
        onSelect={vi.fn()}
        onOpenSongs={vi.fn()}
        kannAblaufAnlegen={kann}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  site.getSiteConfig.mockResolvedValue(MIT_REGEL);
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

  it('ohne eingestellte Kalender wird gar nicht erst gefragt', async () => {
    site.getSiteConfig.mockResolvedValue(DEFAULT_SITE_CONFIG);
    zeige(true);
    await screen.findByText('Gottesdienst');
    expect(api.getServicesOhneAblauf).not.toHaveBeenCalled();
  });
});
