/**
 * **Was das Organigramm aus den globalen ChurchTools-Rechten liest** (`GET /permissions/global`, Block
 * `churchdb`). Gemessen an der Test-Instanz (22.10.2026, O0 §4): Admin `administer groups: true`,
 * `create groups of grouptype: [1…5]`, `edit group: [IDs]`; ein Mitglied ohne Sonderrecht überall `false`/`[]`.
 *
 * **Das ist nur der globale Teil.** Was eine Rolle IN einer Gruppe bringt (`/permissions/internal/groups/{id}`,
 * z. B. „Person aufnehmen“ für Leiter), kommt mit O6 dazu: wirksam ist global ODER intern. Für die Struktur (O5)
 * reicht der globale Teil – Leitungen dürfen weder umhängen noch anlegen (gemessen O0 §3), und ein Gruppen-Admin hat
 * intern `+edit group hierarchy: false`, darf es aber trotzdem (O0 §4).
 */
import { idsAusRecht, rechteAntwortPruefen } from '../ct/rechte';

export interface OrgRechte {
  /** Gruppen verwalten (umhängen, anlegen, löschen) – für alle Gruppen. */
  gruppenVerwalten: boolean;
  /** Gruppentypen, in denen man Gruppen anlegen darf; `null` = ohne Aufzählung → alle. */
  anlegbareTypen: number[] | null;
  /** Gruppen, die man bearbeiten darf; `null` = alle. */
  bearbeitbareGruppen: number[] | null;
  /** Gruppentypen, deren Gruppen man bearbeiten darf (`edit groups of grouptype`); `null` = alle. */
  bearbeitbareTypen: number[] | null;
}

const erlaubt = (liste: number[] | null, id: number | null) =>
  liste === null || (id !== null && liste.includes(id));

/**
 * **Darf man die Struktur dieser Gruppe ändern** (umhängen, lösen, Untergruppe darunter anlegen)? Gruppen-Admin, oder
 * die Gruppe selbst bzw. ihr Typ ist zum Bearbeiten freigegeben. EINE Regel für alle Knöpfe des Gruppenfensters.
 */
export function darfStruktur(r: OrgRechte, g: { id: number; typId: number | null }): boolean {
  return (
    r.gruppenVerwalten ||
    erlaubt(r.bearbeitbareGruppen, g.id) ||
    erlaubt(r.bearbeitbareTypen, g.typId)
  );
}

/** Die Gruppentypen, in denen man anlegen darf – aus denen, die es gibt; Gruppen-Admins dürfen alle. */
export function anlegbareTypenAus(r: OrgRechte, alle: Iterable<number>): number[] {
  return [...alle].filter((t) => r.gruppenVerwalten || erlaubt(r.anlegbareTypen, t));
}

export function orgRechteAus(
  data: Record<string, Record<string, unknown>> | null | undefined,
  fehler: (status: number, meldung: string) => Error,
): OrgRechte {
  rechteAntwortPruefen(data, fehler);
  const db = data.churchdb ?? {};
  return {
    gruppenVerwalten: db['administer groups'] === true,
    anlegbareTypen: idsAusRecht(db['create groups of grouptype']),
    bearbeitbareGruppen: idsAusRecht(db['edit group']),
    bearbeitbareTypen: idsAusRecht(db['edit groups of grouptype']),
  };
}
