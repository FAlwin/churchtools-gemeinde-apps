import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { _vergissWerKann } from './ladeWerKann';
import { abfrageSchluessel, ladeZauberstab } from './ladeZauberstab';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const kandidat = (id: number) => ({
  person: { title: `P${id}`, domainIdentifier: String(id) },
  score: 0,
});
const termin = (input: unknown) => Number(/events\/(\d+)\//.exec(String(input))![1]);

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissWerKann();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ladeZauberstab', () => {
  it('je Termin und Dienst eine Abfrage – zwei Plätze desselben Dienstes teilen sie sich; mit Fortschritt', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(json(200, { data: [kandidat(termin(input))] })),
      );
    const fortschritt = vi.fn();
    const m = await ladeZauberstab(
      [
        { terminId: 20, serviceId: 6 },
        { terminId: 20, serviceId: 6 },
        { terminId: 21, serviceId: 6 },
      ],
      { fortschritt },
    );
    expect(spy).toHaveBeenCalledTimes(2);
    expect(m.get(abfrageSchluessel(20, 6))).toEqual([kandidat(20)]);
    expect(m.get(abfrageSchluessel(21, 6))).toEqual([kandidat(21)]);
    expect(fortschritt.mock.calls).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('höchstens 4 Abfragen gleichzeitig', async () => {
    let laufen = 0;
    let hoechstens = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      laufen++;
      hoechstens = Math.max(hoechstens, laufen);
      await new Promise((r) => setTimeout(r, 5));
      laufen--;
      return json(200, { data: [] });
    });
    await ladeZauberstab(
      Array.from({ length: 10 }, (_, i) => ({ terminId: 30 + i, serviceId: 6 })),
    );
    expect(hoechstens).toBe(4);
  });

  it('ein Fehler bricht den Lauf ab (sonst sähe der Dienst aus wie „niemand passt“) – danach keine neuen Abfragen', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      await new Promise((r) => setTimeout(r, termin(input) === 40 ? 1 : 10));
      return termin(input) === 40 ? json(502, { message: 'weg' }) : json(200, { data: [] });
    });
    await expect(
      ladeZauberstab(Array.from({ length: 12 }, (_, i) => ({ terminId: 40 + i, serviceId: 6 }))),
    ).rejects.toThrow();
    // Die ersten 4 liefen schon; nach dem Fehler fängt keiner eine neue an.
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('Abbrechen: keine neuen Abfragen, der Lauf endet mit AbortError', async () => {
    const ab = new AbortController();
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      ab.abort();
      return json(200, { data: [] });
    });
    await expect(
      ladeZauberstab(
        Array.from({ length: 12 }, (_, i) => ({ terminId: 60 + i, serviceId: 6 })),
        { signal: ab.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(spy.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('während der letzten Abfrage abgebrochen: trotzdem kein Ergebnis', async () => {
    const ab = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      ab.abort();
      return json(200, { data: [] });
    });
    await expect(
      ladeZauberstab([{ terminId: 90, serviceId: 6 }], { signal: ab.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('schon vor dem Start abgebrochen: keine einzige Abfrage', async () => {
    const ab = new AbortController();
    ab.abort();
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: [] }));
    await expect(
      ladeZauberstab([{ terminId: 80, serviceId: 6 }], { signal: ab.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(spy).not.toHaveBeenCalled();
  });
});
