/**
 * **Ein gefälschtes ChurchTools für die Nachweis-Arten** (N1b) – nie eine echte Instanz. Baut auf `FalschesCt` (Gruppenart,
 * Rollen, Rechte) auf und kann dazu Gruppen, Gruppenfelder, Mitglieder und Abläufe – so, wie die Test-Instanz am
 * 19.11.2026 geantwortet hat (N0, M4, N1a). Es **merkt sich, was geschrieben wird**; die Prüfungen lesen den Stand hinterher.
 *
 * Fehlerbilder, die ein Test einschalten kann:
 * - `ignoriere`: Schreibaufrufe, die „Erfolg“ melden und nichts übernehmen (das 200, das nichts bewirkt);
 * - `scheitert`: Schreibaufrufe, die mit einem Status abbrechen (z. B. 503, Zeitüberschreitung);
 * - `sichtbarkeitFest`: Gruppen entstehen mit dieser Sichtbarkeit, was auch geschickt wird.
 */
import { ApiError } from '@ui/ct/fehler';
import { FalschesCt, type Aufruf } from '@shared/ct/gruppenart.testutil';

export interface FeldStand {
  id: number;
  name: string;
  fieldTypeCode: string;
  securityLevel: number;
  useInRegistrationForm: boolean;
  requiredInRegistrationForm: boolean;
  options?: { id: string; name: string }[];
}

export interface MitgliedStand {
  personId: number;
  groupTypeRoleId: number;
  groupMemberStatus: string;
  title: string;
  fields: { id: number; value: unknown }[];
}

export interface GruppeStand {
  id: number;
  name: string;
  note: string | null;
  groupTypeId: number;
  groupStatusId: number;
  visibility: string;
}

export interface SchrittStand {
  id: number;
  specId?: number;
  actionKey: string;
  isEnabled: boolean;
  actionData: Record<string, unknown> | null;
  children?: SchrittStand[];
}

export interface RoutineStand {
  id: number;
  name: string;
  isEnabled: boolean;
  steps: SchrittStand[];
  groupId: number;
  groupTypeRoleId: number;
  groupMemberStatus: string;
}

export interface VorlageStand {
  id: number;
  name: string;
  domainType: string;
  isGlobal: boolean;
  htmlFileId: number | null;
}

/** Eine Rolle IN DER GRUPPE: ihre Nummer ist NICHT die der Gruppenart-Rolle (`groupTypeRoleId`) – gemessen N0. */
export interface GruppenRolleStand {
  id: number;
  groupTypeRoleId: number;
  htmlTemplateIds: number[];
}

export class FalschesNachweisCt {
  readonly basis = new FalschesCt();
  gruppen = new Map<number, GruppeStand>();
  felder = new Map<number, FeldStand[]>();
  mitglieder = new Map<number, MitgliedStand[]>();
  routinen = new Map<number, RoutineStand>();
  /** HTML-Vorlagen (Bescheinigungen), Inhalte der hochgeladenen Dateien und die Rollen je Gruppe (N1c). */
  vorlagen = new Map<number, VorlageStand>();
  dateien = new Map<number, string>();
  gruppenRollen = new Map<number, GruppenRolleStand[]>();
  /** `POST /htmltemplates` und Datei-Uploads antworten 403 (Recht „Gemeinde-HTML-Vorlagen verwalten“ fehlt). */
  keinVorlagenRecht = false;
  /** Die Liste `GET /htmltemplates` gibt es nicht (404). */
  ohneVorlagenListe = false;
  /** `GET /htmltemplates/{id}/html` liefert etwas, das kein Blatt von uns ist (z. B. von ChurchTools umgeformt). */
  htmlUmgeformt = false;
  /** Gruppen, deren Mitglieder man nicht lesen darf (403). */
  ohneMitgliederRecht = new Set<number>();
  ignoriere: string[] = [];
  scheitert: { muster: string; status: number }[] = [];
  sichtbarkeitFest: string | null = null;
  /** Rechte der angemeldeten Person (`/permissions/global`). */
  global: unknown = {
    churchcore: { 'administer persons': true, 'administer church html templates': true },
  };
  aufrufe: Aufruf[] = [];
  private naechste = 1000;

