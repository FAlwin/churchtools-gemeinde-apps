import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import {
  ganzSichtbar,
  ladeStart,
  planbar,
  planbareDienstgruppen,
  startLiederAus,
  vorlageBearbeitbar,
} from './start';
import { dienstRechteAus } from '@shared/ct/dienstRechte';
import { startFuer } from './start.testutil';

/**
 * Der Start des Dienstplaners gegen eine nachgestellte ChurchTools-Instanz – Antworten in der Form, die
 * an der Test-Instanz gemessen wurde (12. und 13.10.2026).
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Antworten = Record<string, () => Response>;

function ct(antworten: Antworten) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const antwort = antworten[url.replace('https://ct.test/api', '')];
    return Promise.resolve(antwort ? antwort() : json(404, {}));
  });
}

const GUT: Antworten = {
  '/whoami': () => json(200, { data: { id: 1, firstName: 'Alwin', lastName: 'Friesen' } }),
  '/persons/1/groups': () =>
    json(200, {
      data: [
        {
          group: { title: 'Technik', domainIdentifier: '7' },
          groupTypeRoleId: 16,
          groupMemberStatus: 'active',
        },
      ],
    }),
  '/group/roles': () => json(200, { data: [{ id: 16, isLeader: true }] }),
  '/info': () => json(200, { siteName: 'ECG' }),
  '/permissions/global': () =>
    json(200, {
      data: {
        churchservice: { 'edit servicegroup': [3], 'edit agenda': [], 'manage absent': false },
      },
    }),
  '/servicegroups': () =>
    json(200, {
      data: [
        { id: 3, name: 'Technik', nameTranslated: 'Technik', sortKey: 30 },
        { id: 1, name: 'Programm', nameTranslated: 'Programm', sortKey: 10, viewAll: true },
      ],
    }),
  '/services': () =>
    json(200, { data: [{ id: 6, name: 'Ton', serviceGroupId: 3, sortKey: 0, groupIds: [7] }] }),
};

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
});

describe('ladeStart (Dienstplaner)', () => {
  it('Person, Gruppen, Dienstgruppen in Gemeinde-Reihenfolge und die Planer-Rechte', async () => {
    ct(GUT);
    expect(await ladeStart()).toEqual({
      // Ohne Lied-Rechte in der Antwort (LW2b): keine Liedauswahl, nur die Lied-Ansicht.
      lieder: { sehen: false, rechte: { statistik: false, ccli: false, liederAendern: false } },
      // Ohne „Berechtigungen verwalten“ (R-5a): keine Einrichtung der Erinnerungen.
      verwalten: false,
      ichId: 1,
      vorname: 'Alwin',
      nachname: 'Friesen',
      gemeinde: 'ECG',
      gruppen: [{ id: 7, name: 'Technik', leitung: true }],
      dienstgruppen: [
        { id: 1, name: 'Programm', fuerAlle: true },
        { id: 3, name: 'Technik', fuerAlle: false },
      ],
      dienste: new Map([
        [
          6,
          {
            id: 6,
            name: 'Ton',
            dienstgruppeId: 3,
            gruppenIds: [7],
            sortKey: 0,
            liveSteuern: false,
            absagen: true,
          },
        ],
      ]),
      rechte: {
        planbareDienstgruppen: [3],
        sichtbareDienstgruppen: [],
        ablaufKalender: [],
        vorlagenKalender: [],
        terminKalender: [],
        abwesenheitenAller: false,
      },
    });
  });

  it('„Berechtigungen verwalten“ (churchcore: administer persons) macht die Person zum Admin – nur das Recht, sonst nichts', async () => {
    const admin = (wert: unknown) =>
      ct({
        ...GUT,
        '/permissions/global': () =>
          json(200, {
            data: {
              churchcore: { 'administer persons': wert },
              churchservice: { 'edit servicegroup': [3] },
            },
          }),
      });
    admin(true);
    expect((await ladeStart()).verwalten).toBe(true);
    admin(false);
    expect((await ladeStart()).verwalten).toBe(false);
  });

  it('Dienste ohne Liste → Fehler 502 (ohne Dienste keine Namen und keine freien Plätze)', async () => {
    ct({ ...GUT, '/services': () => json(200, { data: null }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('niemand angemeldet → 401, Rechte und Dienstgruppen werden gar nicht erst gefragt', async () => {
    const spy = ct({ ...GUT, '/whoami': () => json(200, { data: { id: -1 } }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(401);
    expect(spy.mock.calls.map((c) => String(c[0]))).toEqual(['https://ct.test/api/whoami']);
  });

  it('leere Rechte-Antwort ist ein Aussetzer → Fehler, nicht „du planst nichts“', async () => {
    ct({ ...GUT, '/permissions/global': () => json(200, { data: {} }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Dienstgruppen ohne Liste → Fehler 502, nicht still leer', async () => {
    ct({ ...GUT, '/servicegroups': () => json(200, { data: null }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Dienstgruppen nicht lesbar (500) → Fehler', async () => {
    ct({ ...GUT, '/servicegroups': () => json(500, {}) });
    await expect(ladeStart()).rejects.toBeInstanceOf(ApiError);
  });
});

/**
 * Die Lied-Rechte des Dienstplaners (LW2b, 06.11.2026) – dieselbe Regel wie in der Musik-App (`rechteAus`), nur die
 * Übersetzung in die Liedauswahl. Geprüft wird jeder Teil für sich: sehen, Statistik, SongSelect, ändern.
 */
