import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import * as E from './einrichten';
import * as M from './mitglieder';
import { ApiError } from '@ui/ct/fehler';
import type { HandPlatz } from '@shared/anmeldung/vonHand';
import { GibtEsSchon, personenSuchen, vonHandAnmelden, type VonHandPlan } from './vonHand';

/**
 * Anmeldung von Hand schreiben (A7-4a) gegen ein nachgestelltes ChurchTools – so, wie es am 19.10.2026 gemessen
 * wurde: `PUT` nimmt mit Rolle, Status und Feldern auf, `DELETE` entfernt (danach 404), `POST /persons` meldet einen
 * gleichen Namen mit 400 und `args.duplicatePersonId`.
 */
vi.mock('@ui/ct/verbindung', () => ({ ctAnfrage: vi.fn(), ctDaten: vi.fn() }));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  anmeldungVon: vi.fn(),
  speichereAnmeldung: vi.fn(),
  teilnehmerRolle: vi.fn(),
  neuePersonVorgaben: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ personenRoh: vi.fn() }));
const ct = vi.mocked(V);
const ei = vi.mocked(E);
const mi = vi.mocked(M);

const GRUPPE = 165;
const HEUTE = '2026-10-22';
const NR_FELD = 669;
const HANNA = 152;

interface Mitglied {
  groupTypeRoleId: number;
  groupMemberStatus: string;
  waitinglistPosition: number | null;
  fields: { id: number; value: unknown }[];
}
let gruppe: Map<number, Mitglied>;
let max: number | null;
let personen: Map<number, { id: number; firstName: string; lastName: string; birthday?: string }>;
/** ChurchTools setzt einen anderen Status als geschickt. */
let andererStatus: string | null;
/** Das Eintragen scheitert. */
let putFehler: ApiError | null;
/** Eine Person mit diesem Namen gibt es schon (Nummer). */
let doppelt: number | null;
const anfragen: { pfad: string; method: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  gruppe = new Map();
  max = 10;
  personen = new Map([[HANNA, { id: HANNA, firstName: 'Hanna', lastName: 'Handtest' }]]);
  andererStatus = null;
  putFehler = null;
  doppelt = null;
  anfragen.length = 0;
  ei.teilnehmerRolle.mockResolvedValue(32);
  ei.neuePersonVorgaben.mockResolvedValue({ statusId: 2, campusId: 0, departmentId: 1 });
  ei.anmeldungVon.mockImplementation(async () => ({
    maxPlaetze: max,
    warteliste: true,
    ab: null,
    bis: null,
  }));
  ei.speichereAnmeldung.mockImplementation(async (_id, a) => {
    max = a.maxPlaetze;
  });
  mi.personenRoh.mockImplementation(async (ids: number[]) =>
    ids.flatMap((i) => (personen.has(i) ? [structuredClone(personen.get(i)!)] : [])),
  );
  ct.ctDaten.mockImplementation(async (pfad: string) => {
    const m = /\/groups\/\d+\/members\/(\d+)$/.exec(pfad);
    if (m) {
      const x = gruppe.get(Number(m[1]));
      if (!x) throw new ApiError(404, 'nicht gefunden');
      return structuredClone(x);
    }
    if (pfad.startsWith('/search'))
      return [
        { domainType: 'person', domainIdentifier: '152', domainAttributes: {} },
        { domainType: 'person', domainIdentifier: '7', domainAttributes: { isArchived: true } },
        { domainType: 'person', domainIdentifier: '99', domainAttributes: {} },
      ];
    throw new Error(`unerwartet: ${pfad}`);
  });
  ct.ctAnfrage.mockImplementation(async (pfad: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    anfragen.push({ pfad, method, body });
    if (pfad.startsWith('/persons') && method === 'POST') {
      if (doppelt !== null && !pfad.includes('force=true'))
        throw new ApiError(400, 'Es gibt bereits eine Person mit diesem Namen.', {
          args: { duplicatePersonId: doppelt },
        });
      personen.set(200, {
        id: 200,
        firstName: body.firstName as string,
        lastName: body.lastName as string,
      });
      return { data: { id: 200 } };
    }
    if (pfad.startsWith('/persons/') && method === 'PATCH') {
      personen.get(Number(pfad.split('/')[2]))!.birthday = body.birthday as string;
      return null;
    }
    const pid = Number(/members\/(\d+)/.exec(pfad)![1]);
    if (method === 'DELETE') gruppe.delete(pid);
    if (method === 'PUT') {
      if (putFehler) throw putFehler;
      gruppe.set(pid, {
        groupTypeRoleId: body.groupTypeRoleId as number,
        groupMemberStatus: andererStatus ?? (body.groupMemberStatus as string),
        waitinglistPosition: (body.waitinglistPosition as number) ?? null,
        fields: Object.entries(body.fields as Record<string, unknown>).map(([id, value]) => ({
          id: Number(id),
          value,
        })),
      });
    }
    return null;
  });
});

