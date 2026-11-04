import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abwesenheitPort } from './abwesenheitPort';
import { ApiError } from './fehler';
import { _bremseLoesen, _vergissCsrf } from './verbindung';

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** ChurchTools im Test: `/csrftoken` beantwortet er immer, alles andere `antwort`. */
function ct(antwort: (url: string, init?: RequestInit) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
    return Promise.resolve(antwort(url, init));
  });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('abwesenheitPort.einer', () => {
  it('liefert den Eintrag', async () => {
    ct(() => json(200, { data: { id: 7, startDate: '2027-03-10', endDate: '2027-03-10' } }));
    expect(await abwesenheitPort.einer(19, 7)).toMatchObject({ id: 7 });
  });

  it('404 (gibt es nicht, oder fremd über den eigenen Pfad) → `null`', async () => {
    ct(() => json(404, { message: 'nicht gefunden' }));
    expect(await abwesenheitPort.einer(19, 7)).toBeNull();
  });

  it('ein Aussetzer (503) wirft – er darf beim Nachlesen nicht wie „gelöscht“ aussehen', async () => {
    ct(() => json(503, { message: 'weg' }));
    await expect(abwesenheitPort.einer(19, 7)).rejects.toMatchObject({ status: 503 });
  });

  it('eine unlesbare Antwort wirft ebenfalls', async () => {
    ct(() => json(200, { data: null }));
    await expect(abwesenheitPort.einer(19, 7)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('abwesenheitPort schreiben', () => {
  it('anlegen = POST mit dem Rumpf, ändern = PUT auf die ID, löschen = DELETE – je mit CSRF-Token', async () => {
    const spy = ct(() => json(200, { data: { id: 7 } }));
    const rumpf = {
      startDate: '2027-03-10',
      endDate: '2027-03-10',
      absenceReasonId: 1,
      comment: '',
    };
    await abwesenheitPort.anlegen(19, rumpf);
    await abwesenheitPort.ersetzen(19, 7, rumpf);
    await abwesenheitPort.loeschen(19, 7);
    const schreiben = spy.mock.calls.filter(([u]) => !String(u).endsWith('/csrftoken'));
    expect(schreiben.map(([u, i]) => `${i?.method} ${String(u)}`)).toEqual([
      'POST https://ct.test/api/persons/19/absences',
      'PUT https://ct.test/api/persons/19/absences/7',
      'DELETE https://ct.test/api/persons/19/absences/7',
    ]);
    expect(JSON.parse(String(schreiben[0][1]?.body))).toEqual(rumpf);
    expect((schreiben[2][1]?.headers as Record<string, string>)['CSRF-Token']).toBe('tok');
  });

  it('die Gründe kommen aus /event/masterdata', async () => {
    const spy = ct(() => json(200, { data: { absenceReasons: [] } }));
    expect(await abwesenheitPort.stammdaten()).toEqual({ absenceReasons: [] });
    expect(String(spy.mock.calls[0][0])).toBe('https://ct.test/api/event/masterdata');
  });
});
