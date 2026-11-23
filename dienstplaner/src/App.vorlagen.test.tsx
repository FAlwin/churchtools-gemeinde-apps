// @vitest-environment jsdom
// Die Seite „Ablaufvorlagen“ im Dienstplaner (E10-V3a): Adressen, Reiter, Zurück – mit der echten Seite (`VorlagenBereich`),
// nur ChurchTools (Start, Termine, Vorlagen-Zugriff) ist ersetzt.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mehrEintrag } from './mehrMenue.testutil';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vorlagenStandAus } from '@shared/ct/ablaufVorlagenListe';
import type { CtAblaufVorlage } from '@shared/ct/typen';
import { LEERER_PLAN } from '@shared/dienstplan/zeile.testutil';
import { App } from './App';
import { ladeStart } from './start';
import { ladeTermine } from './ladeTermine';
import { startFuer } from './start.testutil';
import { vorlagenZugriff } from './vorlagenZugriff';

// „Meine Anzeige“ (L4-5) gleicht mit ChurchTools ab – hier ohne Netz.
vi.mock('@ui/ct/ablagePort', async () => ({
  ablagePort: (await import('./ablageOffline.testutil')).ablagePortOffline,
}));
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
vi.mock('./ladeBeiwerk', () => ({
  ladeTerminVorlagen: vi.fn(() => Promise.resolve([])),
  ladeLieder: vi.fn(() => Promise.resolve(null)),
  ladeAbwesenheiten: vi.fn(() => Promise.resolve([])),
  ladeMusikApp: vi.fn(() => Promise.resolve(null)),
  ladeAblauf: vi.fn(() => Promise.resolve(null)),
  ladeLiedDaten: vi.fn(() => Promise.resolve(new Map())),
  autorVon: () => null,
}));
vi.mock('./vorlagenZugriff', () => ({
  vorlagenZugriff: {
    liste: vi.fn(),
    vorlage: vi.fn(),
    aktionen: vi.fn(() => ({})),
  },
}));

const VORLAGEN: CtAblaufVorlage[] = [
  {
    id: 5,
    name: 'Gottesdienst',
    calendarId: 2,
    items: [{ id: 50, position: 0, title: 'Begrüßung', type: 'normal', duration: 300 }],
    eventStartPosition: 0,
  },
];
const planer = (vorlagenKalender: number[] | null = [2]) =>
  startFuer({
    rechte: {
      planbareDienstgruppen: [3],
      sichtbareDienstgruppen: [],
      ablaufKalender: [],
      vorlagenKalender,
      terminKalender: [],
      abwesenheitenAller: false,
    },
  });

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.mocked(ladeTermine).mockResolvedValue({ zeilen: [], plan: LEERER_PLAN });
  vi.mocked(vorlagenZugriff.liste).mockImplementation(() =>
    Promise.resolve(vorlagenStandAus(VORLAGEN, [{ id: 2, name: 'Gottesdienst' }], 'Europe/Berlin')),
  );
  vi.mocked(vorlagenZugriff.vorlage).mockImplementation((id) =>
    Promise.resolve(VORLAGEN.find((v) => v.id === id)!),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

const reiterAn = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Bereiche' }))
    .getByRole('button', { name })
    .getAttribute('aria-pressed');

it('„Planen“ → „Vorlagen“: Adresse #/vorlagen, die Liste steht da, „Planen“ bleibt markiert, die Matrix ist weg', async () => {
  vi.mocked(ladeStart).mockResolvedValue(planer());
  window.location.hash = '#/planen';
  render(<App />);
  await screen.findByRole('button', { name: 'Mehr' });
  mehrEintrag('Vorlagen');
  expect(window.location.hash).toBe('#/vorlagen');
  expect(await screen.findByRole('heading', { name: 'Ablaufvorlagen' })).toBeTruthy();
  expect(await screen.findByRole('region', { name: 'Gottesdienst' })).toBeTruthy();
  expect(reiterAn('Planen')).toBe('true');
  expect(screen.queryByText(/stehen keine Termine an/)).toBeNull();
});

it('eine Vorlage öffnen: #/vorlage/5; „‹ Vorlagen“ zurück in die Liste, „‹ Planen“ zurück nach Planen', async () => {
  vi.mocked(ladeStart).mockResolvedValue(planer());
  window.location.hash = '#/vorlagen';
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Gottesdienst/ }));
  expect(window.location.hash).toBe('#/vorlage/5');
  expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
  expect(screen.getByText('Ablaufvorlage · Kalender Gottesdienst')).toBeTruthy();
  expect(reiterAn('Planen')).toBe('true');

  fireEvent.click(screen.getByRole('button', { name: /Vorlagen/ }));
  expect(window.location.hash).toBe('#/vorlagen');
  expect(await screen.findByRole('heading', { name: 'Ablaufvorlagen' })).toBeTruthy();

  // „‹ Planen“ (nicht der Reiter oben): der Knopf im Kopf der Seite.
  const zurueck = screen
    .getAllByRole('button', { name: /Planen/ })
    .find((b) => !b.closest('[aria-label="Bereiche"]'))!;
  fireEvent.click(zurueck);
  expect(window.location.hash).toBe('#/planen');
  expect(await screen.findByText(/stehen keine Termine an/)).toBeTruthy();
});

it('Browser-Zurück und Neuladen: die Adresse bestimmt, was zu sehen ist', async () => {
  vi.mocked(ladeStart).mockResolvedValue(planer());
  window.location.hash = '#/vorlage/5';
  render(<App />);
  // Direkt auf eine Vorlage (Neuladen): sie steht da, der Reiter ist „Planen“.
  expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
  expect(reiterAn('Planen')).toBe('true');
  // „Zurück“ im Browser = die Adresse wechselt.
  window.location.hash = '#/vorlagen';
  expect(await screen.findByRole('heading', { name: 'Ablaufvorlagen' })).toBeTruthy();
  window.location.hash = '#/planen';
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Ablaufvorlagen' })).toBeNull());
  expect(await screen.findByText(/stehen keine Termine an/)).toBeTruthy();
});

it('ohne Recht, „Planen“ zu sehen: die Adresse führt zum Start, die Vorlagen werden nicht gelesen', async () => {
  vi.mocked(ladeStart).mockResolvedValue(
    startFuer({
      rechte: { ...planer().rechte, planbareDienstgruppen: [] },
    }),
  );
  window.location.hash = '#/vorlagen';
  render(<App />);
  expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Ablaufvorlagen' })).toBeNull();
  expect(vorlagenZugriff.liste).not.toHaveBeenCalled();
});

it('„Neue Vorlage“ und „Bearbeiten“ nach dem Recht für den Kalender – aus den Rechten des Starts', async () => {
  // Kein Recht für Kalender 2: nur ansehen.
  vi.mocked(ladeStart).mockResolvedValue(planer([9]));
  window.location.hash = '#/vorlagen';
  const { unmount } = render(<App />);
  const gd = await screen.findByRole('region', { name: 'Gottesdienst' });
  expect(within(gd).getByText('nur ansehen')).toBeTruthy();
  // `/calendars` kennt nur Kalender 2 – für den hat dieser Mensch kein Recht, also kein „Neue Vorlage“.
  expect(screen.queryByRole('button', { name: 'Neue Vorlage' })).toBeNull();
  unmount();
  // Admin-Recht ohne Aufzählung (`null`): alle Kalender.
  vi.mocked(ladeStart).mockResolvedValue(planer(null));
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Neue Vorlage' })).toBeTruthy();
});
