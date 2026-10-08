import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Die Lied-Statistik aus ChurchTools selbst (`getSongStatistic`, Alwin 08.10.2026) – ein Aufruf statt
 * des alten Laufs über alle Abläufe (#300). Die Auswertung prüft `liedStatistik.test.ts`; hier geht es
 * um das, was der Server drumherum tut: merken, bündeln, nach einer Drosselung still halten.
 *
 * `importOriginal`, damit `isCtOverloaded`/`CtOverloadedError` die ECHTEN sind – sonst prüften die
 * Drosselungs-Tests die Attrappe statt des Verhaltens.
 */
const anfrage = vi.hoisted(() => vi.fn());
vi.mock('./ctAjax.js', async (importOriginal) => {
  const { HttpError } = await import('../middleware/errorHandler.js');
  return {
    ...(await importOriginal<typeof import('./ctAjax.js')>()),
    altPortFuer: () => ({
      anfrage,
      fehler: (status: number, meldung: string) => new HttpError(status, meldung),
    }),
  };
});
vi.mock('./ctRead.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ctRead.js')>()),
  getAllSongs: vi.fn(),
}));

import {
  getSongUsageMap,
  invalidateSongUsageCache,
  __resetSongUsageForTests,
} from './setlistBuilder.js';
import { CtOverloadedError } from './ctHttp.js';
import { getAllSongs } from './ctRead.js';
import { HttpError } from '../middleware/errorHandler.js';

type Lieder = Awaited<ReturnType<typeof getAllSongs>>;
const LIEDER = [
  { id: 10, name: 'Treu', arrangements: [{ id: 100 }, { id: 101 }] },
  { id: 20, name: 'Halleluja', arrangements: [{ id: 200 }] },
] as unknown as Lieder;

/** Die echte Form (gemessen 08.10.2026): je Arrangement-ID die Termine, Ortszeit ohne Zone. */
const STATISTIK = {
  '100': [{ date: '2026-06-01 10:00:00', category_id: '2' }],
  '101': [{ date: '2026-07-05 10:00:00', category_id: '2' }],
  '200': [
    { date: '2026-07-05 10:00:00', category_id: '2' },
    { date: '2026-08-02 10:00:00', category_id: '2' }, // Zukunft
  ],
};

beforeEach(() => {
  __resetSongUsageForTests();
  anfrage.mockReset();
  vi.mocked(getAllSongs).mockReset();
  vi.mocked(getAllSongs).mockResolvedValue(LIEDER);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('getSongUsageMap – aus der ChurchTools-Statistik', () => {
  it('EIN Aufruf getSongStatistic; je Lied über alle Arrangements, neuester zuerst, ohne Zukunft', async () => {
    anfrage.mockResolvedValue(STATISTIK);
    const usage = await getSongUsageMap('cookie');
    expect(anfrage).toHaveBeenCalledTimes(1);
    expect(anfrage.mock.calls[0][0]).toBe('getSongStatistic');
    expect(usage[10].dates).toEqual(['2026-07-05', '2026-06-01']);
    expect(usage[20].dates).toEqual(['2026-07-05']);
  });

  it('gemerkt: der zweite Aufruf fragt ChurchTools nicht erneut', async () => {
    anfrage.mockResolvedValue(STATISTIK);
    await getSongUsageMap('cookie');
    await getSongUsageMap('cookie');
    expect(anfrage).toHaveBeenCalledTimes(1);
  });

  it('nach einer Ablauf-Änderung holt der nächste Aufruf neu', async () => {
    anfrage.mockResolvedValue(STATISTIK);
    await getSongUsageMap('cookie');
    invalidateSongUsageCache();
    await getSongUsageMap('cookie');
    expect(anfrage).toHaveBeenCalledTimes(2);
  });

  it('fünf gleichzeitige Aufrufe → EIN Abruf (#300)', async () => {
    let fertig!: (v: unknown) => void;
    anfrage.mockReturnValue(new Promise((r) => (fertig = r)));
    const alle = Promise.all(Array.from({ length: 5 }, () => getSongUsageMap('cookie')));
    await vi.waitFor(() => expect(anfrage).toHaveBeenCalledTimes(1));
    fertig(STATISTIK);
    expect((await alle).every((u) => u[10].dates.length === 2)).toBe(true);
    expect(anfrage).toHaveBeenCalledTimes(1);
  });
});

describe('getSongUsageMap – Drosselung und Fehler', () => {
  it('Drosselung ohne früheren Stand → 503, und danach eine Weile kein Abruf (#300)', async () => {
    anfrage.mockRejectedValue(new CtOverloadedError(60_000));
    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });
    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });
    expect(anfrage).toHaveBeenCalledTimes(1);
  });

  it('Drosselung mit früherem Stand → der alte Stand statt keiner Zahlen', async () => {
    anfrage.mockResolvedValueOnce(STATISTIK);
    await getSongUsageMap('cookie');
    invalidateSongUsageCache();
    anfrage.mockRejectedValueOnce(new CtOverloadedError(60_000));
    expect((await getSongUsageMap('cookie'))[10].dates).toEqual(['2026-07-05', '2026-06-01']);
  });

  it('fehlendes Recht wird durchgereicht und NICHT als leere Statistik gemerkt', async () => {
    anfrage.mockRejectedValueOnce(new HttpError(403, 'Keine Berechtigung für die Lied-Statistik'));
    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 403 });
    anfrage.mockResolvedValueOnce(STATISTIK);
    expect((await getSongUsageMap('cookie'))[20].dates).toEqual(['2026-07-05']);
  });
});
