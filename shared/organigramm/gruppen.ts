/**
 * **Gruppen und Hierarchie für das Organigramm** (Bauplan Organigramm O1). Hier steht nur das Auswerten der
 * Rohdaten; geholt wird beim Aufrufer.
 *
 * Gemessen (Live 19.10.2026, Test-Instanz 22.10.2026):
 * - `GET /groups` liefert je Gruppe `information.groupTypeId`, `information.groupStatusId` und
 *   `information.color` (Tailwind-Name wie `lime`, `gray`).
 * - `GET /groups/hierarchies` liefert `{ groupId, parents: [], children: [] }` – auch für Personen ohne
 *   Sonderrecht vollständig. Eine Gruppe kann **mehrere** Obergruppen haben. Hat sie keine mehr, fehlt ihr
 *   Eintrag ganz (nicht `parents: []`).
 * - Eine Obergruppe, die man nicht sehen darf, steht trotzdem in `parents` – sie fehlt dann in `/groups`.
 */
import { ctId } from '../ct/ctId';

export interface OrgGruppe {
  id: number;
  name: string;
  typId: number | null;
  statusId: number | null;
  /** Eigene Farbe der Gruppe (Tailwind-Name) – `null`, wenn ChurchTools keine nennt. */
  farbe: string | null;
}

export interface RohGruppe {
  id?: unknown;
  name?: unknown;
  information?: { groupTypeId?: unknown; groupStatusId?: unknown; color?: unknown } | null;
}

/** Gruppen aus `GET /groups`; Einträge ohne ID oder Namen fallen weg (eine Zeile ohne Namen wäre nichts wert). */
export function orgGruppenAus(rows: readonly RohGruppe[] | null | undefined): OrgGruppe[] {
  const out: OrgGruppe[] = [];
  for (const r of rows ?? []) {
    const id = ctId(r.id);
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (id === null || name === '') continue;
    const farbe = r.information?.color;
    out.push({
      id,
      name,
      typId: ctId(r.information?.groupTypeId),
      statusId: ctId(r.information?.groupStatusId),
      farbe: typeof farbe === 'string' && farbe !== '' ? farbe : null,
    });
  }
  return out;
}

export interface RohHierarchie {
  groupId?: unknown;
  parents?: unknown;
  children?: unknown;
}

/** Obergruppen je Gruppe – aus `parents` UND aus `children` der anderen Einträge (eine Seite reicht nicht immer). */
export function elternAus(
  rows: readonly RohHierarchie[] | null | undefined,
): Map<number, number[]> {
  const eltern = new Map<number, Set<number>>();
  const merke = (kind: number, vater: number) => {
    if (kind === vater) return;
    let s = eltern.get(kind);
    if (!s) eltern.set(kind, (s = new Set()));
    s.add(vater);
  };
  for (const r of rows ?? []) {
    const id = ctId(r.groupId);
    if (id === null) continue;
    for (const p of Array.isArray(r.parents) ? r.parents : []) {
      const v = ctId(p);
      if (v !== null) merke(id, v);
    }
    for (const c of Array.isArray(r.children) ? r.children : []) {
      const k = ctId(c);
      if (k !== null) merke(k, id);
    }
  }
  return new Map([...eltern].map(([k, s]) => [k, [...s].sort((a, b) => a - b)]));
}

export interface Knoten {
  gruppe: OrgGruppe;
  kinder: Knoten[];
}

/**
 * **Der Baum, wie man ihn sehen darf.** Wurzeln sind Gruppen ohne SICHTBARE Obergruppe – auch die, deren
 * Obergruppe man nicht lesen darf (sonst verschwänden sie ganz). Hat eine Gruppe zwei Obergruppen, steht sie
 * unter beiden, wie in ChurchTools. Kreise (bei ChurchTools abgelehnt, gemessen O0) brechen trotzdem nicht:
 * Eine Gruppe erscheint auf einem Pfad höchstens einmal. Reihenfolge: nach Name.
 */
export function baumAus(gruppen: readonly OrgGruppe[], eltern: Map<number, number[]>): Knoten[] {
  const byId = new Map(gruppen.map((g) => [g.id, g]));
  const kinderVon = new Map<number, OrgGruppe[]>();
  for (const g of gruppen) {
    for (const v of eltern.get(g.id) ?? []) {
      if (!byId.has(v)) continue;
      const liste = kinderVon.get(v) ?? [];
      liste.push(g);
      kinderVon.set(v, liste);
    }
  }
  const nachName = (a: OrgGruppe, b: OrgGruppe) =>
    a.name.localeCompare(b.name, 'de') || a.id - b.id;
  const bauen = (g: OrgGruppe, pfad: Set<number>): Knoten => {
    const weiter = new Set(pfad).add(g.id);
    const kinder = (kinderVon.get(g.id) ?? [])
      .filter((k) => !weiter.has(k.id))
      .sort(nachName)
      .map((k) => bauen(k, weiter));
    return { gruppe: g, kinder };
  };
  const istWurzel = (g: OrgGruppe) => !(eltern.get(g.id) ?? []).some((v) => byId.has(v));
  return gruppen
    .filter(istWurzel)
    .sort(nachName)
    .map((g) => bauen(g, new Set()));
}

/** Alle Gruppen-IDs eines Teilbaums ohne die Wurzel selbst, jede einmal (bei zwei Obergruppen doppelt im Baum). */
export function nachfahren(knoten: Knoten): number[] {
  const ids = new Set<number>();
  const lauf = (k: Knoten) => {
    for (const c of k.kinder) {
      ids.add(c.gruppe.id);
      lauf(c);
    }
  };
  lauf(knoten);
  return [...ids];
}