  schreibende(methode: string): Aufruf[] {
    return this.aufrufe.filter((a) => a.methode === methode);
  }
  /** Alle Schreibaufrufe, die zu `muster` („METHODE pfad“, Teilstück) passen. */
  schreibend(muster: string): Aufruf[] {
    return this.aufrufe.filter((a) => `${a.methode} ${a.pfad}`.includes(muster));
  }

  /** Eine fertig eingerichtete Welt: Gruppenart 11 „Nachweis“ mit Rollen 53 (Teilnehmer) und 56 (Leiter). */
  mitArt(): this {
    this.basis.typen = [{ id: 11, name: 'Nachweis', sortKey: 100 }];
    this.basis.rollen = [
      { id: 53, groupTypeId: 11, isLeader: false, isDefault: true },
      { id: 56, groupTypeId: 11, isLeader: true },
    ];
    return this;
  }

  gruppeAnlegen(name: string, note: string | null = null): GruppeStand {
    const g: GruppeStand = {
      id: this.naechste++,
      name,
      note,
      groupTypeId: 11,
      groupStatusId: 1,
      visibility: 'restricted',
    };
    this.gruppen.set(g.id, g);
    return g;
  }

  mitgliedSetzen(gruppeId: number, m: Partial<MitgliedStand> & { personId: number }): void {
    const liste = this.mitglieder.get(gruppeId) ?? [];
    liste.push({
      groupTypeRoleId: 53,
      groupMemberStatus: 'active',
      title: `Person ${m.personId}`,
      fields: [],
      ...m,
    });
    this.mitglieder.set(gruppeId, liste);
  }

  private rohGruppe(g: GruppeStand) {
    return {
      id: g.id,
      name: g.name,
      information: { note: g.note, groupTypeId: g.groupTypeId, groupStatusId: g.groupStatusId },
      settings: { visibility: g.visibility },
    };
  }

  /** Die Rollen einer Gruppe: je Gruppenart-Rolle eine, mit einer anderen Nummer als die der Art (3000/4000 + Gruppe). */
  rollenVon(gruppeId: number): GruppenRolleStand[] {
    let liste = this.gruppenRollen.get(gruppeId);
    if (!liste) {
      liste = [
        { id: 3000 + gruppeId, groupTypeRoleId: 53, htmlTemplateIds: [] },
        { id: 4000 + gruppeId, groupTypeRoleId: 56, htmlTemplateIds: [] },
      ];
      this.gruppenRollen.set(gruppeId, liste);
    }
    return liste;
  }

  private rohMitglied(m: MitgliedStand) {
    const [vor = '', ...rest] = m.title.split(' ');
    return {
      personId: m.personId,
      groupTypeRoleId: m.groupTypeRoleId,
      groupMemberStatus: m.groupMemberStatus,
      person: { title: m.title, domainAttributes: { firstName: vor, lastName: rest.join(' ') } },
      fields: m.fields,
    };
  }

  private rohRoutine(r: RoutineStand) {
    return {
      id: r.id,
      name: r.name,
      isEnabled: r.isEnabled,
      steps: structuredClone(r.steps),
    };
  }

  private zuordnungen(gruppeId: number) {
    return [...this.routinen.values()]
      .filter((r) => r.groupId === gruppeId)
      .map((r) => ({
        id: r.id,
        groupTypeRoleId: r.groupTypeRoleId,
        groupMemberStatus: r.groupMemberStatus,
        routine: this.rohRoutine(r),
      }));
  }

