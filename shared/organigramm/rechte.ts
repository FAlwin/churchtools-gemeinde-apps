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
import { idsAusRecht, rechteAntwortPruefen, rechteAus, STANDARD_ADMIN_RECHT } from '../ct/rechte';

export interface OrgRechte {
  /** Gruppen verwalten (umhängen, anlegen, löschen) – für alle Gruppen. */
  gruppenVerwalten: boolean;
  /** Gruppentypen, in denen man Gruppen anlegen darf; `null` = ohne Aufzählung → alle. */
  anlegbareTypen: number[] | null;
  /** Gruppen, die man bearbeiten darf; `null` = alle. */
  bearbeitbareGruppen: number[] | null;
  /** Gruppentypen, deren Gruppen man bearbeiten darf (`edit groups of grouptype`); `null` = alle. */
  bearbeitbareTypen: number[] | null;
  /** Mitglieder pflegen – global (O6): `edit group memberships` (true = alle) und die Listen je Gruppe/Typ. */
  mitgliederAlle: boolean;
  mitgliederGruppen: number[];
  mitgliederTypen: number[];
  /**
   * „Berechtigungen verwalten“ (`churchcore: administer persons`, O9-F8) – NICHT dasselbe wie `gruppenVerwalten`. Nur wer
   * es hat, darf die Regeln der Wechsel-Gruppen lesen (`GET /dynamicgroups/{id}/ruleset`) und sieht, welche Wechseltage
   * dort eingetragen sind. Gelesen über `rechteAus` wie in Musik-App und Dienstplaner – keine zweite Auswertung.
   */
  rechteVerwalten: boolean;
}

/**
 * **Was die eigene Rolle IN einer Gruppe erlaubt** (`/permissions/internal/groups/{id}`, gemessen O6 23.10.2026):
 * Leitung von Lobpreisteam `+add person` und `+edit group memberships` ja, `+remove from group` nein.
 */
export interface GruppenRechte {
  aufnehmen: boolean;
  rolleAendern: boolean;
  beenden: boolean;
  /**
   * Den **Status** einer Mitgliedschaft ändern (`+edit groupmemberstatus`) – „zu löschen“ als Ausnahme im Gruppenwechsel
   * (O9-3). Gemessen 16.11.2026: Die Leitung der Wechsel-Gruppe darf das, ohne aufnehmen (`+add person`) oder
   * austragen (`+remove from group`) zu dürfen.
   */
  statusAendern: boolean;
}

export const KEINE_GRUPPENRECHTE: GruppenRechte = {
  aufnehmen: false,
  rolleAendern: false,
  beenden: false,
  statusAendern: false,
};

export function gruppenRechteAus(
  data: Record<string, Record<string, unknown>> | null | undefined,
): GruppenRechte {
  const db = data?.churchdb ?? {};
  return {
    aufnehmen: db['+add person'] === true,
    rolleAendern: db['+edit group memberships'] === true,
    beenden: db['+remove from group'] === true,
    statusAendern: db['+edit groupmemberstatus'] === true,
  };
}

/**
 * **Was man an den Mitgliedern dieser Gruppe darf** – global ODER je Gruppe (O0 §4). Gruppen-Admins und wer global
 * „Mitgliedschaften bearbeiten“ für die Gruppe oder ihren Typ hat, darf alles; sonst entscheidet die eigene Rolle in
 * der Gruppe. EINE Regel für alle Knöpfe an den Mitgliedern.
 */
export function mitgliederRechte(
  r: OrgRechte,
  intern: GruppenRechte,
  g: { id: number; typId: number | null },
): GruppenRechte {
  const global =
    r.gruppenVerwalten ||
    r.mitgliederAlle ||
    r.mitgliederGruppen.includes(g.id) ||
    (g.typId !== null && r.mitgliederTypen.includes(g.typId));
  return {
    aufnehmen: global || intern.aufnehmen,
    rolleAendern: global || intern.rolleAendern,
    beenden: global || intern.beenden,
    statusAendern: global || intern.statusAendern,
  };
}

/**
 * Wie `mitgliederRechte`, aber **`null`, wenn man es nicht wissen kann**: Ließen sich die Rechte in der Gruppe nicht
 * lesen (`intern` fehlt) und gibt es auch global nichts, wäre „kein Recht“ geraten – vielleicht war es nur ein Aussetzer.
 * Der Gruppenwechsel (O9-3) sagt dann „nicht lesbar“ statt „fehlt dir das Recht“.
 */
export function mitgliederRechteOderNichts(
  r: OrgRechte,
  intern: GruppenRechte | null,
  g: { id: number; typId: number | null },
): GruppenRechte | null {
  const rechte = mitgliederRechte(r, intern ?? KEINE_GRUPPENRECHTE, g);
  if (intern === null && !Object.values(rechte).some(Boolean)) return null;
  return rechte;
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
    mitgliederAlle: db['edit group memberships'] === true,
    mitgliederGruppen: idsAusRecht(db['edit group memberships of group']) ?? [],
    mitgliederTypen: idsAusRecht(db['edit group memberships of grouptype']) ?? [],
    rechteVerwalten: rechteAus(data, STANDARD_ADMIN_RECHT, fehler).isAdmin,
  };
}
