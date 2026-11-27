/**
 * **Eine Gruppenart in ChurchTools einrichten** (Anmeldungen N1a, aus dem Organigramm herausgezogen): suchen, anlegen,
 * Rollen lesen, Rechte der Leiter-Rolle ergänzen. Das Organigramm tat das schon für „Gruppenwechsel“, die Anmeldungen
 * brauchen es für „Nachweis“ – ein Baustein statt zwei Abschriften (Regel-Dopplung).
 *
 * **Jeder Schritt liest nach.** Ein `200`/`201` ist kein Beleg (Lehre vom 11.08.2026): Erst was beim Nachlesen dasteht –
 * Gruppenart samt beider Rollen, Rechte an der Leiter-Rolle –, zählt als Erfolg.
 *
 * **Nur ergänzen, nie entziehen:** Was jemand von Hand an der Rolle gesetzt hat, bleibt. Angelegt wird nur, was es nicht
 * gibt (bei mehreren gleichen gilt die kleinste Nummer).
 *
 * **Fehler:** `GruppenartFehler` – die Aufrufer ordnen ihn in ihre eigene Fehlerart ein (`unlesbar` = nicht nachlesbar,
 * also vorübergehend; `nichtUebernommen` = ChurchTools hat 200 gesagt und nichts übernommen; `anders`). Fehler des
 * Ports (`ApiError` …) gehen unverändert durch.
 */
import { ctId } from './ctId';

/** Der Anschluss an ChurchTools – für Tests austauschbar (die echte Fassung: `ctPortMit` in `ui/ct/ctPort.ts`). */
export interface CtPort {
  /** `GET /api<pfad>`, `data` ausgepackt. */
  holen<T>(pfad: string): Promise<T>;
  /** Schreibender Aufruf; liefert `data` (sonst den Rumpf). */
  schicken(pfad: string, methode: 'POST' | 'PUT' | 'PATCH', json?: unknown): Promise<unknown>;
}

/** Eine Zeile aus `GET /permissions/group_type_role/{id}` (nur was hier zählt). */
export interface RechtRoh {
  authId?: unknown;
  dataId?: unknown;
  isInherited?: unknown;
}

/** Ein Recht, das an einer Rolle stehen soll. `dataId` = z. B. die Stufe, oder `null` (ohne Einschränkung). */
export interface SollRecht {
  authId: number;
  name: string;
  dataId: number | null;
}

/** Wie die Gruppenart angelegt wird (Rest des Körpers ist fest: keine Beiträge, kein Pflicht-Leiter …). */
export interface GruppenartVorgabe {
  name: string;
  namePlural: string;
  shorty: string;
  color: string;
  description: string;
}

export type GruppenartFehlerArt = 'unlesbar' | 'nichtUebernommen' | 'anders';

export class GruppenartFehler extends Error {
  constructor(
    readonly art: GruppenartFehlerArt,
    message: string,
    /** `unlesbar`: was sich nicht nachlesen ließ („Die Liste der Gruppentypen“); `nichtUebernommen`: was fehlt. */
    readonly was: string,
  ) {
    super(message);
    this.name = 'GruppenartFehler';
  }
}

const anders = (text: string): GruppenartFehler => new GruppenartFehler('anders', text, '');

/** Eine Liste lesen – keine Liste heißt: Antwort in unbekannter Gestalt, nicht „leer“. */
export async function listeHolen<T>(port: CtPort, pfad: string, was: string): Promise<T[]> {
  const roh = await port.holen<unknown>(pfad);
  if (!Array.isArray(roh))
    throw new GruppenartFehler('unlesbar', `${was} ließ sich nicht nachlesen.`, was);
  return roh as T[];
}

// ── Suchen und Rollen ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Nummer der Gruppenart, deren Name `passt` – bei mehreren gleichen die kleinste. `null`: gibt es nicht.
 * `sortKeyMax`: der größte `sortKey` aller Gruppenarten (die neue kommt dahinter).
 */