  /** Lesen (`ctDaten`): liefert `data`. */
  holen = async <T>(pfad: string): Promise<T> => {
    await Promise.resolve();
    if (pfad === '/permissions/global') return this.global as T;
    let m: RegExpExecArray | null;
    if ((m = /^\/groups\/(\d+)$/.exec(pfad))) {
      const g = this.gruppen.get(Number(m[1]));
      if (!g) throw new ApiError(404, 'Gruppe nicht gefunden');
      return this.rohGruppe(g) as T;
    }
    if ((m = /^\/groups\/(\d+)\/memberfields$/.exec(pfad)))
      return (this.felder.get(Number(m[1])) ?? []).map((f) => ({
        type: 'group',
        field: structuredClone(f),
      })) as T;
    if ((m = /^\/groups\/(\d+)\/members\/routines$/.exec(pfad)))
      return this.zuordnungen(Number(m[1])) as T;
    if ((m = /^\/routines\/(\d+)$/.exec(pfad))) {
      const r = this.routinen.get(Number(m[1]));
      if (!r) throw new ApiError(404, 'Ablauf nicht gefunden');
      return this.rohRoutine(r) as T;
    }
    if ((m = /^\/htmltemplates\/(\d+)$/.exec(pfad))) {
      const v = this.vorlagen.get(Number(m[1]));
      if (!v) throw new ApiError(404, 'Vorlage nicht gefunden');
      return structuredClone(v) as T;
    }
    if ((m = /^\/groups\/(\d+)\/roles$/.exec(pfad)))
      return structuredClone(this.rollenVon(Number(m[1]))) as T;
    return await this.basis.holen<T>(pfad);
  };

  /** Alle Seiten einer Liste (`ctAlleSeiten`). */
  alleSeiten = async <T>(pfad: string): Promise<T[]> => {
    await Promise.resolve();
    let m: RegExpExecArray | null;
    if (pfad.startsWith('/groups?')) {
      const typ = /group_type_ids\[\]=(\d+)/.exec(pfad);
      const status = /group_status_ids\[\]=(\d+)/.exec(pfad);
      return [...this.gruppen.values()]
        .filter((g) => !typ || g.groupTypeId === Number(typ[1]))
        .filter((g) => !status || g.groupStatusId === Number(status[1]))
        .map((g) => this.rohGruppe(g)) as T[];
    }
    if (pfad === '/htmltemplates') {
      if (this.ohneVorlagenListe) throw new ApiError(404, 'Nicht gefunden');
      return structuredClone([...this.vorlagen.values()]) as T[];
    }
    if ((m = /^\/groups\/(\d+)\/members$/.exec(pfad))) {
      const id = Number(m[1]);
      if (this.ohneMitgliederRecht.has(id)) throw new ApiError(403, 'Kein Recht');
      return (this.mitglieder.get(id) ?? []).map((x) => this.rohMitglied(x)) as T[];
    }
    throw new Error(`unbekannt (Liste): ${pfad}`);
  };