const PLATZ: HandPlatz = {
  status: 'active',
  warteplatz: null,
  neuesMax: null,
  wuerdeWarten: false,
  nurMitPlatz: false,
};
const plan = (mehr: Partial<VonHandPlan> = {}): VonHandPlan => ({
  person: { art: 'da', personId: HANNA, geburtstagNachtragen: null },
  felder: { [NR_FELD]: 'HAND01', 585: '6,00 €' },
  nrFeld: NR_FELD,
  platz: PLATZ,
  ...mehr,
});

describe('vorhandene Person', () => {
  it('trägt mit Rolle, Status und Feldern ein; Rückgängig nimmt sie wieder heraus', async () => {
    const r = await vonHandAnmelden(GRUPPE, plan(), HEUTE);
    expect(gruppe.get(HANNA)).toMatchObject({ groupTypeRoleId: 32, groupMemberStatus: 'active' });
    expect(r).toMatchObject({ personId: HANNA, warteplatz: null });
    await r.rueckgaengig();
    expect(gruppe.has(HANNA)).toBe(false);
  });

  it('wartet → hinten an, mit Warteplatz', async () => {
    const r = await vonHandAnmelden(
      GRUPPE,
      plan({ platz: { ...PLATZ, status: 'waiting', warteplatz: 3, wuerdeWarten: true } }),
      HEUTE,
    );
    expect(gruppe.get(HANNA)).toMatchObject({
      groupMemberStatus: 'waiting',
      waitinglistPosition: 3,
    });
    expect(r.warteplatz).toBe(3);
  });

  it('schon dabei → nichts überschrieben', async () => {
    gruppe.set(HANNA, {
      groupTypeRoleId: 32,
      groupMemberStatus: 'waiting',
      waitinglistPosition: 1,
      fields: [],
    });
    await expect(vonHandAnmelden(GRUPPE, plan(), HEUTE)).rejects.toThrow(/schon .* angemeldet/);
    expect(anfragen.some((a) => a.method === 'PUT')).toBe(false);
    expect(gruppe.get(HANNA)!.groupMemberStatus).toBe('waiting');
  });

  it('fehlendes Geburtsdatum wird nachgetragen und nachgelesen', async () => {
    await vonHandAnmelden(
      GRUPPE,
      plan({ person: { art: 'da', personId: HANNA, geburtstagNachtragen: '2018-03-04' } }),
      HEUTE,
    );
    expect(personen.get(HANNA)!.birthday).toBe('2018-03-04');
  });
});

