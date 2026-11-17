/**
 * **Ein gefälschtes ChurchTools für die Tests des Schreibens** (O9-5d) – nie eine echte Instanz. Es merkt sich, was
 * geschrieben wird, und antwortet beim Nachlesen so, wie ChurchTools in O9-5a/O9-0 gemessen geantwortet hat:
 *
 * - `remove-member` kommt aus der Routine mit `actionData: null` zurück,
 * - ein leerer Regelsatz antwortet mit 404,
 * - `POST /group/grouptypes` legt die Rollen Teilnehmer (45) und Leiter (48) von selbst an,
 * - `POST /groups` legt die Gruppe an, Rollen entstehen vom Typ.
 *
 * `ignoriere` lässt einen Schreibaufruf mit „Erfolg“ antworten, ohne etwas zu übernehmen – das 200, das nichts bewirkt.
 * `ausfall` lässt einen Aufruf scheitern (je Aufruf entscheidet eine Funktion).
 */
import { ApiError } from '@ui/ct/fehler';
import {
  GRUNDWERTE,
  sommerferienAus,
  wechseljahre,
  type Wechseljahr,
} from '@shared/organigramm/gruppenwechsel';
import { einrichtungAus, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import type { SpeicherErgebnis } from '@shared/ct/versionierterWert';
import type { OrgGruppe } from '@shared/organigramm/gruppen';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { ladeRegelnDerStufen, ladeTypVorhanden } from './ladeEinrichten';
import type { EinrichtungVersioniert } from './gruppenwechselSpeicher';
import type { Anschluss, CtPort, Eingabe, Lage } from './einrichtenSchreiben';

export const BEREICH = 9;
export const S1 = 1;
export const S2 = 2;
export const S3 = 3;
export const S4 = 4;

const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));

export const FERIEN = sommerferienAus(
  [2031, 2032].map((j) => ({
    titel: `Sommerferien NRW ${j}`,
    beginn: `${j}-07-19`,
    ende: `${j}-08-31`,
  })),
  GRUNDWERTE.ferienStichwort,
);
export const JAHRE: Wechseljahr[] = wechseljahre(FERIEN, GRUNDWERTE);

/** Die Einstellung mit den ersten `n` Stufen (Schäfchen, Fische, Jungschar, Teeny). */
export const einstellungMit = (n: number): Einrichtung['einstellung'] => ({
  ...GRUNDWERTE,
  stufen: [
    { gruppeId: S1, name: 'Schäfchen', abAlter: 4 },
    { gruppeId: S2, name: 'Fische', abAlter: 7 },
    { gruppeId: S3, name: 'Jungschar', abAlter: 10 },
    { gruppeId: S4, name: 'Teeny', abAlter: 13 },
  ].slice(0, n),
});

export const SOLL3 = { einstellung: einstellungMit(3), bereichGruppeId: BEREICH };

interface Eintrag {
  id: number;
  groupId: number;
  groupTypeRoleId: number;
  groupMemberStatus: string;
  routine: {
    name: string;
    isEnabled: boolean;
    steps: { id?: number; actionKey: string; actionData: unknown }[];
  };
}

/** Was die schreibenden Aufrufe schicken – nur die Felder, die das gefälschte ChurchTools liest. */
interface Rumpf {
  name: string;
  sortKey?: number;
  groupTypeId: number;
  parentGroupId: number;
  authId: number;
  dataId?: number[];
  domainContext: { groupId: number; groupTypeRoleId: number; groupMemberStatus: string };
  isEnabled?: boolean;
  steps?: { id?: number; actionKey: string; actionData: unknown }[];
  dynamicGroupRuleSet: unknown[];
  dynamicGroupStatus: string;
}

export type Aufruf = { methode: string; pfad: string; json?: unknown };

