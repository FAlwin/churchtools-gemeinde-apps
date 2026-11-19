/**
 * **Ein gefälschtes ChurchTools für die Gruppenart** (N1a) – nie eine echte Instanz. Antwortet so, wie die Test-Instanz am
 * 19.11.2026 gemessen hat: `POST /group/grouptypes` legt die Rollen Teilnehmer und Leiter von selbst an, Rechte stehen unter
 * `GET /permissions/group_type_role/{rolle}`. `ignoriere` lässt einen Schreibaufruf mit „Erfolg“ antworten, ohne etwas zu
 * übernehmen – das 200, das nichts bewirkt.
 */
import type { CtPort } from './gruppenart';

export interface Aufruf {
  methode: string;
  pfad: string;
  json: unknown;
}

export class FalschesCt {
  typen: { id: number; name: string; sortKey: number }[] = [];
  rollen: { id: number; groupTypeId: number; isLeader: boolean; isDefault?: boolean }[] = [];
  rechte = new Map<number, { authId: number; dataId: number | null; isInherited?: boolean }[]>();
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
    if (pfad === '/group/roles') return JSON.parse(JSON.stringify(this.rollen)) as T;
    if ((m = /^\/permissions\/group_type_role\/(\d+)$/.exec(pfad)))
      return JSON.parse(JSON.stringify(this.rechte.get(Number(m[1])) ?? [])) as T;
    throw new Error(`unbekannt: ${pfad}`);
  };

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
    throw new Error(`unbekannt: ${methode} ${pfad}`);
  };

  get port(): CtPort {
    return { holen: this.holen, schicken: this.schicken };
  }
}
