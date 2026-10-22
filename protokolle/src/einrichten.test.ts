import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { STANDARD_VORLAGEN } from '@shared/protokolle/vorlagen';
import { gruppeEinrichten, ladeGruppe, ladeVerwaltung, type Wahl } from './einrichten';

/**
 * Einrichten (S2-1) gegen eine nachgestellte ChurchTools-Instanz, die sich merkt, was gesetzt wurde – so
 * verhalten wie gemessen: `PUT` ergänzt, `DELETE` entzieht, Zeilen je `dataId`, Kategorien mit `shorty`.
 * `schlucken` lässt ChurchTools „204“ sagen und nichts speichern.
 */
const MODUL = 24;
const N = { view: 2060, kat: 2061, dat: 2065, anl: 2066, aend: 2067, loe: 2068 };
const DEFINITIONEN = {
  modules: [
    {
      key: 'churchcal',
      permissions: [
        { authId: 403, key: 'view category' },
        { authId: 404, key: 'edit category' },
      ],
    },
    {
      key: 'protokolle',
      permissions: [
        { authId: N.view, key: 'view' },
        { authId: N.kat, key: 'view custom category' },
        { authId: N.dat, key: 'view custom data' },
        { authId: N.anl, key: 'create custom data' },
        { authId: N.aend, key: 'edit custom data' },
        { authId: N.loe, key: 'delete custom data' },
      ],
    },
  ],
};
const LEITER = 2126;
const TEILNEHMER = 2123;

let rechte: Map<number, Set<string>>;
let kategorien: { id: number; shorty: string; name: string }[];
let werte: Map<number, { id: number; value: string }[]>;
let naechste: number;
let aufrufe: string[];
let admin: boolean;
let schlucken: Set<string>;
let fehlerBei: { methode: string; status: number } | null;
let definitionen: unknown;

const schl = (authId: number, dataId: number | null | undefined): string =>
  `${authId}:${dataId ?? '-'}`;
const von = (rolle: number): string[] => [...(rechte.get(rolle) ?? [])].sort();

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ct(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const pfad = new URL(String(input)).pathname.replace(/^\/api/, '');
    const m = (init?.method ?? 'GET').toUpperCase();
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    aufrufe.push(`${m} ${pfad}`);
    if (pfad === '/csrftoken') return json(200, { data: 't' });
    if (fehlerBei && fehlerBei.methode === m) return json(fehlerBei.status, { message: 'weg' });
    if (pfad === '/permissions/global')
      return json(200, { data: { churchcore: { 'administer persons': admin } } });
    if (pfad === '/permissions/definitions') return json(200, { data: definitionen });
    if (pfad === '/groups')
      return json(200, {
        data: [
          { id: 194, name: 'Technik', settings: { isHidden: false } },
          { id: 11, name: 'Gemeindeleitung', settings: { isHidden: true } },
        ],
        meta: { pagination: { lastPage: 1 } },
      });
    if (pfad === '/calendars') return json(200, { data: [{ id: 4, name: 'Gemeindeleitung' }] });
    if (pfad === '/groups/194/roles')
      return json(200, {
        data: [
          { id: LEITER, nameTranslated: 'Leiter', isLeader: true, isActive: true },
          { id: TEILNEHMER, nameTranslated: 'Teilnehmer', isLeader: false, isActive: true },
          { id: 9, nameTranslated: 'Alt', isActive: false },
        ],
      });
    const r = /^\/permissions\/group_role\/(\d+)$/.exec(pfad);
    if (r) {
      const rolle = Number(r[1]);
      const set = rechte.get(rolle) ?? new Set<string>();
      rechte.set(rolle, set);
      if (m === 'GET')
        return json(200, {
          data: [...set].map((s) => {
            const [a, d] = s.split(':');
            return { authId: Number(a), dataId: d === '-' ? null : Number(d), type: 'grant' };
          }),
        });
      const k = schl(body.authId as number, (body.dataId as number[] | undefined)?.[0]);
      if (schlucken.has(`${m} ${k}`)) return json(204, null);
      if (m === 'PUT') set.add(k);
      if (m === 'DELETE') set.delete(k);
      return json(204, null);
    }
    if (pfad === `/custommodules/${MODUL}/customdatacategories`) {
      if (m === 'POST') {
        kategorien.push({ id: naechste++, shorty: String(body.shorty), name: String(body.name) });
        return json(201, { data: {} });
      }
      return json(200, { data: kategorien });
    }
    const w =
      /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (w) {
      const liste = werte.get(Number(w[1])) ?? [];
      werte.set(Number(w[1]), liste);
      if (m === 'GET') return json(200, { data: liste });
      if (m === 'POST' && schlucken.has('WERT')) return json(201, { data: {} });
      if (m === 'POST') liste.push({ id: naechste++, value: String(body.value) });
      if (m === 'PUT') liste.find((x) => x.id === Number(w[2]))!.value = String(body.value);
      return json(m === 'POST' ? 201 : 200, { data: {} });
    }
    return json(404, { message: `nicht nachgestellt: ${m} ${pfad}` });
  });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  rechte = new Map();
  kategorien = [];
  werte = new Map();
  naechste = 50;
  aufrufe = [];
  admin = true;
  schlucken = new Set();
  fehlerBei = null;
  definitionen = DEFINITIONEN;
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
  ct();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const GRUPPE = { id: 194, name: 'Technik', versteckt: false };