export class FakeCt {
  typen: { id: number; name: string; sortKey: number }[] = [{ id: 2, name: 'Dienst', sortKey: 3 }];
  rollen: { id: number; groupTypeId: number; isLeader: boolean; isDefault?: boolean }[] = [
    { id: 40, groupTypeId: 7, isLeader: true },
    { id: 37, groupTypeId: 7, isLeader: false, isDefault: true },
  ];
  gruppen = new Map<number, { name: string; typId: number; parent: number | null }>([
    [BEREICH, { name: 'Kinder & Jugend', typId: 2, parent: null }],
    [S1, { name: 'Schäfchen', typId: 7, parent: BEREICH }],
    [S2, { name: 'Fische', typId: 7, parent: BEREICH }],
    [S3, { name: 'Jungschar', typId: 7, parent: BEREICH }],
    [S4, { name: 'Teeny', typId: 7, parent: BEREICH }],
  ]);
  rechte = new Map<
    number,
    { authId: number; dataId: number | null; isInherited: boolean; type: string }[]
  >();
  routinen = new Map<number, Eintrag[]>();
  regeln = new Map<number, unknown[]>();
  status = new Map<number, string>();
  private naechste = 100;
  /** Jeder schreibende Aufruf in der Reihenfolge – so lässt sich die Reihenfolge des Plans prüfen. */
  aufrufe: Aufruf[] = [];
  /** Schreibaufrufe, die „Erfolg“ melden und nichts übernehmen (kommt `methode pfad` darin vor, z. B. `PUT /dynamicgroups`). */
  ignoriere: string[] = [];
  /** Entscheidet je schreibendem Aufruf, ob er scheitert (Fehler zurückgeben) – `undefined`: läuft durch. */
  ausfall: ((a: Aufruf, nr: number) => Error | undefined) | null = null;
  /**
   * Der Aufruf wird ausgeführt, die Antwort geht aber verloren (Zeitüberschreitung): ChurchTools hat geschrieben, der Aufrufer
   * weiß es nicht – genau das Fenster, in dem eine Gruppe angelegt, aber noch nicht eingetragen sein kann.
   */
  antwortVerloren: ((a: Aufruf, nr: number) => boolean) | null = null;
  /** Antwort von `POST …/refresh`; Standard: eine Zeile mit Nullen. */
  refresh: (id: number) => unknown = (id) => [{ groupId: id, created: 0, updated: 0, deleted: 0 }];

  constructor() {
    // Ein Gruppentyp „Dienst“ und die Kindergruppen-Typ-Rollen gibt es schon.
    this.typen.push({ id: 7, name: 'Veranstaltung', sortKey: 5 });
  }

  /** Den Gruppentyp „Gruppenwechsel“ mit seinen Rollen schon dasein lassen (Typ 9, Rollen 45 und 48). */
  mitTyp(): this {
    this.typen.push({ id: 9, name: 'Gruppenwechsel', sortKey: 6 });
    this.rollen.push(
      { id: 48, groupTypeId: 9, isLeader: true },
      { id: 45, groupTypeId: 9, isLeader: false, isDefault: true },
    );
    return this;
  }

  /** Eine Gruppe vom Typ „Gruppenwechsel“ von Hand dasein lassen (z. B. von einem früheren, abgebrochenen Versuch). */
  wechselGruppe(name: string, parent = BEREICH): number {
    const id = this.naechste++;
    this.gruppen.set(id, { name, typId: 9, parent });
    return id;
  }

  anzahl(methode: string, pfad: string | RegExp): number {
    return this.aufrufe.filter(
      (a) =>
        a.methode === methode && (typeof pfad === 'string' ? a.pfad === pfad : pfad.test(a.pfad)),
    ).length;
  }

  // ── Lesen ───────────────────────────────────────────────────────────────────────────────────────────────────────

  holen: CtPort['holen'] = async <T>(pfad: string): Promise<T> => {
    await Promise.resolve();
    return clone(this.lesen(pfad)) as T;
  };

  private rollenVon(typId: number) {
    return this.rollen
      .filter((r) => r.groupTypeId === typId)
      .map((r) => ({
        groupTypeRoleId: r.id,
        type: r.isLeader ? 'leader' : 'participant',
        isDefault: r.isDefault === true,
        isHidden: false,
      }));
  }

  private lesen(pfad: string): unknown {
    let m: RegExpExecArray | null;
    if (pfad === '/group/grouptypes') return this.typen;
    if (pfad === '/group/roles')
      return this.rollen.map((r) => ({
        id: r.id,
        groupTypeId: r.groupTypeId,
        isLeader: r.isLeader,
        isDefault: r.isDefault === true,
        isHidden: false,
      }));
    if (pfad === '/groups/hierarchies')
      return [...this.gruppen]
        .filter(([, g]) => g.parent !== null)
        .map(([id, g]) => ({ groupId: id, parents: [g.parent], children: [] }));
    if ((m = /^\/groups\/(\d+)\/roles$/.exec(pfad))) {
      const g = this.gruppen.get(Number(m[1]));
      if (!g) throw new ApiError(404, 'Gruppe nicht da');
      return this.rollenVon(g.typId);
    }
    if ((m = /^\/groups\/(\d+)\/members\/routines$/.exec(pfad)))
      return this.routinen.get(Number(m[1])) ?? [];
    if ((m = /^\/groups\/(\d+)$/.exec(pfad))) {
      const id = Number(m[1]);
      const g = this.gruppen.get(id);
      if (!g) throw new ApiError(404, 'Gruppe nicht da');
      return { id, name: g.name, information: { groupTypeId: g.typId } };
    }
    if ((m = /^\/permissions\/group_type_role\/(\d+)$/.exec(pfad)))
      return this.rechte.get(Number(m[1])) ?? [];
    if ((m = /^\/dynamicgroups\/(\d+)\/ruleset$/.exec(pfad))) {
      const r = this.regeln.get(Number(m[1]));
      if (!r || r.length === 0) throw new ApiError(404, 'dynamic group ruleset not found');
      return r;
    }
    if ((m = /^\/dynamicgroups\/(\d+)\/status$/.exec(pfad)))
      return { dynamicGroupStatus: this.status.get(Number(m[1])) ?? 'none' };
    throw new ApiError(404, `unbekannt: ${pfad}`);
  }

