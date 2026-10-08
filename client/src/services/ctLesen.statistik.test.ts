import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf, KeinSpeicherRecht } from './ctRuntime';
import { _vergissNutzung, liedNutzung } from './ctLesen';
import { FakeCt } from './ctFake.testutil';

/**
 * Die Lied-Statistik in der Erweiterung (08.10.2026): EIN Aufruf `getSongStatistic` über die alte
 * Schnittstelle plus die Liederliste – statt des alten Laufs über alle Abläufe, den es in der
 * Extension deshalb gar nicht gab. Die Auswertung prüft `liedStatistik.test.ts` im Server.
 */
let ct: FakeCt;
const AJAX = 'POST /index.php?q=churchservice/ajax';

function json(body: unknown, status = 200): () => Response {
  return () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissNutzung();
  ct = new FakeCt();
  ct.installieren();
  ct.liefere('/api/songs', {
    data: [{ id: 7, name: 'Treu', arrangements: [{ id: 70 }, { id: 71 }] }],
  });
  // Gemessene Form: `data` ist direkt das Objekt je Arrangement-ID.
  ct.schreibAntworten[AJAX] = json({
    status: 'success',
    data: { '70': [{ date: '2026-06-01 10:00:00' }], '71': [{ date: '2026-07-05 10:00:00' }] },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('liedNutzung (Erweiterung)', () => {
  it('EIN Aufruf getSongStatistic mit CSRF und X-Requested-With; je Lied über alle Arrangements', async () => {
    const r = await liedNutzung();
    expect(r[7].dates).toEqual(['2026-07-05', '2026-06-01']);
    expect(ct.geschrieben).toMatchObject([
      { was: AJAX, felder: { func: 'getSongStatistic' }, csrf: 'csrf-123', xrw: 'XMLHttpRequest' },
    ]);
  });

  it('zehn Minuten gemerkt – der zweite Blick fragt ChurchTools nicht erneut', async () => {
    await liedNutzung();
    await liedNutzung();
    expect(ct.geschrieben.filter((g) => g.was === AJAX)).toHaveLength(1);
  });

  it('ohne Recht „Song-Statistik sehen": eine klare Meldung, und nichts wird gemerkt', async () => {
    ct.schreibAntworten[AJAX] = () =>
      new Response(JSON.stringify({ message: 'Die Session ist abgelaufen' }), { status: 401 });
    const fehler = await liedNutzung().catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(KeinSpeicherRecht);
    expect((fehler as Error).message).toContain('Song-Statistik sehen');
    ct.schreibAntworten[AJAX] = json({
      status: 'success',
      data: { '70': [{ date: '2026-06-01 10:00:00' }] },
    });
    expect((await liedNutzung())[7].dates).toEqual(['2026-06-01']);
  });
});
