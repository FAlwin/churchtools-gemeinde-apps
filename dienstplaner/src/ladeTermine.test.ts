import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { terminStand } from '@shared/dienstplan/plan';
import {
  ladeRohTermine,
  ladeTermin,
  ladeTermine,
  ladeZeitraum,
  TERMIN_VERWEIGERT,
} from './ladeTermine';
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
    terminKalender: [],
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
        abgesagt: false,
        kalender: null,
        meine: [
          { dienst: 'Ton', zugesagt: true, ort: { serviceId: 6, index: null }, absagen: true },
        ],
        geplant: 2,
        frei: 1,
        freiNachGruppe: { 3: 1 },
        freiePlaetze: [{ serviceId: 7, index: null }],
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
        terminKalender: [],
        abwesenheitenAller: false,
      },
    });
    const d = await ladeTermine(mitglied, 8, 'Europe/Berlin', new Date('2026-10-13T12:00:00Z'));
    expect(d.zeilen[0].meine).toEqual([
      { dienst: 'Ton', zugesagt: true, ort: { serviceId: 6, index: null }, absagen: true },
    ]);
    expect(d.plan.gruppen).toEqual([]);
    expect(terminStand(d.plan.gruppen, 0)).toBeNull();
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

describe('ladeTermin (Termin-Ansicht, E6-1b)', () => {
  it('ein Termin mit Plätzen – dieselben Regeln wie die Matrix (Plan + Liste)', async () => {
    const spy = ct(() => json(200, { data: TERMINE.data[0] }));
    const d = await ladeTermin(START, 7, 'Europe/Berlin');
    expect(spy.mock.calls.map((c) => String(c[0]))).toEqual([
      'https://ct.test/api/events/7?include=eventServices',
    ]);
    expect(d.plan.spalten.map((s) => [s.id, s.uhrzeit])).toEqual([[7, '10:00']]);
    const ton = d.plan.gruppen.flatMap((g) => g.zeilen).find((z) => z.dienst.name === 'Ton')!;
    expect(ton.zellen[0]!.map((p) => p.name)).toEqual(['Alwin']);
  });

  it('ohne Plätze-Liste → Fehler 502 (sonst stünde „keine Dienste“ da); 404 kommt durch', async () => {
    ct(() => json(200, { data: { id: 7, name: 'Gottesdienst' } }));
    expect(
      ((await ladeTermin(START, 7, 'Europe/Berlin').catch((x: unknown) => x)) as ApiError).status,
    ).toBe(502);
    vi.restoreAllMocks();
    ct(() => json(404, { message: 'Not found.' }));
    expect(
      ((await ladeTermin(START, 7, 'Europe/Berlin').catch((x: unknown) => x)) as ApiError).status,
    ).toBe(404);
  });

  it('Termin ohne Recht → sagt, dass ChurchTools den Termin nicht zeigt (nicht die Regel fürs Planen)', async () => {
    const verbot = {
      message: 'Keine ausreichende Berechtigung.',
      messageKey: 'error.forbidden.view',
    };
    ct(() => json(403, verbot));
    const e = (await ladeTermin(START, 7, 'Europe/Berlin').catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(403);
    expect(e.message).toBe(TERMIN_VERWEIGERT);
  });
});

describe('Termine ohne sichtbaren Platz (Jugend-Fund, 27.11.2026)', () => {
  // Wie ChurchTools einem liefert, der die Dienstgruppe nicht sehen darf: das Event, aber ohne Plätze.
  const LEER = {
    id: 8,
    name: 'Jugend',
    startDate: '2026-10-23T17:00:00Z',
    endDate: '2026-10-23T19:00:00Z',
    eventServices: [],
  };
  const NUR_EIGENER = {
    id: 9,
    name: 'Jugend-Special',
    startDate: '2026-10-30T17:00:00Z',
    endDate: '2026-10-30T19:00:00Z',
    eventServices: [{ serviceId: 6, personId: 1, name: 'Alwin', isAccepted: true }],
  };
  const ALLE = { data: [...TERMINE.data, LEER, NUR_EIGENER] };
  const ADMIN: Start = startFuer({
    rechte: { ...START.rechte, sichtbareDienstgruppen: null, planbareDienstgruppen: null },
  });
  const jetzt = new Date('2026-10-13T12:00:00Z');

  it('Liste und Matrix: der leere Termin fehlt, Termine mit Platz und mit nur eigenem Platz bleiben', async () => {
    ct(() => json(200, ALLE));
    const d = await ladeTermine(START, 16, 'Europe/Berlin', jetzt);
    expect(d.zeilen.map((z) => z.id)).toEqual([7, 9]);
    expect(d.plan.spalten.map((s) => s.id)).toEqual([7, 9]);
  });

  it('ein gewählter Zeitraum (Planen) ebenso', async () => {
    ct(() => json(200, ALLE));
    const d = await ladeZeitraum(START, '2026-10-01', '2026-10-31', 'Europe/Berlin');
    expect(d.zeilen.map((z) => z.id)).toEqual([7, 9]);
    expect(d.plan.spalten.map((s) => s.id)).toEqual([7, 9]);
  });

  it('wer alle Dienstgruppen sieht (z. B. Admin): der leere Termin bleibt – dort lassen sich Dienste einschalten', async () => {
    ct(() => json(200, ALLE));
    const d = await ladeTermine(ADMIN, 16, 'Europe/Berlin', jetzt);
    expect(d.zeilen.map((z) => z.id)).toEqual([7, 8, 9]);
    expect(d.plan.spalten.map((s) => s.id)).toEqual([7, 8, 9]);
  });

  it('Verfügbarkeit (ladeRohTermine): dieselbe Regel', async () => {
    ct(() => json(200, ALLE));
    expect((await ladeRohTermine(START, '2026-10-01', '2026-11-01')).map((t) => t.id)).toEqual([
      7, 9,
    ]);
    expect((await ladeRohTermine(ADMIN, '2026-10-01', '2026-11-01')).map((t) => t.id)).toEqual([
      7, 8, 9,
    ]);
  });

  it('ein einzelner Termin (Link, Termin-Ansicht) bleibt wie er ist – auch ohne Platz', async () => {
    ct(() => json(200, { data: LEER }));
    const d = await ladeTermin(START, 8, 'Europe/Berlin');
    expect(d.zeilen.map((z) => z.id)).toEqual([8]);
  });
});
