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
import { rollenAus, type Rolle } from '@shared/organigramm/mitglieder';
import { diensteAus, type Dienst } from '@shared/ct/dienste';
import { meineGruppen } from '@shared/ct/gruppen';

export interface Start {
  ichId: number;
  vorname: string;
  gemeinde: string | null;
  /** Alle Gruppen, die man in ChurchTools sehen darf. */
  gruppen: OrgGruppe[];
  /** Der Baum daraus; Wurzeln = Bereiche. */
  baum: Knoten[];
  /** Obergruppen je Gruppe (auch unsichtbare) – fürs Gruppenfenster („gehört zu …“). */
  eltern: Map<number, number[]>;
  /** Farbname je Gruppentyp – für Gruppen ohne eigene Farbe. */
  typFarben: Map<number, string | null>;
  /** Name je Gruppentyp (`nameTranslated`, sonst `name`) – für den Filter und das Gruppenfenster. */
  typNamen: Map<number, string>;
  /** Die Gruppenrollen der Gemeinde: Leitung (`isLeader`), Reihenfolge, Name (O2). */
  rollen: Map<number, Rolle>;
  /**
   * Die Dienste der Gemeinde (`/services`, mit ihren ChurchTools-Gruppen) – oder `null`, wenn ChurchTools sie gerade
   * nicht liefert. Sie sind Beiwerk wie der Gemeindename: Ohne sie fehlen nur die Dienst-Schildchen, der Baum steht.
   */
  dienste: Map<number, Dienst> | null;
  rechte: OrgRechte;
  /** Die Gruppen, die man selbst LEITET (`isLeader`) – daraus der Sichtbereich für Personen und Hinweise (O3). */
  geleitet: number[];
}

/**
 * **Gruppen und Hierarchie, frisch** – für den Start und für den Umbau (O7-3), der nach jedem Schritt neu nachsieht.
 * Archivierte Gruppen liefert ChurchTools hier nicht (Messung O7-3). **Wirft**, wenn etwas davon nicht lesbar ist.
 */
export async function ladeGruppenbaum(): Promise<{
  gruppen: OrgGruppe[];
  eltern: Map<number, number[]>;
}> {
  const [gruppenRoh, hierarchieRoh] = await Promise.all([
    // `groups` liefert ohne `limit` nur 10 (gemessen 12.10.2026) – deshalb alle Seiten.
    ctAlleSeiten<RohGruppe>('/groups'),
    ctDaten<unknown>('/groups/hierarchies'),
  ]);
  if (!Array.isArray(hierarchieRoh)) {
    throw new ApiError(502, 'ChurchTools hat die Gruppen-Hierarchie nicht geliefert.');
  }
  return {
    gruppen: orgGruppenAus(gruppenRoh),
    eltern: elternAus(hierarchieRoh as RohHierarchie[]),
  };
}

/** **Wirft**, wenn etwas davon nicht lesbar ist – ein halber Baum sähe aus wie ein ganzer. */
export async function ladeStart(): Promise<Start> {
  const ich = await ladeIch();
  const [{ gruppen, eltern }, typenRoh, rechteRoh, diensteRoh] = await Promise.all([
    ladeGruppenbaum(),
    ctDaten<unknown>('/group/grouptypes'),
    ctDaten<Record<string, Record<string, unknown>> | null>('/permissions/global'),
    ctDaten<unknown>('/services').catch(() => null),
  ]);
  if (!Array.isArray(typenRoh)) {
    throw new ApiError(502, 'ChurchTools hat die Gruppentypen nicht geliefert.');
  }
  const typen = typenRoh as {
    id?: unknown;
    name?: unknown;
    nameTranslated?: unknown;
    color?: unknown;
  }[];
  return {
    ichId: ich.id,
    vorname: ich.vorname,
    gemeinde: ich.gemeinde,
    gruppen,
    baum: baumAus(gruppen, eltern),
    eltern,
    typFarben: typFarbenAus(typen),
    typNamen: new Map(
      typen.flatMap((t) => {
        const name = [t.nameTranslated, t.name].find(
          (n) => typeof n === 'string' && n.trim() !== '',
        );
        return typeof t.id === 'number' && typeof name === 'string'
          ? [[t.id, name.trim()] as const]
          : [];
      }),
    ),
    // Die Rollen liest `ladeIch` schon (`/group/roles`) – roh, mit allen Feldern; kein zweiter Abruf.
    rollen: rollenAus(ich.rollen),
    dienste: Array.isArray(diensteRoh)
      ? diensteAus(diensteRoh as Parameters<typeof diensteAus>[0])
      : null,
    rechte: orgRechteAus(rechteRoh, (status, meldung) => new ApiError(status, meldung)),
    // Dieselbe Leitungs-Regel wie im Dienstplaner (`meineGruppen`: nur aktive Mitgliedschaften, `isLeader`).
    geleitet: meineGruppen(ich.mitgliedschaften, ich.rollen)
      .filter((g) => g.leitung)
      .map((g) => g.id),
  };
}