describe('Plätze', () => {
  const voll: HandPlatz = { ...PLATZ, neuesMax: 11, wuerdeWarten: true };

  it('voll und trotzdem → Plätze 10 → 11; Rückgängig setzt sie zurück', async () => {
    const r = await vonHandAnmelden(GRUPPE, plan({ platz: voll }), HEUTE);
    expect(max).toBe(11);
    await r.rueckgaengig();
    expect(max).toBe(10);
  });

  it('Rückgängig lässt die Plätze, wenn sie inzwischen jemand anders geändert hat', async () => {
    const r = await vonHandAnmelden(GRUPPE, plan({ platz: voll }), HEUTE);
    max = 15;
    await r.rueckgaengig();
    expect(max).toBe(15);
  });

  it('Eintragen scheitert → Plätze zurück, der Fehler kommt an', async () => {
    putFehler = new ApiError(503, 'ChurchTools antwortet gerade nicht.');
    await expect(vonHandAnmelden(GRUPPE, plan({ platz: voll }), HEUTE)).rejects.toBe(putFehler);
    expect(max).toBe(10);
  });

  it('anderer Status übernommen → wieder heraus, Plätze zurück, „nicht übernommen“', async () => {
    andererStatus = 'waiting';
    await expect(vonHandAnmelden(GRUPPE, plan({ platz: voll }), HEUTE)).rejects.toThrow(
      /nicht übernommen/,
    );
    expect([gruppe.has(HANNA), max]).toEqual([false, 10]);
  });
});

describe('neue Person', () => {
  const neu = (trotzdem = false): VonHandPlan['person'] => ({
    art: 'neu',
    neu: {
      vor: 'Nina',
      nach: 'Neu',
      geburtstag: '2017-01-02',
      email: 'friesen.alwin+a7h@ecg-donrath.de',
      zugestimmt: 'eltern',
    },
    trotzdem,
  });

  it('legt mit Vorgaben und Zustimmung (außerhalb, Elternteil) an und trägt ein', async () => {
    const r = await vonHandAnmelden(GRUPPE, plan({ person: neu() }), HEUTE);
    const post = anfragen.find((a) => a.method === 'POST')!;
    expect(post.pfad).toBe('/persons');
    expect(post.body).toMatchObject({
      firstName: 'Nina',
      lastName: 'Neu',
      birthday: '2017-01-02',
      statusId: 2,
      campusId: 0,
      departmentIds: [1],
      privacyPolicyAgreement: { date: HEUTE, typeId: 3, whoId: 2 },
    });
    expect(r.personId).toBe(200);
    expect(gruppe.has(200)).toBe(true);
  });

  it('gleicher Name → „gibt es schon“ mit der Nummer, nichts eingetragen; trotzdem → force', async () => {
    doppelt = 149;
    const x = await vonHandAnmelden(GRUPPE, plan({ person: neu() }), HEUTE).catch(
      (y: unknown) => y,
    );
    expect(x).toBeInstanceOf(GibtEsSchon);
    expect((x as GibtEsSchon).personId).toBe(149);
    expect(gruppe.size).toBe(0);
    await vonHandAnmelden(GRUPPE, plan({ person: neu(true) }), HEUTE);
    expect(anfragen.filter((a) => a.method === 'POST').at(-1)!.pfad).toBe('/persons?force=true');
  });

  it('ohne Vorgaben für neue Personen → Hinweis, nichts angelegt', async () => {
    ei.neuePersonVorgaben.mockResolvedValue(null);
    await expect(vonHandAnmelden(GRUPPE, plan({ person: neu() }), HEUTE)).rejects.toThrow(
      /Gruppen-Admin/,
    );
    expect(anfragen).toEqual([]);
  });
});

describe('Suche', () => {
  it('ohne Archivierte, in der Reihenfolge von ChurchTools; wen man nicht sehen darf, fehlt', async () => {
    const t = await personenSuchen('Hanna');
    expect(t.map((p) => p.personId)).toEqual([HANNA]);
    expect(mi.personenRoh).toHaveBeenCalledWith([HANNA, 99]);
  });
  it('unter zwei Zeichen wird nicht gesucht', async () => {
    expect(await personenSuchen(' H ')).toEqual([]);
    expect(ct.ctDaten).not.toHaveBeenCalled();
  });
});
