import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeTermine } from './ladeTermine';
import type { Start } from './start';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const START: Start = {
  ichId: 1,
  vorname: 'Alwin',
  gemeinde: null,
  gruppen: [],
  dienstgruppen: [],
  rechte: { planbareDienstgruppen: [3], ablaufKalender: [], abwesenheitenAller: false },
};

const TERMINE = {
  data: [
    {
      id: 7,
      name: 'Gottesdienst',
      startDate: '2026-10-18T08:00:00Z',
      endDate: '2026-10-18T10:00:00Z',
      eventServices: [
        { serviceId: 6, personId: 1, name: 'Alwin', isAccepted: true },
        { serviceId: 7, personId: null, name: null },
      ],
    },
  ],
};
const DIENSTE = {
  data: [
    { id: 6, name: 'Ton', serviceGroupId: 3 },
    { id: 7, name: 'Licht', serviceGroupId: 3 },
  ],
};

function ct(termine: () => Response, dienste: () => Response = () => json(200, DIENSTE)) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input instanceof Request ? input.url : input);
    return Promise.resolve(url.includes('/services') ? dienste() : termine());
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
afterEach(() => vi.unstubAllGlobals());

describe('ladeTermine', () => {
  it('Zeitraum ab heute über `wochen` (hier 16, nicht die Vorgabe 8), mit den Plätzen; eigene Dienste und freie Plätze', async () => {
    const spy = ct(() => json(200, TERMINE));
    const z = await ladeTermine(START, 16, 'Europe/Berlin', new Date('2026-10-13T12:00:00Z'));
    expect(String(spy.mock.calls.find((c) => String(c[0]).includes('/events'))?.[0])).toBe(
      'https://ct.test/api/events?from=2026-10-13&to=2027-02-02&include=eventServices',
    );
    expect(z).toEqual([
      {
        id: 7,
        name: 'Gottesdienst',
        beginn: '2026-10-18T08:00:00Z',
        ende: '2026-10-18T10:00:00Z',
        tag: '2026-10-18',
        uhrzeit: '10:00',
        endeUhrzeit: '12:00',
        abgesagt: false,
        meine: [{ dienst: 'Ton', zugesagt: true }],
        geplant: 2,
        frei: 1,
        freiNachGruppe: { 3: 1 },
        team: [],
      },
    ]);
  });

  it('Termine ohne Liste → Fehler 502, nicht „keine Termine“', async () => {
    ct(() => json(200, { data: null }));
    const e = await ladeTermine(START, 8, 'Europe/Berlin').catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Dienste nicht lesbar → Fehler (ohne Dienste keine Namen und keine freien Plätze)', async () => {
    ct(
      () => json(200, TERMINE),
      () => json(500, {}),
    );
    await expect(ladeTermine(START, 8, 'Europe/Berlin')).rejects.toBeInstanceOf(ApiError);
  });
});