describe('startLiederAus (LW2b)', () => {
  const recht = (churchservice: Record<string, unknown>, weitere: Record<string, unknown> = {}) =>
    startLiederAus({ churchservice, ...weitere });

  it('ohne Lied-Rechte: nichts', () => {
    expect(recht({ 'edit agenda': [1] })).toEqual({
      sehen: false,
      rechte: { statistik: false, ccli: false, liederAendern: false },
    });
  });

  it('jedes Recht für sich', () => {
    expect(recht({ 'view songcategory': [1] }).sehen).toBe(true);
    expect(recht({ 'view song statistics': true }).rechte.statistik).toBe(true);
    expect(recht({ 'use ccli': true }).rechte.ccli).toBe(true);
    expect(recht({ 'edit songcategory': [1] }).rechte.liederAendern).toBe(true);
  });

  it('Admin darf Lieder sehen und ändern – SongSelect und Statistik aber nur mit eigenem Recht (wie die Musik-App)', () => {
    const a = recht({}, { churchcore: { 'administer persons': true } });
    expect(a.sehen).toBe(true);
    expect(a.rechte).toEqual({ statistik: false, ccli: false, liederAendern: true });
  });
});

describe('Wer plant was (E3-4): global, als Leitung, Termin-Admin in der Matrix', () => {
  it('Leitung einer Gruppe des Dienstes macht zum Planer – auch ohne globales Recht', () => {
    const ohneRecht = startFuer({
      rechte: {
        planbareDienstgruppen: [],
        sichtbareDienstgruppen: [],
        ablaufKalender: [],
        terminKalender: [],
        abwesenheitenAller: false,
      },
      gruppen: [{ id: 7, name: 'Technik', leitung: true }],
    });
    expect(planbareDienstgruppen(ohneRecht).map((g) => g.name)).toEqual(['Technik']);
    expect(planbar(ohneRecht, ohneRecht.dienste.get(6)!)).toBe(true);
    expect(planbar(ohneRecht, ohneRecht.dienste.get(9)!)).toBe(false);
  });

  it('nur Mitglied (keine Leitung) und ohne Recht → nichts planbar', () => {
    const mitglied = startFuer({
      rechte: {
        planbareDienstgruppen: [],
        sichtbareDienstgruppen: [],
        ablaufKalender: [],
        terminKalender: [],
        abwesenheitenAller: false,
      },
      gruppen: [{ id: 7, name: 'Technik', leitung: false }],
    });
    expect(planbareDienstgruppen(mitglied)).toEqual([]);
    expect(planbar(mitglied, mitglied.dienste.get(6)!, true)).toBe(true);
  });
});

describe('ganzSichtbar: was die Matrix zeigen darf (Prüfung mit drei Rollen, 13.10.2026)', () => {
  const OHNE = {
    planbareDienstgruppen: [],
    sichtbareDienstgruppen: [],
    ablaufKalender: [],
    terminKalender: [],
    abwesenheitenAller: false,
  };

  it('Mitglied ohne Recht: weder Technik noch Musik ganz', () => {
    const s = startFuer({ rechte: OHNE });
    expect(ganzSichtbar(s, s.dienste.get(6)!)).toBe(false);
    expect(ganzSichtbar(s, s.dienste.get(9)!)).toBe(false);
  });

  it('Leitung von Technik: Technik ganz, Musik nicht', () => {
    const s = startFuer({ rechte: OHNE, gruppen: [{ id: 7, name: 'Technik', leitung: true }] });
    expect(ganzSichtbar(s, s.dienste.get(6)!)).toBe(true);
    expect(ganzSichtbar(s, s.dienste.get(9)!)).toBe(false);
  });

  it('Dienstgruppe „für alle sichtbar“ kommt aus den Dienstgruppen des Starts', () => {
    const s = startFuer({ rechte: OHNE });
    s.dienstgruppen = s.dienstgruppen.map((g) => (g.id === 4 ? { ...g, fuerAlle: true } : g));
    expect(ganzSichtbar(s, s.dienste.get(9)!)).toBe(true);
  });

  it('Recht „Dienstgruppe sehen“', () => {
    const s = startFuer({ rechte: { ...OHNE, sichtbareDienstgruppen: [3] } });
    expect(ganzSichtbar(s, s.dienste.get(6)!)).toBe(true);
    expect(ganzSichtbar(s, s.dienste.get(9)!)).toBe(false);
  });
});

/**
 * **Wer Ablaufvorlagen bearbeiten darf** (E10-V3a): Die Rechte kommen aus dem Erzeuger (`dienstRechteAus`, wie
 * `/permissions/global` sie liefert) – nicht aus handgeschriebenen Listen. Der Zweig `null` („alle Kalender“, Admin)
 * war beim ersten Wurf ein `?? []`-Fehler: aus „alle“ wurde „keiner“.
 */
describe('vorlageBearbeitbar (E10-V3a)', () => {
  const mit = (recht: unknown) =>
    startFuer({
      rechte: dienstRechteAus(
        { churchservice: { 'edit agenda templates': recht } },
        (status, meldung) => new ApiError(status, meldung),
      ),
    });

  it('Liste von Kalendern: nur dort', () => {
    const s = mit([2, 5]);
    expect(vorlageBearbeitbar(s, 2)).toBe(true);
    expect(vorlageBearbeitbar(s, 3)).toBe(false);
  });

  it('Recht ohne Aufzählung (Admin): jeder Kalender, auch „ohne“', () => {
    const s = mit(true);
    expect(s.rechte.vorlagenKalender).toBeNull();
    expect(vorlageBearbeitbar(s, 3)).toBe(true);
    expect(vorlageBearbeitbar(s, null)).toBe(true);
  });

  it('kein Recht: nirgends – auch nicht, wenn nur das Feld fehlt (ältere Antwort)', () => {
    expect(vorlageBearbeitbar(mit(false), 2)).toBe(false);
    expect(vorlageBearbeitbar(startFuer(), 2)).toBe(false);
  });
});
