import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeTermine, ladeZeitraum } from './ladeTermine';
import type { Start } from './start';
import { startFuer } from './start.testutil';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const START: Start = startFuer({
  gemeinde: null,
  rechte: {
    planbareDienstgruppen: [3],
    sichtbareDienstgruppen: [],
    ablaufKalender: [],
    abwesenheitenAller: false,
  },
});

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
// Die Dienste kommen aus dem Start (startFuer: Ton/Licht in Technik), nicht aus einer eigenen Abfrage.
function ct(termine: () => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(termine()));
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ladeTermine', () => {
  it('Zeitraum ab heute über `wochen` (hier 16, nicht die Vorgabe 8), mit den Plätzen; eigene Dienste und freie Plätze', async () => {
    const spy = ct(() => json(200, TERMINE));
    const d = await ladeTermine(START, 16, 'Europe/Berlin', new Date('2026-10-13T12:00:00Z'));
    // Eine Abfrage – die Dienste kennt schon der Start.
    expect(spy.mock.calls.map((c) => String(c[0]))).toEqual([
      'https://ct.test/api/events?from=2026-10-13&to=2027-02-02&include=eventServices',
    ]);
    expect(d.plan.spalten.map((s) => s.id)).toEqual([7]);
    expect(d.plan.gruppen.map((g) => [g.gruppe?.name, g.planbar, g.frei])).toEqual([
      ['Technik', true, [1]],
    ]);
    expect(d.zeilen).toEqual([
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

  it('Mitglied ohne Recht: eigener Dienst steht in der Liste, aber nicht als halbe Gruppe in der Matrix', async () => {
    ct(() => json(200, TERMINE));
    const mitglied = startFuer({
      rechte: {
        planbareDienstgruppen: [],
        sichtbareDienstgruppen: [],
        ablaufKalender: [],
        abwesenheitenAller: false,
      },
    });
    const d = await ladeTermine(mitglied, 8, 'Europe/Berlin', new Date('2026-10-13T12:00:00Z'));
    expect(d.zeilen[0].meine).toEqual([{ dienst: 'Ton', zugesagt: true }]);
    expect(d.plan.gruppen).toEqual([]);
    expect(d.plan.spalten[0]).toMatchObject({ plaetze: 0, besetzt: 0 });
  });

  it('Termine ohne Liste → Fehler 502, nicht „keine Termine“', async () => {
    ct(() => json(200, { data: null }));
    const e = await ladeTermine(START, 8, 'Europe/Berlin').catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });
});

describe('ladeZeitraum (Zeitraum-Knopf, 14.10.2026)', () => {
  it('beide Tage eingeschlossen – ChurchTools nimmt `to` ausschließlich, also einen Tag mehr', async () => {
    const spy = ct(() => json(200, TERMINE));
    const d = await ladeZeitraum(START, '2026-10-01', '2026-10-31', 'Europe/Berlin');
    expect(spy.mock.calls.map((c) => String(c[0]))).toEqual([
      'https://ct.test/api/events?from=2026-10-01&to=2026-11-01&include=eventServices',
    ]);
    expect(d.plan.spalten.map((s) => s.id)).toEqual([7]);
  });

  it('über den Jahreswechsel', async () => {
    const spy = ct(() => json(200, { data: [] }));
    await ladeZeitraum(START, '2026-12-01', '2026-12-31', 'Europe/Berlin');
    expect(String(spy.mock.calls[0][0])).toContain('from=2026-12-01&to=2027-01-01&');
  });

  it('ohne Liste → Fehler 502 wie bei „ab heute“', async () => {
    ct(() => json(200, { data: null }));
    const e = await ladeZeitraum(START, '2026-10-01', '2026-10-31', 'Europe/Berlin').catch(
      (x: unknown) => x,
    );
    expect((e as ApiError).status).toBe(502);
  });
});