export async function gruppenartSuchen(
  port: CtPort,
  passt: (name: unknown) => boolean,
): Promise<{ id: number | null; sortKeyMax: number }> {
  const typen = await listeHolen<{ id?: unknown; name?: unknown; sortKey?: unknown }>(
    port,
    '/group/grouptypes',
    'Die Liste der Gruppentypen',
  );
  const ids = typen
    .filter((t) => passt(t.name))
    .map((t) => ctId(t.id))
    .filter((x): x is number => x !== null);
  const sortKeys = typen.map((t) => t.sortKey).filter((k): k is number => typeof k === 'number');
  return {
    id: ids.length ? Math.min(...ids) : null,
    sortKeyMax: sortKeys.length ? Math.max(...sortKeys) : 0,
  };
}

/** Die Rollen einer Gruppenart aus `GET /group/roles` (`id` = `groupTypeRoleId`, `isLeader`); nicht versteckte, Standard zuerst. */
export async function gruppenartRollen(
  port: CtPort,
  typId: number,
): Promise<{ leiter: number | null; teilnehmer: number | null }> {
  const rollen = await listeHolen<{
    id?: unknown;
    groupTypeId?: unknown;
    isLeader?: unknown;
    isHidden?: unknown;
    isDefault?: unknown;
  }>(port, '/group/roles', 'Die Rollen der Gruppentypen');
  const vomTyp = rollen.filter((r) => ctId(r.groupTypeId) === typId && r.isHidden !== true);
  const waehle = (leiter: boolean) => {
    const passend = vomTyp.filter((r) => (r.isLeader === true) === leiter);
    const w = passend.find((r) => r.isDefault === true) ?? passend[0];
    return w ? ctId(w.id) : null;
  };
  return { leiter: waehle(true), teilnehmer: waehle(false) };
}

// ── Modulrechte ────────────────────────────────────────────────────────────────────────────────────────────────

/** Was `GET /permissions/definitions` liefert (nur was hier zählt): Module mit ihren Rechten. */
export interface RechtDefinitionenRoh {
  modules?: unknown;
}

/**
 * Die `authId` eines Rechts **per Modul- und Recht-Schlüssel** aus den Definitionen – nie als feste Nummer: Bei Rechten
 * von Erweiterungen ist sie je Instanz eine andere (Test-Instanz 20.11.2026: „anmeldungen“/„view“ = 2020). `null`: Modul
 * oder Recht gibt es nicht (oder die Antwort hat eine unbekannte Gestalt).
 */
export function modulRechtAus(definitionen: unknown, modul: string, recht: string): number | null {
  const module = (definitionen as RechtDefinitionenRoh | null)?.modules;
  if (!Array.isArray(module)) return null;
  for (const m of module as { key?: unknown; permissions?: unknown }[]) {
    if (m?.key !== modul || !Array.isArray(m.permissions)) continue;
    for (const p of m.permissions as { key?: unknown; authId?: unknown }[])
      if (p?.key === recht) return ctId(p.authId);
  }
  return null;
}

/**
 * Das Modulrecht als `SollRecht` (ohne Einschränkung, `dataId` null) – gelesen aus `GET /permissions/definitions`.
 * Gibt es das Recht nicht, wirft sie `anders` mit klarem Text; nicht lesbar (Antwort keine Gestalt) = `unlesbar`.
 */
export async function modulRechtHolen(
  port: CtPort,
  modul: string,
  recht: string,
  name: string,
  /** Standard: alle Definitionen; für globale Rechte der Kernmodule (z. B. `churchgroup`): `…?scope=global`. */
  pfad = '/permissions/definitions',
): Promise<SollRecht> {
  const roh = await port.holen<unknown>(pfad);
  if (roh === null || typeof roh !== 'object')
    throw new GruppenartFehler(
      'unlesbar',
      'Die Rechte-Definitionen ließen sich nicht nachlesen.',
      'Die Rechte-Definitionen',
    );
  const authId = modulRechtAus(roh, modul, recht);
  if (authId === null)
    throw anders(
      `ChurchTools kennt das Recht „${name}“ nicht (Modul „${modul}“, Recht „${recht}“). Ist die Erweiterung in ChurchTools angelegt und das Modul „${modul}“ freigeschaltet?`,
    );
  return { authId, name, dataId: null };
}