  // ── Schreiben ───────────────────────────────────────────────────────────────────────────────────────────────────

  schicken: CtPort['schicken'] = async (pfad, methode, json) => {
    await Promise.resolve();
    const a: Aufruf = { methode, pfad, json: json === undefined ? undefined : clone(json) };
    this.aufrufe.push(a);
    const fehler = this.ausfall?.(a, this.aufrufe.length);
    if (fehler) throw fehler;
    if (this.ignoriere.some((i) => `${methode} ${pfad}`.includes(i))) return {};
    const antwort = this.schreiben(pfad, methode, clone(json));
    if (this.antwortVerloren?.(a, this.aufrufe.length))
      throw new ApiError(504, 'ChurchTools antwortet nicht (Zeitüberschreitung).');
    return antwort;
  };

  private schreiben(pfad: string, methode: string, rumpf: unknown): unknown {
    const json = rumpf as Rumpf;
    let m: RegExpExecArray | null;
    if (pfad === '/group/grouptypes' && methode === 'POST') {
      const id = 9;
      this.typen.push({ id, name: json.name, sortKey: json.sortKey ?? 0 });
      this.rollen.push(
        { id: 48, groupTypeId: id, isLeader: true },
        { id: 45, groupTypeId: id, isLeader: false, isDefault: true },
      );
      return { id };
    }
    if (pfad === '/groups' && methode === 'POST') {
      const id = this.naechste++;
      this.gruppen.set(id, {
        name: json.name,
        typId: json.groupTypeId,
        parent: json.parentGroupId,
      });
      return { id };
    }
    if ((m = /^\/permissions\/group_type_role\/(\d+)$/.exec(pfad)) && methode === 'PUT') {
      const rolle = Number(m[1]);
      const zeilen = this.rechte.get(rolle) ?? [];
      zeilen.push({
        authId: json.authId,
        dataId: Array.isArray(json.dataId) ? json.dataId[0] : null,
        isInherited: false,
        type: 'grant',
      });
      this.rechte.set(rolle, zeilen);
      return {};
    }
    if (pfad === '/routines' && methode === 'POST') {
      const id = this.naechste++;
      const ctx = json.domainContext;
      const liste = this.routinen.get(ctx.groupId) ?? [];
      liste.push({
        id,
        groupId: ctx.groupId,
        groupTypeRoleId: ctx.groupTypeRoleId,
        groupMemberStatus: ctx.groupMemberStatus,
        routine: { name: json.name, isEnabled: json.isEnabled === true, steps: [] },
      });
      this.routinen.set(ctx.groupId, liste);
      return { id };
    }
    if ((m = /^\/routines\/(\d+)$/.exec(pfad)) && methode === 'PATCH') {
      const e = [...this.routinen.values()].flat().find((x) => x.id === Number(m![1]));
      if (!e) throw new ApiError(404, 'Routine nicht da');
      if (json.steps)
        e.routine.steps = json.steps.map(
          (s: { id?: number; actionKey: string; actionData: unknown }, i: number) => ({
            ...s,
            id: s.id ?? this.naechste++ + i,
            // ChurchTools gibt `remove-member` mit `actionData: null` zurück (gemessen 16.11.2026).
            actionData: s.actionKey === 'remove-member' ? null : s.actionData,
          }),
        );
      if (typeof json.isEnabled === 'boolean') e.routine.isEnabled = json.isEnabled;
      return {};
    }
    if ((m = /^\/dynamicgroups\/(\d+)\/ruleset$/.exec(pfad)) && methode === 'PUT') {
      this.regeln.set(Number(m[1]), json.dynamicGroupRuleSet);
      return {};
    }
    if ((m = /^\/dynamicgroups\/(\d+)\/status$/.exec(pfad)) && methode === 'PUT') {
      this.status.set(Number(m[1]), json.dynamicGroupStatus);
      return {};
    }
    if ((m = /^\/dynamicgroups\/(\d+)\/refresh$/.exec(pfad)) && methode === 'POST')
      return this.refresh(Number(m[1]));
    throw new ApiError(404, `unbekannt: ${methode} ${pfad}`);
  }