const WAHL: Wahl = {
  rollen: [
    { rolle: LEITER, stufe: 'leitung' },
    { rolle: TEILNEHMER, stufe: 'mitglied' },
  ],
  punkte: 'vorschlagen',
  kalender: 4,
};
const kat = (shorty: string): number => kategorien.find((k) => k.shorty === shorty)!.id;
const einstellungen = (): unknown[] =>
  (werte.get(kat('protokolle-g194')) ?? [])
    .map((w) => JSON.parse(w.value) as { art: string })
    .filter((x) => x.art === 'einstellung');

describe('gruppeEinrichten', () => {
  it('erstes Einrichten: Kategorien, Rechte je Stufe, Einstellung, drei Standard-Vorlagen', async () => {
    const e = await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    expect(kategorien.map((k) => [k.shorty, k.name])).toEqual([
      ['protokolle-g194', 'Protokolle · Technik'],
      ['mitarbeit-g194', 'Mitarbeit · Technik'],
      ['vorlagen', 'Vorlagen'],
    ]);
    const [p, mi, vo] = [kat('protokolle-g194'), kat('mitarbeit-g194'), kat('vorlagen')];
    expect(von(TEILNEHMER)).toEqual(
      [
        schl(N.view, null),
        ...[p, mi, vo].flatMap((k) => [schl(N.kat, k), schl(N.dat, k)]),
        schl(N.anl, mi),
        schl(N.aend, mi),
        schl(403, 4),
      ].sort(),
    );
    expect(von(LEITER)).toEqual(
      expect.arrayContaining([schl(N.aend, p), schl(N.loe, p), schl(404, 4)]),
    );
    expect(einstellungen()).toEqual([e]);
    expect(e).toMatchObject({ gruppe: 194, punkte: 'vorschlagen', kalender: 4 });
    const vorlagen = (werte.get(vo) ?? []).map(
      (w) => (JSON.parse(w.value) as { name: string }).name,
    );
    expect(vorlagen).toEqual(STANDARD_VORLAGEN.map((v) => v.name));
  });

  it('versteckte Gruppe: jede Rolle mit Zugriff bekommt „versteckte Gruppe sehen“ (10119)', async () => {
    await gruppeEinrichten(MODUL, { ...GRUPPE, versteckt: true }, WAHL);
    expect(von(TEILNEHMER)).toContain(schl(10119, null));
    expect(von(LEITER)).toContain(schl(10119, null));
  });

  it('erneut einrichten mit Herabstufung: entzieht, schiebt danach ein PUT nach, ändert die Einstellung', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    const p = kat('protokolle-g194');
    aufrufe = [];
    await gruppeEinrichten(MODUL, GRUPPE, {
      ...WAHL,
      rollen: [
        { rolle: LEITER, stufe: 'mitglied' },
        { rolle: TEILNEHMER, stufe: 'keine' },
      ],
      punkte: 'direkt',
    });
    expect(von(LEITER)).not.toContain(schl(N.aend, p));
    expect(von(TEILNEHMER).filter((s) => /^20(61|65|66|67):/.test(s))).toEqual([]);
    // Nach dem letzten DELETE muss noch ein PUT kommen – sonst wirkt der Entzug weiter (S0, S2-1).
    const rechteAufrufe = aufrufe.filter((a) => /^(PUT|DELETE) \/permissions/.test(a));
    expect(rechteAufrufe.some((a) => a.startsWith('DELETE'))).toBe(true);
    const letztesDelete = rechteAufrufe.map((a) => a.startsWith('DELETE')).lastIndexOf(true);
    expect(rechteAufrufe.slice(letztesDelete + 1).some((a) => a.startsWith('PUT'))).toBe(true);
    // Eine Einstellung, geändert – nicht eine zweite daneben.
    expect(einstellungen()).toEqual([expect.objectContaining({ punkte: 'direkt' })]);
  });

  it('Herabstufen/Kalender weg: selbst gesetzte Kalender-Rechte gehen, von Hand gesetzte bleiben', async () => {
    rechte.set(LEITER, new Set([schl(403, 4)])); // von Hand, vor dem Einrichten
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    expect(von(LEITER)).toContain(schl(404, 4));
    expect(von(TEILNEHMER)).toContain(schl(403, 4));
    await gruppeEinrichten(MODUL, GRUPPE, {
      ...WAHL,
      rollen: [
        { rolle: LEITER, stufe: 'leitung' },
        { rolle: TEILNEHMER, stufe: 'keine' },
      ],
      kalender: null,
    });
    expect(von(TEILNEHMER)).not.toContain(schl(403, 4));
    expect(von(LEITER)).not.toContain(schl(404, 4));
    expect(von(LEITER)).toContain(schl(403, 4)); // von Hand – bleibt
    expect(einstellungen()).toEqual([expect.objectContaining({ vergeben: [] })]);
  });

  it('Rolle fehlt in der neuen Wahl (z. B. gelöscht): ihre selbst gesetzten Kalender-Rechte gehen trotzdem', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    await gruppeEinrichten(MODUL, GRUPPE, {
      ...WAHL,
      rollen: [{ rolle: LEITER, stufe: 'leitung' }],
    });
    expect(von(TEILNEHMER)).not.toContain(schl(403, 4));
  });

  it('Vorlagen schon da: keine zweiten Standard-Vorlagen', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    await gruppeEinrichten(MODUL, { id: 11, name: 'Gemeindeleitung', versteckt: true }, WAHL);
    expect(werte.get(kat('vorlagen'))).toHaveLength(STANDARD_VORLAGEN.length);
  });

  it('ChurchTools sagt 204, setzt aber nichts: NichtUebernommen – und KEINE Einstellung („eingerichtet“)', async () => {
    schlucken.add(`PUT ${schl(N.dat, 50)}`); // Daten sehen auf „Protokolle“ (erste Kategorie, ID 50)
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toBeInstanceOf(NichtUebernommen);
    expect(einstellungen()).toEqual([]);
  });

  it('Einstellung mit 201 quittiert, aber nicht gespeichert: NichtUebernommen statt „eingerichtet“', async () => {
    schlucken.add('WERT');
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toThrow(
      'die Einstellung der Gruppe',
    );
  });

  it('ein nicht übernommener Entzug wird ebenso gemeldet', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    schlucken.add(`DELETE ${schl(N.aend, kat('protokolle-g194'))}`);
    await expect(
      gruppeEinrichten(MODUL, GRUPPE, { ...WAHL, rollen: [{ rolle: LEITER, stufe: 'mitglied' }] }),
    ).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('vorübergehender Fehler beim Setzen: wirft, schreibt keine Einstellung, löscht nichts', async () => {
    fehlerBei = { methode: 'PUT', status: 503 };
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toBeInstanceOf(ApiError);
    expect(aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
    expect(einstellungen()).toEqual([]);
  });

  it('Modul ohne Rechte-Definitionen: 404, es wird nichts angelegt', async () => {
    definitionen = { modules: [] };
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toMatchObject({ status: 404 });
    expect(aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([]);
  });
});

describe('ladeVerwaltung / ladeGruppe', () => {
  it('ohne Admin-Recht: darf nicht, und es werden keine Gruppen gelesen', async () => {
    admin = false;
    expect(await ladeVerwaltung(MODUL)).toEqual({ darf: false, gruppen: [], kalender: [] });
    expect(aufrufe).toEqual(['GET /permissions/global']);
  });

  it('Admin: alle Gruppen nach Namen, versteckt markiert, eingerichtet nur mit beiden Kategorien', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    kategorien.push({ id: 99, shorty: 'protokolle-g11', name: 'Protokolle · Gemeindeleitung' });
    const v = await ladeVerwaltung(MODUL);
    expect(v.gruppen).toEqual([
      { id: 11, name: 'Gemeindeleitung', versteckt: true, eingerichtet: false },
      { id: 194, name: 'Technik', versteckt: false, eingerichtet: true },
    ]);
    expect(v.kalender).toEqual([{ id: 4, name: 'Gemeindeleitung' }]);
  });

  it('ladeGruppe: aktive Rollen und die gespeicherte Einstellung', async () => {
    expect((await ladeGruppe(MODUL, 194)).einstellung).toBeNull();
    const e = await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    const g = await ladeGruppe(MODUL, 194);
    expect(g.rollen).toEqual([
      { id: LEITER, name: 'Leiter', leitung: true },
      { id: TEILNEHMER, name: 'Teilnehmer', leitung: false },
    ]);
    expect(g.einstellung).toEqual(e);
  });
});
