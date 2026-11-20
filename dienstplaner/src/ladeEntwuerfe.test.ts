import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { listeWert } from '@shared/dienstplan/personenliste.testutil';
import { reiheSetzen } from '@shared/dienstplan/personenliste';
import { startFuer } from './start.testutil';
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

/** Ein Personenliste-Wert der Schublade – gebaut mit der Test-Hilfe, die auch die Leser-Tests nutzen. */
const listenWert = (id: number, x: Parameters<typeof listeWert>[0]) => listeWert(x, id);

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
    // Je Entwurf die Gruppe seiner Schublade (#582 – verwerfen auch ohne Matrix-Zeile).
    expect([...d.gruppeJe]).toEqual([
      ['20|7|-', 3],
      ['21|7|-', 3],
    ]);
  });

  it('die Personenliste je Dienstgruppe kommt aus denselben Werten – ohne weitere Anfrage, nicht als Entwurf', async () => {
    const spy = ct({
      ...GRUND,
      'GET /api/custommodules/16/customdatacategories/30/customdatavalues': () =>
        json(200, { data: [wert(100, 20), listenWert(102, { reihe: [46, 1] })] }),
    });
    const d = await ladeEntwuerfe([TECHNIK, MUSIK]);
    expect(d.personenlisten.get(3)?.reihe).toEqual([46, 1]);
    expect(d.personenlisten.has(4)).toBe(false);
    // Der Wert ist kein Entwurf: nur der echte steht bei den Entwürfen.
    expect([...d.entwuerfe.keys()]).toEqual(['20|7|-']);
    // Eine Anfrage je Schublade wie vorher – die Liste kostet keine zusätzliche.
    const werteAnfragen = spy.mock.calls.filter(([u]) => String(u).includes('customdatavalues'));
    expect(werteAnfragen).toHaveLength(2);
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

describe('Personenliste speichern (PL-2, Durchstich über den Anschluss)', () => {
  it('liest frisch, schreibt in die Schublade der Gruppe, liest nach – ohne Schublade „kein Recht“ ohne Anfrage', async () => {
    let werte = [wert(100, 20)];
    const spy = ct({
      ...GRUND,
      'GET /api/csrftoken': () => json(200, { data: 'tok' }),
      'GET /api/custommodules/16/customdatacategories/30/customdatavalues': () =>
        json(200, { data: werte }),
      'POST /api/custommodules/16/customdatacategories/30/customdatavalues': (init) => {
        werte = [
          ...werte,
          {
            id: 101,
            dataCategoryId: 30,
            value: (JSON.parse(String(init?.body)) as { value: string }).value,
          },
        ];
        return json(201, { data: werte[1] });
      },
    });
    const anschluss = entwurfAnschluss(startFuer(), () => [TECHNIK, PROGRAMM]);
    const d = await ladeEntwuerfe([TECHNIK, PROGRAMM]);
    const r = await anschluss.personenliste(d, 3, (alt) => reiheSetzen(alt, [46, 1]), null);
    expect(r).toMatchObject({ ok: true, liste: { version: 1, reihe: [46, 1] } });
    // Der Wert liegt neben dem Entwurf, der Entwurf bleibt unberührt.
    expect(werte.map((w) => w.id)).toEqual([100, 101]);
    expect(spy.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1);
    spy.mockClear();
    expect(await anschluss.personenliste(d, 1, (alt) => reiheSetzen(alt, [1]), null)).toEqual({
      ok: false,
      grund: 'kein-recht',
    });
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
  type Roh = { id: number; serviceId: number; index: number | null; personId: null; name: null };
  const START = startFuer();

  /**
   * ChurchTools und der Speicher der Erweiterung zum Anfassen: Termin 20 mit Licht (Dienst 7, Technik) – `eventservices`
   * nummeriert wie gemessen (19.11.2026: die ID bleibt, ein einzelner Platz hat keine Nummer); die Schublade 30 (Technik) hält
   * die Werte.
   */
  function welt(
    plaetze: Roh[],
    werte: ReturnType<typeof wert>[],
    routen: Record<string, Antwort> = {},
  ) {
    let naechste = 900;
    const w = { plaetze, werte };
    const spy = ct({
      ...GRUND,
      'GET /api/csrftoken': () => json(200, { data: 'tok' }),
      'GET /api/events/20': () => json(200, { data: { id: 20, eventServices: w.plaetze } }),
      'PUT /api/events/20/eventservices': (init) => {
        const b = JSON.parse(String(init?.body)) as { services: { count: number }[] };
        const n = b.services[0].count;
        while (w.plaetze.length < n)
          w.plaetze.push({ id: naechste++, serviceId: 7, index: null, personId: null, name: null });
        w.plaetze.length = n;
        w.plaetze.forEach((p, i) => (p.index = n === 1 ? null : i + 1));
        return new Response(null, { status: 204 });
      },
      'GET /api/custommodules/16/customdatacategories/30/customdatavalues': () =>
        json(200, { data: w.werte }),
      ...Object.fromEntries(
        w.werte.map((x) => [
          `PUT /api/custommodules/16/customdatacategories/30/customdatavalues/${x.id}`,
          (init?: RequestInit) => {
            x.value = (JSON.parse(String(init?.body)) as { value: string }).value;
            return json(200, { data: x });
          },
        ]),
      ),
      ...routen,
    });
    return { w, spy };
  }
  const platz = (id: number, index: number | null): Roh => ({
    id,
    serviceId: 7,
    index,
    personId: null,
    name: null,
  });
  const ortVon = (x: { value: string }) =>
    (JSON.parse(x.value) as { ort: { index: number | null }; version: number }).ort.index;

  it('liest frisch, schreibt eventservices, liest nach – erst dann „ok“', async () => {
    const { spy } = welt([platz(1, null)], []);
    const a = entwurfAnschluss(START, () => []);
    const r = await a.anzahl(20, 7, 1, 2);
    expect(r).toMatchObject({ ok: true, anzahl: 2 });
    expect(spy.mock.calls.filter((c) => c[1]?.method === 'PUT')).toHaveLength(1);
  });

  it('1 → 2: der Entwurf auf dem einzelnen Platz (ohne Nummer) zieht auf Platz 1 um – derselbe Wert, Version + 1 (19.11.2026)', async () => {
    const { w } = welt([platz(1, null)], [wert(100, 20)]);
    const a = entwurfAnschluss(START, () => []);
    const r = await a.anzahl(20, 7, 1, 2);
    expect(r).toMatchObject({
      ok: true,
      anzahl: 2,
      entwuerfe: { umgetragen: ['20|7|1'], offen: 0, unklar: false },
    });
    expect(w.werte.map((x) => [x.id, ortVon(x)])).toEqual([[100, 1]]);
    expect((JSON.parse(w.werte[0].value) as { version: number }).version).toBe(2);
  });

  it('keine Entwürfe an diesem Dienst: es wird nichts in die Schublade geschrieben', async () => {
    const { w, spy } = welt([platz(1, null)], [wert(100, 21)]); // Entwurf an einem anderen Termin
    const r = await entwurfAnschluss(START, () => []).anzahl(20, 7, 1, 2);
    expect(r).toMatchObject({ ok: true, entwuerfe: { umgetragen: [], offen: 0, unklar: false } });
    expect(
      spy.mock.calls.filter(
        (c) => String(c[0]).includes('customdatavalues') && c[1]?.method === 'PUT',
      ),
    ).toHaveLength(0);
    expect(w.werte.map(ortVon)).toEqual([null]);
  });

  it('Schublade nur zum Lesen: die Zahl steht, der Anschluss meldet „unklar“ und fasst die Entwürfe nicht an', async () => {
    const { w } = welt([platz(1, null)], [wert(100, 20)], {
      'GET /api/permissions/global': () =>
        json(200, { data: { dienstplaner: { ...RECHTE, 'edit custom data': [] } } }),
    });
    const r = await entwurfAnschluss(START, () => []).anzahl(20, 7, 1, 2);
    expect(r).toMatchObject({ ok: true, anzahl: 2, entwuerfe: { unklar: true } });
    expect(w.werte.map(ortVon)).toEqual([null]);
  });

  it('Speicher vorübergehend nicht erreichbar: die Zahl steht, „unklar“ – nichts verloren', async () => {
    const { w } = welt([platz(1, null)], [wert(100, 20)], {
      'GET /api/custommodules/16/customdatacategories/30/customdatavalues': () => json(503, {}),
    });
    const r = await entwurfAnschluss(START, () => []).anzahl(20, 7, 1, 2);
    expect(r).toMatchObject({ ok: true, anzahl: 2, entwuerfe: { unklar: true } });
    expect(w.werte).toHaveLength(1);
  });

  it('Dienst ohne Dienstgruppe oder Gruppe ohne Schublade: nur die Zahl, kein Eintrag „entwuerfe“', async () => {
    welt([platz(1, null)], []);
    // Musik (Gruppe 4) hat in GRUND keine Schublade mit Werten; ein Dienst ohne Gruppe gar keine.
    const ohneGruppe = startFuer({ dienste: new Map() });
    const r = await entwurfAnschluss(ohneGruppe, () => []).anzahl(20, 7, 1, 2);
    expect(r).toMatchObject({ ok: true, anzahl: 2 });
    expect(r.ok && r.entwuerfe).toBeFalsy();
  });

  it('scheitert die Änderung selbst, passiert mit den Entwürfen nichts', async () => {
    const { w } = welt([platz(1, null)], [wert(100, 20)]);
    const r = await entwurfAnschluss(START, () => []).anzahl(20, 7, 5, 6); // gesehen ≠ jetzt → Konflikt
    expect(r).toMatchObject({ ok: false, grund: 'konflikt' });
    expect(w.werte.map(ortVon)).toEqual([null]);
  });
});