  /** Alle sichtbaren Gruppen, wie `ladeGruppenbaum` sie liefert. */
  gruppenbaum(): { gruppen: OrgGruppe[]; eltern: Map<number, number[]> } {
    return {
      gruppen: [...this.gruppen].map(([id, g]) => ({
        id,
        name: g.name,
        typId: g.typId,
        statusId: 1,
        farbe: null,
      })),
      eltern: new Map(
        [...this.gruppen]
          .filter(([, g]) => g.parent !== null)
          .map(([id, g]) => [id, [g.parent as number]]),
      ),
    };
  }
}

/** Der Speicher der Erweiterung als Attrappe: ein Wert mit Version – und Haken zum Scheitern. */
export class FakeSpeicher {
  inhalt: Einrichtung | null = null;
  version = 0;
  /** Jedes Speichern (Inhalt, erwartete Version). */
  gespeichert: { inhalt: Einrichtung; erwartet: number | null }[] = [];
  /** Beim n-ten Speichern (1-basiert) scheitern: so ein Ergebnis kommt zurück. */
  scheitere: ((n: number) => SpeicherErgebnis<Einrichtung> | undefined) | null = null;

  gelesen(): EinrichtungVersioniert {
    return this.inhalt
      ? { art: 'da', einrichtung: clone(this.inhalt), version: this.version }
      : { art: 'keine' };
  }

  speichern: Anschluss['speichern'] = async (inhalt, erwartet) => {
    await Promise.resolve();
    this.gespeichert.push({ inhalt: clone(inhalt), erwartet });
    const sonst = this.scheitere?.(this.gespeichert.length);
    if (sonst) return sonst;
    if ((this.inhalt ? this.version : null) !== erwartet) return { ok: false, grund: 'konflikt' };
    this.inhalt = clone(inhalt);
    this.version += 1;
    return {
      ok: true,
      daten: {
        version: this.version,
        zeit: 'jetzt',
        von: { personId: 1, name: 'Alex' },
        inhalt: clone(inhalt),
      },
    };
  };
}

export const VON = { personId: 1, name: 'Alex' };

/** Die Leser, die aus dem gefälschten ChurchTools lesen – ein Test, der diese Module ersetzt (`vi.mock`), reicht die echten. */
export interface Leser {
  ladeTypVorhanden: typeof ladeTypVorhanden;
  ladeEinrichtungStand: typeof ladeEinrichtungStand;
  ladeRegelnDerStufen: typeof ladeRegelnDerStufen;
}
const ECHTE_LESER: Leser = { ladeTypVorhanden, ladeEinrichtungStand, ladeRegelnDerStufen };

/** Die Lage aus dem gefälschten ChurchTools – mit den echten Lesern (sie nehmen `holen` entgegen). */
export async function lageAus(
  f: FakeCt,
  s: FakeSpeicher,
  e: Eingabe,
  l: Leser = ECHTE_LESER,
): Promise<Lage> {
  const gespeichert = s.gelesen();
  const alt = gespeichert.art === 'da' ? gespeichert.einrichtung : null;
  const soll = e.art === 'nachtragen' || e.art === 'rechte' ? alt : e.soll;
  if (!soll)
    return {
      gespeichert,
      soll: null,
      typ: { ok: false },
      stand: null,
      regeln: new Map(),
      jahre: null,
      gruppen: null,
    };
  return {
    gespeichert,
    soll,
    typ: await l.ladeTypVorhanden(f.holen),
    stand: alt ? await l.ladeEinrichtungStand(alt, f.holen) : null,
    regeln: await l.ladeRegelnDerStufen(
      soll.einstellung.stufen.map((x) => x.gruppeId),
      f.holen,
    ),
    jahre: JAHRE,
    gruppen: f.gruppenbaum(),
  };
}

export function anschluss(
  f: FakeCt,
  s: FakeSpeicher,
  e: Eingabe,
  zusatz: Partial<Anschluss> & { leser?: Leser } = {},
): Anschluss {
  const { leser, ...rest } = zusatz;
  return {
    lage: () => lageAus(f, s, e, leser),
    port: { holen: f.holen, schicken: f.schicken },
    speichern: s.speichern,
    ...rest,
  };
}

export const einrichtenEingabe = (soll = SOLL3): Eingabe => ({
  art: 'einrichten',
  soll,
  ausgang: null,
  von: VON,
});

/** Eine fertige Einrichtung (für „Ändern“, „Nachtragen“): Wechsel-Gruppen 11 und 12 unter dem Bereich. */
export const EINRICHTUNG_FERTIG = einrichtungAus({
  einstellung: SOLL3.einstellung,
  bereichGruppeId: BEREICH,
  wechselGruppen: [
    { vonGruppeId: S1, nachGruppeId: S2, gruppeId: 11 },
    { vonGruppeId: S2, nachGruppeId: S3, gruppeId: 12 },
  ],
})!;
