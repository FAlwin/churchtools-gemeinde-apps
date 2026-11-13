// @vitest-environment jsdom
// Nur die Verdrahtung: Ändert die Termin-Ansicht Infos oder Dateien, lädt die App die Termine leise neu – sonst zeigte
// die Matrix nach „‹ Planen“ den alten Stand (Test-Instanz T2b, 03.11.2026). Die Termin-Ansicht selbst ist ersetzt.
import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { ladeStart } from './start';
import { ladeTermine } from './ladeTermine';
import { startFuer } from './start.testutil';
import { LEERER_PLAN } from '@shared/dienstplan/zeile.testutil';

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
vi.mock('./ladeBeiwerk', () => ({
  ladeTerminVorlagen: vi.fn(() => Promise.resolve([])),
  ladeLieder: vi.fn(() => Promise.resolve(null)),
  ladeAbwesenheiten: vi.fn(() => Promise.resolve([])),
  ladeMusikApp: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('./TerminAnsicht', () => ({
  TerminAnsicht: (p: { onGeaendert?: () => void }) => (
    <button type="button" onClick={p.onGeaendert}>
      Infos gespeichert
    </button>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

it('Termin-Ansicht meldet eine Änderung → dieselben Wochen leise neu', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  window.location.hash = '#/termin/160';
  vi.mocked(ladeStart).mockResolvedValue(startFuer());
  let neu!: (d: { zeilen: []; plan: typeof LEERER_PLAN }) => void;
  vi.mocked(ladeTermine)
    .mockResolvedValueOnce({ zeilen: [], plan: LEERER_PLAN })
    .mockImplementationOnce(() => new Promise((r) => (neu = r)));
  render(<App />);
  const knopf = await screen.findByRole('button', { name: 'Infos gespeichert' });
  await vi.waitFor(() => expect(vi.mocked(ladeTermine)).toHaveBeenCalledTimes(1));
  fireEvent.click(knopf);
  expect(vi.mocked(ladeTermine).mock.calls.map((c) => c[1])).toEqual([8, 8]);
  // Leise: Die Termin-Ansicht bleibt stehen, kein „wird geladen“.
  expect(screen.getByRole('button', { name: 'Infos gespeichert' })).toBeTruthy();
  await act(async () => neu({ zeilen: [], plan: LEERER_PLAN }));
});
