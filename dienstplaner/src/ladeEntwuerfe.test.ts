import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import type { Start } from './start';
import {
  _vergissModul,
  entferneEntwurf,
  entwurfAnschluss,
  ladeEntwuerfe,
  richteSchubladeEin,
  sendeEntwuerfe,
} from './ladeEntwuerfe';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const TECHNIK = { id: 3, name: 'Technik', fuerAlle: false };
const MUSIK = { id: 4, name: 'Musik', fuerAlle: false };
const PROGRAMM = { id: 1, name: 'Programm', fuerAlle: false };

const wert = (id: number, eventId: number, von = 'Alwin') => ({
  id,
  dataCategoryId: 30,
  value: JSON.stringify({
    art: 'dienstplaner-entwurf',
    fassung: 1,
    ort: { eventId, serviceId: 7, index: null },
    ziel: { art: 'person', personId: 46, name: 'Ben Test' },
    modus: 'anfrage',
    gesehen: { art: 'frei' },
    von: { personId: 1, name: von },
    zeit: '2026-10-14T20:00:00.000Z',
    version: 1,
  }),
});

type Antwort = (init?: RequestInit) => Response;
function ct(routen: Record<string, Antwort>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    const r = routen[`${init?.method ?? 'GET'} ${url.pathname}`];
    return Promise.resolve(r ? r(init) : json(404, {}));
  });
}

const RECHTE = {
  'create custom category': false,
  'view custom data': [30, 31],
  'create custom data': [30, 31],
  'edit custom data': [30, 31],
  'delete custom data': [30],
};
const GRUND = {
  'GET /api/custommodules': () => json(200, { data: [{ id: 16, shorty: 'dienstplaner' }] }),
  'GET /api/permissions/global': () => json(200, { data: { dienstplaner: RECHTE } }),
  'GET /api/custommodules/16/customdatacategories': () =>
    json(200, {
      data: [
        { id: 30, shorty: 'dienstplaner-entwuerfe-3' },
        { id: 31, shorty: 'dienstplaner-entwuerfe-4' },
      ],
    }),
  'GET /api/custommodules/16/customdatacategories/30/customdatavalues': () =>
    json(200, { data: [wert(100, 20), wert(101, 21)] }),
  'GET /api/custommodules/16/customdatacategories/31/customdatavalues': () =>
    json(200, { data: [] }),
};

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissModul();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ladeEntwuerfe', () => {
  it('je Gruppe ihre Schublade mit Stand aus den Rechten; Entwürfe nur aus sichtbaren Schubladen', async () => {
    ct(GRUND);
    const d = await ladeEntwuerfe([TECHNIK, MUSIK, PROGRAMM]);
    expect(d.modul).toBe(16);
    expect([...d.schubladen.values()].map((s) => [s.gruppe.name, s.kategorie, s.stand])).toEqual([
      ['Technik', 30, 'bereit'],
      ['Musik', 31, 'nur-lesen'], // löschen fehlt
      ['Programm', null, 'fehlt'],
    ]);
    expect([...d.entwuerfe.keys()]).toEqual(['20|7|-', '21|7|-']);
  });

  it('Rechte jedes Mal frisch – nach dem Einrichten sind sie neu (im Browser-Check gefunden)', async () => {
    let rechte: Record<string, unknown> = { 'create custom category': true };
    const spy = ct({
      ...GRUND,
      'GET /api/permissions/global': () => json(200, { data: { dienstplaner: rechte } }),
      'GET /api/custommodules/16/customdatacategories': () => json(200, { data: [] }),
    });
    const vorher = await ladeEntwuerfe([TECHNIK]);
    expect(vorher.schubladen.get(3)?.stand).toBe('einrichtbar');
    rechte = { ...RECHTE, 'view custom data': [30], 'delete custom data': [30] };
    spy.mockRestore();
    ct(GRUND);
    const nachher = await ladeEntwuerfe([TECHNIK]);
    expect(nachher.schubladen.get(3)?.stand).toBe('bereit');
  });

  it('eine Schublade nicht lesbar (vorübergehend) → steht an ihr, die anderen gehen', async () => {
    ct({
      ...GRUND,
      'GET /api/custommodules/16/customdatacategories/31/customdatavalues': () =>
        json(502, { message: 'weg' }),
    });
    const d = await ladeEntwuerfe([TECHNIK, MUSIK]);
    expect(d.schubladen.get(4)?.fehler).toBe('voruebergehend');
    expect(d.schubladen.get(3)?.fehler).toBeUndefined();
    expect(d.entwuerfe.size).toBe(2);
  });

  it('kein Dienstplaner-Modul → Fehler mit dem richtigen Namen (nicht „Musik App“)', async () => {
    ct({ ...GRUND, 'GET /api/custommodules': () => json(200, { data: [] }) });
    await expect(ladeEntwuerfe([TECHNIK])).rejects.toMatchObject({
      status: 404,
      message: 'Der Dienstplaner ist in ChurchTools nicht zu finden.',
    });
  });

  it('Rechte ohne Dienstplaner-Eintrag → nichts darf man', async () => {
    ct({ ...GRUND, 'GET /api/permissions/global': () => json(200, { data: {} }) });
    const d = await ladeEntwuerfe([TECHNIK]);
    expect(d.schubladen.get(3)?.stand).toBe('fehlt');
    expect(d.entwuerfe.size).toBe(0);
  });
});

