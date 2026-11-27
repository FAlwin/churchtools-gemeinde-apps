/**
 * **Ein gefälschtes ChurchTools für die Gruppenart** (N1a) – nie eine echte Instanz. Antwortet so, wie die Test-Instanz am
 * 19.11.2026 gemessen hat: `POST /group/grouptypes` legt die Rollen Teilnehmer und Leiter von selbst an, Rechte stehen unter
 * `GET /permissions/group_type_role/{rolle}`. `ignoriere` lässt einen Schreibaufruf mit „Erfolg“ antworten, ohne etwas zu
 * übernehmen – das 200, das nichts bewirkt.
 */
import type { CtPort } from './gruppenart';
import type { ModulPort, Wert } from './modulDaten';

/** Ein Recht, wie `GET /permissions/{art}/{id}` es liefert (nur was zählt). */
export interface RechtZeile {
  authId: number;
  dataId: number | null;
  isInherited?: boolean;
}

/** Die Rechte des Datenspeichers der Erweiterung „anmeldungen“, wie die Test-Instanz sie hat (gelesen 27.11.2026). */
export const ANMELDUNGEN_RECHTE = [
  { authId: 2020, key: 'view', valueType: 'boolean' },
  { authId: 2021, key: 'view custom category' },
  { authId: 2022, key: 'create custom category' },
  { authId: 2023, key: 'edit custom category' },
  { authId: 2024, key: 'delete custom category' },
  { authId: 2025, key: 'view custom data' },
  { authId: 2026, key: 'create custom data' },
  { authId: 2027, key: 'edit custom data' },
  { authId: 2028, key: 'delete custom data' },
] as const;

export interface Aufruf {
  methode: string;
  pfad: string;
  json: unknown;
}

export class FalschesCt {
  typen: { id: number; name: string; sortKey: number }[] = [];
  rollen: { id: number; groupTypeId: number; isLeader: boolean; isDefault?: boolean }[] = [];
  /** Rechte der Gruppenart-Rollen (`group_type_role`). */
  rechte = new Map<number, RechtZeile[]>();
  /** Rechte an den übrigen Zielen (`status`, `group_role`, `person`), Schlüssel `art:id`. */
  rechteAn = new Map<string, RechtZeile[]>();
  /** Antwort von `GET /permissions/definitions` (Test-Instanz: Modul „anmeldungen“, „view“ = 2020, Speicher 2021–2028). */
  definitionen: unknown = {
    modules: [
      {
        key: 'anmeldungen',
        name: 'Anmeldungen',
        permissions: ANMELDUNGEN_RECHTE.map((r) => ({ ...r })),
      },
    ],
  };
  /** `assignment-summary` antwortet in unbekannter Gestalt (z. B. eine ältere ChurchTools-Version). */
  summaryKaputt = false;
  /** Der Datenspeicher der Erweiterung (Modul 13 „anmeldungen“, wie auf der Test-Instanz). */
  module = [{ id: 13, shorty: 'anmeldungen' }];
  kategorien: { id: number; shorty: string; name: string }[] = [];
  werte: Wert[] = [];
  /** Lesen der Werte scheitert mit diesem Status (z. B. 503 – vorübergehend, oder 403 – kein Recht). */
  werteLesenScheitert: number | null = null;
  private naechsterWert = 500;
  aufrufe: Aufruf[] = [];
  /** Schreibaufrufe, die „200“ sagen und nichts übernehmen (`"PUT /permissions"` genügt als Teil von „METHODE pfad“). */
  ignoriere: string[] = [];
  private naechsteTyp = 11;
  private naechsteRolle = 53;

  schreibende(methode: string): Aufruf[] {
    return this.aufrufe.filter((a) => a.methode === methode);
  }

  holen: CtPort['holen'] = async <T>(pfad: string): Promise<T> => {
    await Promise.resolve();
    let m: RegExpExecArray | null;
    if (pfad === '/group/grouptypes') return JSON.parse(JSON.stringify(this.typen)) as T;
    if (pfad === '/permissions/definitions')
      return JSON.parse(JSON.stringify(this.definitionen)) as T;
    if (pfad === '/group/roles') return JSON.parse(JSON.stringify(this.rollen)) as T;
    if ((m = /^\/permissions\/group_type_role\/(\d+)$/.exec(pfad)))
      return JSON.parse(JSON.stringify(this.rechte.get(Number(m[1])) ?? [])) as T;
    if ((m = /^\/permissions\/(status|group_role|person)\/(\d+)$/.exec(pfad)))
      return JSON.parse(JSON.stringify(this.rechteAn.get(`${m[1]}:${m[2]}`) ?? [])) as T;
    if ((m = /^\/permissions\/global\/auths\/(\d+)\/assignment-summary$/.exec(pfad)))
      return (this.summaryKaputt ? { authId: Number(m[1]) } : this.summary(Number(m[1]))) as T;
    if (pfad === '/custommodules') return JSON.parse(JSON.stringify(this.module)) as T;
    if ((m = /^\/custommodules\/(\d+)\/customdatacategories$/.exec(pfad)))
      return JSON.parse(JSON.stringify(this.kategorien)) as T;
    if ((m = /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues$/.exec(pfad))) {
      if (this.werteLesenScheitert !== null)
        throw Object.assign(new Error('Werte nicht lesbar'), { status: this.werteLesenScheitert });
      return JSON.parse(
        JSON.stringify(this.werte.filter((w) => w.dataCategoryId === Number(m![1]))),
      ) as T;
    }
    throw new Error(`unbekannt: ${pfad}`);
  };