// ── Anlegen ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Legt die Gruppenart an – **nur, wenn es sie nicht gibt** (`passt` auf den Namen) –, liest sie nach und verlangt beide
 * Rollen (Leiter und Teilnehmer; sie entstehen bei `POST /group/grouptypes` von selbst, gemessen O9-0 und N1a).
 */
export async function gruppenartAnlegen(
  port: CtPort,
  vorgabe: GruppenartVorgabe,
  passt: (name: unknown) => boolean,
): Promise<{ typId: number; leiter: number; teilnehmer: number }> {
  const da = await gruppenartSuchen(port, passt);
  if (da.id === null) {
    await port.schicken('/group/grouptypes', 'POST', {
      name: vorgabe.name,
      namePlural: vorgabe.namePlural,
      shorty: vorgabe.shorty,
      // Keine Beiträge, kein Pflicht-Leiter, nicht für neue Personen; 0 = die Rechte der Art gehen an keine Untergruppe weiter.
      postsEnabled: false,
      isLeaderNecessary: false,
      availableForNewPerson: false,
      permissionDepth: 0,
      sortKey: da.sortKeyMax + 1,
      color: vorgabe.color,
      description: vorgabe.description,
    });
  }
  const typId = (await gruppenartSuchen(port, passt)).id;
  if (typId === null) throw anders(`Den Gruppentyp „${vorgabe.name}“ gibt es nicht.`);
  const r = await gruppenartRollen(port, typId);
  if (r.leiter === null || r.teilnehmer === null)
    throw anders(
      `Der Gruppentyp „${vorgabe.name}“ steht in ChurchTools, hat aber nicht beide Rollen (Leiter und Teilnehmer).`,
    );
  return { typId, leiter: r.leiter, teilnehmer: r.teilnehmer };
}

// ── Rechte ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Recht {
  authId: number;
  dataId: number | null;
  geerbt: boolean;
}

/** Die Zeilen aus ChurchTools als Rechte – Zeilen ohne lesbare `authId` fallen weg. */
export function rechteAus(rows: readonly RechtRoh[]): Recht[] {
  return rows.flatMap((r) => {
    const authId = ctId(r.authId);
    if (authId === null) return [];
    const dataId = ctId(r.dataId);
    return [{ authId, dataId, geerbt: r.isInherited === true }];
  });
}

export const rechtSchluessel = (r: { authId: number; dataId: number | null }): string =>
  `${r.authId}:${r.dataId ?? ''}`;

/** Welche Rechte aus `soll` in `rows` fehlen. Geerbte zählen als vorhanden (sie wirken). */
export function fehlendeRechte<S extends { authId: number; dataId: number | null }>(
  rows: readonly RechtRoh[],
  soll: readonly S[],
): S[] {
  const da = new Set(rechteAus(rows).map(rechtSchluessel));
  return soll.filter((r) => !da.has(rechtSchluessel(r)));
}

/**
 * Wo ein Recht hängt – die vier Domänen, an die ChurchTools globale Rechte vergibt (`PUT /permissions/{art}/{id}`, OpenAPI der
 * Test-Instanz 27.11.2026): Status, Gruppenart-Rolle, Rolle in einer Gruppe, Person. Alle vier lesen sich gleich
 * (`GET /permissions/{art}/{id}` → Zeilen mit `authId`, `dataId`, `isInherited`; gemessen N3a).
 */
export interface RechtZiel {
  art: 'status' | 'group_type_role' | 'group_role' | 'person';
  id: number;
}

export const zielSchluessel = (z: RechtZiel): string => `${z.art}:${z.id}`;

/**
 * Ergänzt, was am Ziel fehlt (`PUT /permissions/{art}/{id}` je Recht), und **liest nach**. Fehlt danach noch etwas, wirft
 * sie `nichtUebernommen` mit den Namen. Entzieht nie etwas. `name`: wie das Ziel in Meldungen heißt.
 */
