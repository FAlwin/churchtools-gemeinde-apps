import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf, verbindungEinrichten } from '@ui/ct/verbindung';
import { ladePersonen, personAus } from './kiPersonen';

/**
 * **Personen für „Mit KI füllen“** (S8-2): `firstName`/`lastName` → `vorname`/`nachname`, und über das **echte**
 * Blättern von `ctAlleSeiten` (nicht über ein nachgebautes) – mehr als eine Seite zu 200 muss ankommen.
 */
beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  verbindungEinrichten({});
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** `n` Personen, seitenweise wie ChurchTools (`meta.pagination.lastPage`). */
function persons(n: number) {
  const alle = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    firstName: `Vor${i + 1}`,
    lastName: `Nach${i + 1}`,
  }));
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get('limit'));
    const seite = Number(url.searchParams.get('page'));
    return Promise.resolve(
      json({
        data: alle.slice((seite - 1) * limit, seite * limit),
        meta: { pagination: { lastPage: Math.ceil(n / limit) } },
      }),
    );
  });
}

describe('ladePersonen', () => {
  it('blättert über zwei Seiten (250 Personen, 200 je Seite) und bildet firstName/lastName ab', async () => {
    const spy = persons(250);
    const liste = await ladePersonen();
    expect(liste).toHaveLength(250);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[0][0])).toBe('https://ct.test/api/persons?limit=200&page=1');
    expect(String(spy.mock.calls[1][0])).toBe('https://ct.test/api/persons?limit=200&page=2');
    expect(liste[0]).toEqual({ id: 1, vorname: 'Vor1', nachname: 'Nach1' });
    expect(liste[249]).toEqual({ id: 250, vorname: 'Vor250', nachname: 'Nach250' });
  });

  it('ein Lesefehler wird nicht verschluckt', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    await expect(ladePersonen()).rejects.toBeDefined();
  });

  it('Einträge ohne Nummer fallen weg, fehlende Namen werden leer', () => {
    expect(personAus({ firstName: 'A' })).toBeNull();
    expect(personAus({ id: 4, firstName: 'Ina' })).toEqual({ id: 4, vorname: 'Ina', nachname: '' });
  });
});