  /** Schreiben (`ctAnfrage`): liefert den Rumpf `{ data }`. */
  schicken = async (pfad: string, methode: string, json?: unknown): Promise<{ data: unknown }> => {
    await Promise.resolve();
    this.aufrufe.push({ methode, pfad, json: JSON.parse(JSON.stringify(json ?? null)) });
    const kennung = `${methode} ${pfad}`;
    const fehler = this.scheitert.find((s) => kennung.includes(s.muster));
    if (fehler) throw new ApiError(fehler.status, 'ChurchTools antwortet nicht');
    const k = (json ?? {}) as Record<string, unknown>;
    const ignorieren = this.ignoriere.some((i) => kennung.includes(i));
    let m: RegExpExecArray | null;

    if (pfad === '/groups' && methode === 'POST') {
      if (ignorieren) return { data: { id: this.naechste++ } };
      const g = this.gruppeAnlegen(String(k.name));
      g.groupTypeId = Number(k.groupTypeId);
      g.groupStatusId = Number(k.groupStatusId);
      g.visibility =
        this.sichtbarkeitFest ?? (typeof k.visibility === 'string' ? k.visibility : 'public');
      return { data: { id: g.id } };
    }
    if ((m = /^\/groups\/(\d+)$/.exec(pfad)) && methode === 'PATCH') {
      const g = this.gruppen.get(Number(m[1]));
      if (!g) throw new ApiError(404, 'Gruppe nicht gefunden');
      if (!ignorieren) {
        if (typeof k.name === 'string') g.name = k.name;
        if (typeof k.note === 'string') g.note = k.note;
        if (typeof k.visibility === 'string' && !this.sichtbarkeitFest) g.visibility = k.visibility;
        if (typeof k.groupStatusId === 'number') g.groupStatusId = k.groupStatusId;
      }
      return { data: {} };
    }
    if ((m = /^\/groups\/(\d+)\/memberfields\/group$/.exec(pfad)) && methode === 'POST') {
      const id = this.naechste++;
      if (!ignorieren) {
        const liste = this.felder.get(Number(m[1])) ?? [];
        const f = k as unknown as Omit<FeldStand, 'id' | 'options'> & {
          options?: { name: string }[];
        };
        liste.push({
          ...f,
          id,
          options: f.options?.map((o) => ({ id: String(this.naechste++), name: o.name })),
        });
        this.felder.set(Number(m[1]), liste);
      }
      return { data: { id } };
    }
    if ((m = /^\/groups\/(\d+)\/memberfields\/group\/(\d+)$/.exec(pfad)) && methode === 'PATCH') {
      const [, gruppeNr, feldNr] = m;
      const f = (this.felder.get(Number(gruppeNr)) ?? []).find((x) => x.id === Number(feldNr));
      if (!f) throw new ApiError(404, 'Feld nicht gefunden');
      if (!ignorieren) {
        const neu = k as Partial<FeldStand> & { options?: { id?: string; name: string }[] };
        Object.assign(f, { ...neu, options: undefined });
        if (neu.options)
          f.options = neu.options.map((o) => ({
            id: o.id ?? String(this.naechste++),
            name: o.name,
          }));
      }
      return { data: f };
    }
    if ((m = /^\/groups\/(\d+)\/members\/(\d+)$/.exec(pfad))) {
      const gruppe = Number(m[1]);
      const person = Number(m[2]);
      const liste = this.mitglieder.get(gruppe) ?? [];
      const da = liste.find((x) => x.personId === person);
      if (methode === 'PUT') {
        // Wie ChurchTools: nur anlegen – ist die Person schon dabei, lehnt es ab.
        if (da) throw new ApiError(403, 'member.add.already-in-group');
        if (!ignorieren)
          this.mitgliedSetzen(gruppe, {
            personId: person,
            groupTypeRoleId: Number(k.groupTypeRoleId),
            groupMemberStatus:
              typeof k.groupMemberStatus === 'string' ? k.groupMemberStatus : 'active',
          });
        return { data: {} };
      }
      if (methode === 'PATCH') {
        if (!da) throw new ApiError(404, 'nicht in der Gruppe');
        if (!ignorieren) {
          if (typeof k.groupTypeRoleId === 'number') da.groupTypeRoleId = k.groupTypeRoleId;
          if (typeof k.groupMemberStatus === 'string') da.groupMemberStatus = k.groupMemberStatus;
        }
        return { data: {} };
      }
      if (methode === 'DELETE') {
        if (!ignorieren)
          this.mitglieder.set(
            gruppe,
            liste.filter((x) => x.personId !== person),
          );
        return { data: {} };
      }
    }
    // ── Bescheinigungen (N1c) ──
    if (pfad === '/htmltemplates' && methode === 'POST') {
      if (this.keinVorlagenRecht || k.isGlobal !== true) throw new ApiError(403, 'Kein Recht');
      const id = this.naechste++;
      if (!ignorieren)
        this.vorlagen.set(id, {
          id,
          name: String(k.name),
          domainType: String(k.domainType),
          isGlobal: true,
          htmlFileId: null,
        });
      return { data: { id } };
    }
    if ((m = /^\/htmltemplates\/(\d+)$/.exec(pfad)) && methode === 'PATCH') {
      const v = this.vorlagen.get(Number(m[1]));
      if (!v) throw new ApiError(404, 'Vorlage nicht gefunden');
      if (this.keinVorlagenRecht) throw new ApiError(403, 'Kein Recht');
      if (!ignorieren && typeof k.htmlFileId === 'number') {
        if (!this.dateien.has(k.htmlFileId)) throw new ApiError(404, 'Datei nicht gefunden');
        v.htmlFileId = k.htmlFileId;
      }
      return { data: {} };
    }
    if ((m = /^\/files\/html_template\/(\d+)$/.exec(pfad)) && methode === 'POST') {
      if (!this.vorlagen.has(Number(m[1]))) throw new ApiError(404, 'Vorlage nicht gefunden');
      if (this.keinVorlagenRecht) throw new ApiError(403, 'Kein Recht');
      const id = this.naechste++;
      if (!ignorieren) this.dateien.set(id, String((k as { html?: unknown }).html));
      return { data: [{ id }] };
    }
    if ((m = /^\/htmltemplates\/(\d+)\/html$/.exec(pfad)) && methode === 'GET') {
      const v = this.vorlagen.get(Number(m[1]));
      const html = v?.htmlFileId != null ? this.dateien.get(v.htmlFileId) : undefined;
      if (html === undefined) throw new ApiError(404, 'Kein Inhalt');
      return { data: this.htmlUmgeformt ? '<p>umgeformt</p>' : html };
    }
    if ((m = /^\/groups\/(\d+)\/roles\/(\d+)$/.exec(pfad)) && methode === 'PATCH') {
      const [, gruppeNr, rolleNr] = m;
      const rolle = this.rollenVon(Number(gruppeNr)).find((r) => r.id === Number(rolleNr));
      if (!rolle) throw new ApiError(404, 'Rolle nicht gefunden');
      if (!ignorieren && Array.isArray(k.htmlTemplateIds))
        rolle.htmlTemplateIds = (k.htmlTemplateIds as unknown[]).map(Number);
      return { data: {} };
    }
    if (pfad === '/routines' && methode === 'POST') {
      const ctx = k.domainContext as {
        groupId: number;
        groupTypeRoleId: number;
        groupMemberStatus: string;
      };
      const id = this.naechste++;
      if (!ignorieren)
        this.routinen.set(id, {
          id,
          name: String(k.name),
          isEnabled: k.isEnabled === true,
          steps: [],
          groupId: ctx.groupId,
          groupTypeRoleId: ctx.groupTypeRoleId,
          groupMemberStatus: ctx.groupMemberStatus,
        });
      return { data: { id } };
    }
    if ((m = /^\/routines\/(\d+)$/.exec(pfad)) && methode === 'PATCH') {
      const r = this.routinen.get(Number(m[1]));
      if (!r) throw new ApiError(404, 'Ablauf nicht gefunden');
      if (!ignorieren) {
        if (typeof k.isEnabled === 'boolean') r.isEnabled = k.isEnabled;
        if (Array.isArray(k.steps)) r.steps = this.schritteAnlegen(k.steps as SchrittStand[]);
      }
      return { data: {} };
    }
    return this.basisSchicken(pfad, methode, json);
  };

  /** Nummern vergeben: Schritte ohne `id` bekommen eine, Folgeaufgaben ohne `specId` ebenfalls (wie ChurchTools). */
  private schritteAnlegen(liste: SchrittStand[]): SchrittStand[] {
    return liste.map((s) => {
      const neu = JSON.parse(JSON.stringify(s)) as SchrittStand;
      neu.id ??= this.naechste++;
      if (neu.actionKey === 'create-follow-up') neu.specId ??= this.naechste++;
      if (neu.children) neu.children = this.schritteAnlegen(neu.children);
      return neu;
    });
  }

  /** Gruppenart, Rollen und Rechte beantwortet `FalschesCt`. */
  private async basisSchicken(
    pfad: string,
    methode: string,
    json?: unknown,
  ): Promise<{ data: unknown }> {
    return { data: await this.basis.schicken(pfad, methode as 'POST' | 'PUT' | 'PATCH', json) };
  }
}
