/**
 * **Was das Organigramm aus den globalen ChurchTools-Rechten liest** (`GET /permissions/global`, Block
 * `churchdb`). Gemessen an der Test-Instanz (22.10.2026, O0 §4): Admin `administer groups: true`,
 * `create groups of grouptype: [1…5]`, `edit group: [IDs]`; ein Mitglied ohne Sonderrecht überall `false`/`[]`.
 *
 * **Das ist nur der globale Teil.** Was eine Rolle IN einer Gruppe bringt (`/permissions/internal/groups/{id}`,
 * z. B. „Person aufnehmen“ für Leiter), kommt mit O5/O6 dazu: wirksam ist global ODER intern.
 */
import { idsAusRecht, rechteAntwortPruefen } from '../ct/rechte';

export interface OrgRechte {
  /** Gruppen verwalten (umhängen, anlegen, löschen) – für alle Gruppen. */
  gruppenVerwalten: boolean;
  /** Gruppentypen, in denen man Gruppen anlegen darf; `null` = ohne Aufzählung → alle. */
  anlegbareTypen: number[] | null;
  /** Gruppen, die man bearbeiten darf; `null` = alle. */
  bearbeitbareGruppen: number[] | null;
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
  };
}
