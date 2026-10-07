// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_SITE_CONFIG } from '@shared/types/index';

/**
 * **„Mehr" in der ChurchTools-Erweiterung** (#336): Was es dort nicht gibt, erscheint nicht – kein
 * toter Knopf –, und an genau einer Stelle steht der Hinweis auf die Musik App mit eigenem Server.
 * Die Server-Variante prüft `Settings.test.tsx` (dort ist alles da). Aufbau der Attrappen von dort.
 */
vi.mock('../services/funktionen', async (original) => ({
  ...(await original<typeof import('../services/funktionen')>()),
  funktionen: {
    offline: false,
    installieren: false,
    abmelden: false,
    verwaltung: false,
    statistik: false,
    liedtextSuche: false,
    hinweisAufServerVariante: true,
  },
}));
vi.mock('../hooks/useSiteConfig', () => ({
  useUpdateSiteConfig: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useGroups: () => ({
    isLoading: false,
    isError: false,
    data: [
      { id: 1, name: 'Musikteam' },
      { id: 2, name: 'Technik' },
    ],
  }),
  useGroupRoles: () => ({ isLoading: false, isError: false, data: [{ id: 9, name: 'Leitung' }] }),
}));
vi.mock('../hooks/useUpdateCheck', () => ({ useUpdateCheck: () => ({ available: false }) }));
vi.mock('../queryClient', () => ({ getOfflineStatus: () => Promise.resolve(null) }));
vi.mock('../services/offlineAuto', () => ({
  isOfflineAutoEnabled: () => false,
  setOfflineAutoEnabled: vi.fn(),
}));
vi.mock('../hooks/useSharing', () => ({
  useSharing: () => ({ enabled: false, error: null, toggle: vi.fn() }),
}));
vi.mock('../hooks/usePwaInstall', () => ({
  usePwaInstall: () => ({ standalone: true, canPrompt: false, platform: 'ios' }),
}));
vi.mock('../services/pwaInstall', () => ({ promptInstall: vi.fn() }));
vi.mock('../components/LinksManager', () => ({ LinksManager: () => <div>Links-Verwaltung</div> }));
vi.mock('../components/TerminArtenManager', () => ({
  TerminArtenManager: () => <div>Termin-Arten-Verwaltung</div>,
}));
vi.mock('../components/SupportBox', () => ({ SupportBox: () => null }));

const { Settings } = await import('./Settings');
const { PROJEKT_ADRESSE } = await import('../services/funktionen');

function zeige(): void {
  render(
    <Settings
      site={{ ...DEFAULT_SITE_CONFIG, orgName: 'ECG Donrath' }}
      theme="light"
      themePref="system"
      setThemePref={vi.fn()}
      wakePref={false}
      onToggleWake={vi.fn()}
      isAdmin
      canUseGlobalNotes={false}
      userName="Alwin Friesen"
      onLogout={vi.fn()}
      onReplayIntro={vi.fn()}
    />,
  );
}

describe('„Mehr" in der ChurchTools-Erweiterung', () => {
  it('kein Abmelden, kein Offline, kein Installieren, keine Verwaltung – auch nicht für Admins', () => {
    zeige();
    expect(screen.queryByText('Abmelden')).toBeNull();
    expect(screen.queryByText('Kommende Gottesdienste offline halten')).toBeNull();
    expect(screen.queryByText(/Als App installieren/)).toBeNull();
    expect(screen.queryByText('Organisation / Name')).toBeNull();
  });

  it('der eine Hinweis mit „Mehr erfahren" zur Projektseite', () => {
    zeige();
    expect(screen.getByText('Erweiterung für ChurchTools')).toBeTruthy();
    expect(screen.getByText('Mehr erfahren').getAttribute('href')).toBe(PROJEKT_ADRESSE);
  });

  it('was es gibt, bleibt: Darstellung und Einführung', () => {
    zeige();
    expect(screen.getByText('Erscheinungsbild')).toBeTruthy();
    expect(screen.getByText('Einführung nochmal ansehen')).toBeTruthy();
  });
});