describe('richteSchubladeEin', () => {
  it('legt die Kategorie mit Kürzel und Namen der Gruppe an und sieht danach nach', async () => {
    let liste: { id: number; shorty: string }[] = [];
    const spy = ct({
      ...GRUND,
      'GET /api/csrftoken': () => json(200, { data: 'tok' }),
      'GET /api/custommodules/16/customdatacategories': () => json(200, { data: liste }),
      'POST /api/custommodules/16/customdatacategories': (init) => {
        const b = JSON.parse(String(init?.body)) as { shorty: string; name: string };
        expect(b).toMatchObject({ shorty: 'dienstplaner-entwuerfe-3', name: 'Entwürfe Technik' });
        liste = [{ id: 40, shorty: b.shorty }];
        return json(201, { data: { id: 40 } });
      },
    });
    expect(await richteSchubladeEin(TECHNIK)).toBe(40);
    expect(spy.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1);
  });

  it('ChurchTools sagt „angelegt“, nachgelesen fehlt sie → Fehler statt Erfolg', async () => {
    ct({
      ...GRUND,
      'GET /api/csrftoken': () => json(200, { data: 'tok' }),
      'GET /api/custommodules/16/customdatacategories': () => json(200, { data: [] }),
      'POST /api/custommodules/16/customdatacategories': () => json(201, { data: { id: 40 } }),
    });
    await expect(richteSchubladeEin(TECHNIK)).rejects.toMatchObject({ status: 502 });
  });
});

describe('entferneEntwurf', () => {
  it('löscht den Wert in der Schublade der Gruppe; ohne Schublade → „kein Recht“, ohne Anfrage', async () => {
    let werte = [wert(100, 20)];
    const spy = ct({
      ...GRUND,
      'GET /api/csrftoken': () => json(200, { data: 'tok' }),
      'GET /api/custommodules/16/customdatacategories/30/customdatavalues': () =>
        json(200, { data: werte }),
      'DELETE /api/custommodules/16/customdatacategories/30/customdatavalues/100': () => {
        werte = [];
        return new Response(null, { status: 204 });
      },
    });
    const d = await ladeEntwuerfe([TECHNIK, PROGRAMM]);
    const ort = { eventId: 20, serviceId: 7, index: null };
    expect(await entferneEntwurf(d, 3, ort, 1)).toEqual({ ok: true, entwurf: null });
    expect(spy.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(true);
    spy.mockClear();
    expect(await entferneEntwurf(d, 1, ort, 1)).toEqual({ ok: false, grund: 'kein-recht' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('sendeEntwuerfe (Durchstich mit den echten Anschlüssen)', () => {
  it('liest frisch, schreibt den Platz, liest nach – erst dann wird der Entwurf gelöscht', async () => {
    // Wie gemessen: ChurchTools schreibt beim Einteilen den Namen an den Platz – ohne Namen gilt er als frei.
    let platz = {
      id: 807,
      serviceId: 7,
      index: null,
      personId: null as number | null,
      name: null as string | null,
    };
    let werte = [wert(100, 20)];
    const reihe: string[] = [];
    const spy = ct({
      ...GRUND,
      'GET /api/csrftoken': () => json(200, { data: 'tok' }),
      'GET /api/events/20': () => {
        reihe.push(`lesen ${platz.personId ?? 'frei'}`);
        return json(200, { data: { id: 20, eventServices: [platz] } });
      },
      'PUT /api/events/20/servicerequests/807': (init) => {
        reihe.push('schreiben');
        const b = JSON.parse(String(init?.body)) as { personId: number };
        platz = { ...platz, id: 900, personId: b.personId, name: 'Ben Test' };
        return json(200, {});
      },
      'GET /api/custommodules/16/customdatacategories/30/customdatavalues': () =>
        json(200, { data: werte }),
      'DELETE /api/custommodules/16/customdatacategories/30/customdatavalues/100': () => {
        reihe.push(`löschen bei ${platz.personId}`);
        werte = [];
        return new Response(null, { status: 204 });
      },
    });
    const d = await ladeEntwuerfe([TECHNIK]);
    const e = d.entwuerfe.get('20|7|-')!;
    const gemeldet: unknown[] = [];
    const r = await sendeEntwuerfe(d, [{ entwurf: e, kategorie: 30 }], (i, x) =>
      gemeldet.push([i, x]),
    );
    expect(r).toEqual([{ art: 'gesendet' }]);
    expect(gemeldet).toEqual([[0, { art: 'gesendet' }]]);
    expect(reihe).toEqual(['lesen frei', 'schreiben', 'lesen 46', 'löschen bei 46']);
    const put = spy.mock.calls.find((c) => c[1]?.method === 'PUT')!;
    expect(JSON.parse(String(put[1]?.body))).toEqual({
      personId: 46,
      name: null,
      isAccepted: false,
    });
  });
});

describe('Anzahl der Plätze (E4-5-3, Durchstich über den Anschluss)', () => {
  it('liest frisch, schreibt eventservices, liest nach – erst dann „ok“', async () => {
    let plaetze = [{ id: 1, serviceId: 8, index: null, personId: null, name: null }];
    const spy = ct({
      'GET /api/csrftoken': () => json(200, { data: 'tok' }),
      'GET /api/events/20': () => json(200, { data: { id: 20, eventServices: plaetze } }),
      'PUT /api/events/20/eventservices': (init) => {
        const b = JSON.parse(String(init?.body)) as { services: { count: number }[] };
        expect(b).toEqual({ eventId: 20, services: [{ serviceId: 8, count: 2 }] });
        plaetze = [...plaetze, { id: 2, serviceId: 8, index: null, personId: null, name: null }];
        return new Response(null, { status: 204 });
      },
    });
    const a = entwurfAnschluss({ ichId: 1, vorname: 'Alwin' } as Start, () => []);
    expect(await a.anzahl(20, 8, 1, 2)).toEqual({ ok: true, anzahl: 2 });
    expect(spy.mock.calls.filter((c) => c[1]?.method === 'PUT')).toHaveLength(1);
  });
});
