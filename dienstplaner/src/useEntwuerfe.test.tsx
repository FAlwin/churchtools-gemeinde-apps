// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import { ALWIN, daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import { useEntwuerfe } from './useEntwuerfe';

/**
 * `setzen` hält `gruppeJe` mit (18.11.2026, Fund bei der Abnahme „Alle verwerfen“ auf der Test-Instanz): Vorher stand
 * dort nur, was beim Laden da war – ein frisch angelegter Entwurf fehlte, bis neu geladen wurde. Davon hängen der
 * Zauberstab (`zauberEingeplant`) und die Lage alter Entwürfe (`entwurfsLage`) ab.
 */
afterEach(cleanup);

const K = '20|7|2';

it('ein neu gespeicherter Entwurf steht sofort in `gruppeJe`, ein entfernter ist dort wieder weg', async () => {
  const anschluss = nachgebaut({
    laden: vi.fn(() => Promise.resolve(daten())),
    speichern: vi.fn((_d, _g, eingabe) =>
      Promise.resolve({
        ok: true as const,
        entwurf: { ...eingabe, zeit: 'jetzt', version: 1 } as Entwurf,
      }),
    ),
  });
  const { result } = renderHook(() => useEntwuerfe(anschluss, null, '2026-10-14', false));
  await waitFor(() => expect(result.current.ew.art).toBe('fertig'));
  const d = result.current.daten!;
  expect(d.gruppeJe.has(K)).toBe(false);

  await act(() =>
    result.current.speichern(
      d,
      3,
      {
        ort: { eventId: 20, serviceId: 7, index: 2 },
        ziel: entwurf().ziel,
        gesehen: { art: 'frei' },
      },
      null,
    ),
  );
  expect(result.current.daten!.entwuerfe.get(K)?.von).toEqual(ALWIN);
  expect(result.current.daten!.gruppeJe.get(K)).toBe(3);

  act(() => result.current.setzen(K, null, 3));
  expect(result.current.daten!.entwuerfe.has(K)).toBe(false);
  expect(result.current.daten!.gruppeJe.has(K)).toBe(false);
});
