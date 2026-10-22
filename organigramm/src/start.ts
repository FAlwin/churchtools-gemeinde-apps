/**
 * **Was das Organigramm beim Start braucht** (Bauplan Organigramm O1): wer angemeldet ist und die Gemeinde
 * (`ladeIch`, gemeinsam mit den anderen Erweiterungen), alle sichtbaren Gruppen, die Gruppentypen (für die
 * Farben), die Hierarchie und die globalen Rechte.
 *
 * Erst die Person, dann der Rest: Ist niemand angemeldet, soll genau das dastehen – nicht ein „kein Recht“
 * von einer Abfrage, die zufällig schneller zurückkam.
 */
import { ctAlleSeiten, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { ladeIch } from '@ui/ct/ich';
import {
  baumAus,
  elternAus,
  orgGruppenAus,
  type Knoten,
  type OrgGruppe,
  type RohGruppe,
  type RohHierarchie,
} from '@shared/organigramm/gruppen';
import { typFarbenAus } from '@shared/organigramm/farbe';
import { orgRechteAus, type OrgRechte } from '@shared/organigramm/rechte';

export interface Start {
  ichId: number;
  vorname: string;
  gemeinde: string | null;
  /** Alle Gruppen, die man in ChurchTools sehen darf. */
  gruppen: OrgGruppe[];
  /** Der Baum daraus; Wurzeln = Bereiche. */
  baum: Knoten[];
  /** Farbname je Gruppentyp – für Gruppen ohne eigene Farbe. */
  typFarben: Map<number, string | null>;
  rechte: OrgRechte;
}

/** **Wirft**, wenn etwas davon nicht lesbar ist – ein halber Baum sähe aus wie ein ganzer. */
export async function ladeStart(): Promise<Start> {
  const ich = await ladeIch();
  const [gruppenRoh, hierarchieRoh, typenRoh, rechteRoh] = await Promise.all([
    // `groups` liefert ohne `limit` nur 10 (gemessen 12.10.2026) – deshalb alle Seiten.
    ctAlleSeiten<RohGruppe>('/groups'),
    ctDaten<unknown>('/groups/hierarchies'),
    ctDaten<unknown>('/group/grouptypes'),
    ctDaten<Record<string, Record<string, unknown>> | null>('/permissions/global'),
  ]);
  if (!Array.isArray(hierarchieRoh)) {
    throw new ApiError(502, 'ChurchTools hat die Gruppen-Hierarchie nicht geliefert.');
  }
  if (!Array.isArray(typenRoh)) {
    throw new ApiError(502, 'ChurchTools hat die Gruppentypen nicht geliefert.');
  }
  const gruppen = orgGruppenAus(gruppenRoh);
  return {
    ichId: ich.id,
    vorname: ich.vorname,
    gemeinde: ich.gemeinde,
    gruppen,
    baum: baumAus(gruppen, elternAus(hierarchieRoh as RohHierarchie[])),
    typFarben: typFarbenAus(typenRoh as { id?: unknown; color?: unknown }[]),
    rechte: orgRechteAus(rechteRoh, (status, meldung) => new ApiError(status, meldung)),
  };
}
