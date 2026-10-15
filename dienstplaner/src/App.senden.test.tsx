// @vitest-environment jsdom
// Nur die Verdrahtung: Nach dem Senden (E4-4-2) lädt die App die Termine leise neu – Planen selbst ist ersetzt.
import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { ladeStart } from './start';
import { ladeTermine } from './ladeTermine';
import { startFuer } from './start.testutil';
import { LEERER_PLAN } from '@shared/dienstplan/zeile.testutil';
import type { TermineZustand } from './Termine';

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
  ladeLieder: vi.fn(() => Promise.resolve(null)),
  ladeAbwesenheiten: vi.fn(() => Promise.resolve([])),
  ladeMusikApp: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('./Planen', () => ({
  Planen: (p: { zustand: TermineZustand; onAktualisieren?: () => void }) => (
    <button type="button" onClick={p.onAktualisieren}>
      gesendet – Zustand {p.zustand.art}
    </button>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

it('nach dem Senden: dieselben Wochen neu, leise – das Bisherige bleibt stehen, bis das Neue da ist', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  window.location.hash = '#/planen';
  const start = startFuer({
    gruppen: [],
    rechte: {
      planbareDienstgruppen: [3],
      sichtbareDienstgruppen: [],
      ablaufKalender: [],
      abwesenheitenAller: false,
    },
  });
  vi.mocked(ladeStart).mockResolvedValue(start);
  let neu!: (d: { zeilen: []; plan: typeof LEERER_PLAN }) => void;
  vi.mocked(ladeTermine)
    .mockResolvedValueOnce({ zeilen: [], plan: LEERER_PLAN })
    .mockImplementationOnce(() => new Promise((r) => (neu = r)));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'gesendet – Zustand fertig' }));
  expect(vi.mocked(ladeTermine).mock.calls.map((c) => c[1])).toEqual([8, 8]);
  expect(screen.getByRole('button', { name: 'gesendet – Zustand fertig' })).toBeTruthy();
  await act(async () => neu({ zeilen: [], plan: LEERER_PLAN }));
});