  /**
   * Wie `assignment-summary` (Form laut OpenAPI): aus den gespeicherten Rechten, wer `authId` hat – Gruppenart-Rollen mit
   * ihrer Gruppenart, Status, Rollen in Gruppen (Gruppe 900 + Rolle, die Nummer der Gruppe zählt hier nicht), Personen.
   */
  private summary(authId: number) {
    const hat = (l: RechtZeile[] | undefined) => (l ?? []).some((r) => r.authId === authId);
    const an = (art: string) =>
      [...this.rechteAn.entries()]
        .filter(([k, l]) => k.startsWith(`${art}:`) && hat(l))
        .map(([k]) => Number(k.split(':')[1]));
    const rollen = [...this.rechte.entries()].filter(([, l]) => hat(l)).map(([id]) => id);
    return {
      authId,
      dataId: null,
      effectivePersonCount: 0,
      assignments: {
        statuses: an('status').map((statusId) => ({ statusId, personCount: 1 })),
        groupTypes: rollen.map((id) => ({
          groupTypeId: this.rollen.find((r) => r.id === id)?.groupTypeId ?? 0,
          groupTypeRoleIds: [id],
          personCount: 1,
        })),
        groups: an('group_role').map((id) => ({
          groupId: 900,
          groupRoleIds: [id],
          personCount: 1,
        })),
        persons: an('person').map((personId) => ({ personId })),
      },
    };
  }

  schicken: CtPort['schicken'] = async (pfad, methode, json) => {
    await Promise.resolve();
    this.aufrufe.push({ methode, pfad, json: JSON.parse(JSON.stringify(json ?? null)) });
    if (this.ignoriere.some((i) => `${methode} ${pfad}`.includes(i))) return {};
    let m: RegExpExecArray | null;
    if (pfad === '/group/grouptypes' && methode === 'POST') {
      const k = json as { name: string; sortKey: number };
      const id = this.naechsteTyp++;
      this.typen.push({ id, name: k.name, sortKey: k.sortKey });
      this.rollen.push(
        { id: this.naechsteRolle++, groupTypeId: id, isLeader: false, isDefault: true },
        { id: this.naechsteRolle++, groupTypeId: id, isLeader: true },
      );
      return { id };
    }
    if ((m = /^\/permissions\/group_type_role\/(\d+)$/.exec(pfad)) && methode === 'PUT') {
      const k = json as { authId: number; dataId?: number[] };
      const liste = this.rechte.get(Number(m[1])) ?? [];
      liste.push({ authId: k.authId, dataId: k.dataId ? k.dataId[0] : null });
      this.rechte.set(Number(m[1]), liste);
      return {};
    }
    if (
      (m = /^\/permissions\/(status|group_role|person)\/(\d+)$/.exec(pfad)) &&
      methode === 'PUT'
    ) {
      const k = json as { authId: number; dataId?: number[] };
      const schluessel = `${m[1]}:${m[2]}`;
      const liste = this.rechteAn.get(schluessel) ?? [];
      liste.push({ authId: k.authId, dataId: k.dataId ? k.dataId[0] : null });
      this.rechteAn.set(schluessel, liste);
      return {};
    }
    if ((m = /^\/custommodules\/(\d+)\/customdatacategories$/.exec(pfad)) && methode === 'POST') {
      const k = json as { shorty: string; name: string };
      const id = 100 + this.kategorien.length;
      this.kategorien.push({ id, shorty: k.shorty, name: k.name });
      return { id };
    }
    if (
      (m = /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      ))
    ) {
      const k = json as { value: string };
      if (methode === 'POST') {
        const w = { id: this.naechsterWert++, dataCategoryId: Number(m[1]), value: k.value };
        this.werte.push(w);
        return w;
      }
      const w = this.werte.find((x) => x.id === Number(m![2]));
      if (!w) throw Object.assign(new Error('Wert nicht gefunden'), { status: 404 });
      w.value = k.value;
      return w;
    }
    throw new Error(`unbekannt: ${methode} ${pfad}`);
  };

  get port(): CtPort {
    return { holen: this.holen, schicken: this.schicken };
  }

  /** Derselbe Stand als Anschluss an den Datenspeicher (`ModulPort`): Fehler tragen `status`, 401/403 = kein Recht. */
  get modulPort(): ModulPort {
    const status = (e: unknown) => (e as { status?: unknown } | null)?.status;
    return {
      kuerzel: () => 'anmeldungen',
      daten: this.holen,
      schreibe: async (pfad, a) => {
        await this.schicken(pfad, a.method as 'POST' | 'PUT', a.json);
      },
      fehler: (s, m) => Object.assign(new Error(m), { status: s }),
      istKeinRecht: (e) => status(e) === 401 || status(e) === 403,
      istNichtGefunden: (e) => status(e) === 404,
    };
  }
}