export async function rechteErgaenzenAn(
  port: CtPort,
  ziel: RechtZiel,
  soll: readonly SollRecht[],
  name: string,
): Promise<void> {
  const pfad = `/permissions/${ziel.art}/${ziel.id}`;
  const was = `Die Rechte ${name}`;
  const vorher = await listeHolen<RechtRoh>(port, pfad, was);
  for (const r of fehlendeRechte(vorher, soll))
    await port.schicken(pfad, 'PUT', {
      authId: r.authId,
      ...(r.dataId === null ? {} : { dataId: [r.dataId] }),
    });
  const fehlt = fehlendeRechte(await listeHolen<RechtRoh>(port, pfad, was), soll);
  if (fehlt.length > 0) {
    const namen = fehlt.map((r) => `„${r.name}“`).join(', ');
    throw new GruppenartFehler(
      'nichtUebernommen',
      `ChurchTools hat ${namen} nicht übernommen. Bitte noch einmal versuchen.`,
      namen,
    );
  }
}

/** Ergänzt, was an der Gruppenart-Rolle fehlt – `rechteErgaenzenAn` mit `group_type_role`. */
export async function rechteErgaenzen(
  port: CtPort,
  rolleId: number,
  soll: readonly SollRecht[],
  rolleName = 'Leiter',
): Promise<void> {
  await rechteErgaenzenAn(
    port,
    { art: 'group_type_role', id: rolleId },
    soll,
    `der Rolle „${rolleName}“`,
  );
}

// ── Wer hat ein Recht? ─────────────────────────────────────────────────────────────────────────────────────────

const zahlen = (l: unknown): number[] =>
  Array.isArray(l) ? l.map(ctId).filter((x): x is number => x !== null) : [];

/**
 * **Die Träger eines globalen Rechts** aus `GET /permissions/global/auths/{authId}/assignment-summary` (ausgepackt; gemessen
 * M8 20.11.2026, Form laut OpenAPI): Status, Gruppenart-Rollen, Rollen in Gruppen, Personen – je als `RechtZiel`. **Nicht
 * darin** (OpenAPI): Standardrechte für alle Angemeldeten, öffentliche Rechte und Super-Admins – die zählen nur in
 * `effectivePersonCount`. `null`: Antwort in unbekannter Gestalt (nicht „niemand“).
 */
export function rechtTraegerAus(summary: unknown): RechtZiel[] | null {
  const a = (summary as { assignments?: Record<string, unknown> } | null)?.assignments;
  if (!a || typeof a !== 'object') return null;
  const { statuses, groupTypes, groups, persons } = a;
  if (![statuses, groupTypes, groups, persons].every(Array.isArray)) return null;
  const ziele: RechtZiel[] = [];
  for (const s of statuses as { statusId?: unknown }[])
    for (const id of zahlen([s?.statusId])) ziele.push({ art: 'status', id });
  for (const g of groupTypes as { groupTypeRoleIds?: unknown }[])
    for (const id of zahlen(g?.groupTypeRoleIds)) ziele.push({ art: 'group_type_role', id });
  for (const g of groups as { groupRoleIds?: unknown }[])
    for (const id of zahlen(g?.groupRoleIds)) ziele.push({ art: 'group_role', id });
  for (const p of persons as { personId?: unknown }[])
    for (const id of zahlen([p?.personId])) ziele.push({ art: 'person', id });
  const gesehen = new Set<string>();
  return ziele.filter((z) => !gesehen.has(zielSchluessel(z)) && gesehen.add(zielSchluessel(z)));
}

/** Die Träger des Rechts `authId` – liest `assignment-summary`; unbekannte Gestalt wirft `unlesbar`. */
export async function rechtTraegerLesen(port: CtPort, authId: number): Promise<RechtZiel[]> {
  const ziele = rechtTraegerAus(
    await port.holen<unknown>(`/permissions/global/auths/${authId}/assignment-summary`),
  );
  if (ziele === null)
    throw new GruppenartFehler(
      'unlesbar',
      'Wer das Recht hat, ließ sich nicht nachlesen.',
      'Die Träger des Rechts',
    );
  return ziele;
}
