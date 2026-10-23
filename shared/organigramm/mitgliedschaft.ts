/**
 * **Leitung und Mitglieder pflegen** (Bauplan O6, Alwin 23.10.2026). Nur die Regeln; wie geschrieben wird, reicht der
 * Aufrufer herein (`MitgliedZugriff`).
 *
 * Gemessen an der Test-Instanz (O6, 23.10.2026, `organigramm-planung/docs/messung-o6-2026-10-23.md`):
 * - Aufnehmen und Rolle ändern: `PUT /groups/{g}/members/{p}` – ein Teil der Felder genügt.
 * - **Austragen = Mitgliedschaft beenden** (`memberEndDate` = heute), nicht löschen: Die Historie bleibt, und es lässt
 *   sich mit `memberEndDate: null` rückgängig machen. `DELETE` löscht spurlos – nur für „Rückgängig“ direkt nach dem
 *   Aufnehmen einer Person, die vorher nie in der Gruppe war.
 * - Nachlesen: `GET /groups/{g}/members/{p}` (404 = nicht in der Gruppe).
 *
 * **Nach jedem Schreiben wird nachgelesen**; stimmt der Stand nicht, ist das ein Fehler mit genau dieser Aussage.
 * Kein Schreibvorgang wird automatisch wiederholt.
 */

export interface Mitgliedschaft {
  rolleId: number | null;
  status: string | null;
  /** Enddatum `YYYY-MM-DD` – `null` = läuft. */
  ende: string | null;
}

export interface MitgliedZugriff {
  /** Die Mitgliedschaft frisch aus ChurchTools – `null`, wenn die Person nicht in der Gruppe ist. */
  lesen(gruppeId: number, personId: number): Promise<Mitgliedschaft | null>;
  /** Felder der Mitgliedschaft setzen (legt sie an, wenn es sie nicht gibt). */
  schreiben(gruppeId: number, personId: number, felder: Record<string, unknown>): Promise<void>;
  /** Mitgliedschaft löschen – nur für „Rückgängig“ nach dem Aufnehmen. */
  entfernen(gruppeId: number, personId: number): Promise<void>;
  nichtUebernommen(was: string): Error;
}

const laeuft = (m: Mitgliedschaft | null): m is Mitgliedschaft =>
  m !== null && m.status === 'active' && m.ende === null;

/**
 * Aufnehmen mit Rolle – auch wer früher einmal dabei war (Enddatum wird geleert). Liefert, was VORHER war: das braucht
 * „Rückgängig“.
 */
export async function aufnehmen(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
  rolleId: number,
): Promise<Mitgliedschaft | null> {
  const vorher = await z.lesen(gruppeId, personId);
  await z.schreiben(gruppeId, personId, {
    groupTypeRoleId: rolleId,
    groupMemberStatus: 'active',
    memberEndDate: null,
  });
  const nachher = await z.lesen(gruppeId, personId);
  if (!laeuft(nachher) || nachher.rolleId !== rolleId) throw z.nichtUebernommen('die Aufnahme');
  return vorher;
}

/** „Rückgängig“ nach dem Aufnehmen: war die Person nie dabei, Mitgliedschaft löschen – sonst den alten Stand zurück. */
export async function aufnehmenZurueck(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
  vorher: Mitgliedschaft | null,
): Promise<void> {
  if (vorher === null) {
    await z.entfernen(gruppeId, personId);
    if ((await z.lesen(gruppeId, personId)) !== null) throw z.nichtUebernommen('das Entfernen');
    return;
  }
  await z.schreiben(gruppeId, personId, {
    groupTypeRoleId: vorher.rolleId,
    groupMemberStatus: vorher.status,
    memberEndDate: vorher.ende,
  });
  const ist = await z.lesen(gruppeId, personId);
  if (ist?.rolleId !== vorher.rolleId || ist.ende !== vorher.ende) {
    throw z.nichtUebernommen('den alten Stand');
  }
}

/** Rolle ändern (z. B. zur Leitung) und nachlesen. */
export async function rolleAendern(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
  rolleId: number,
): Promise<void> {
  await z.schreiben(gruppeId, personId, { groupTypeRoleId: rolleId });
  if ((await z.lesen(gruppeId, personId))?.rolleId !== rolleId) {
    throw z.nichtUebernommen('die neue Rolle');
  }
}

/** **Austragen = Mitgliedschaft beenden** (Enddatum `heute`, Ortszeit) und nachlesen. */
export async function beenden(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
  heute: string,
): Promise<void> {
  await z.schreiben(gruppeId, personId, { memberEndDate: heute });
  if ((await z.lesen(gruppeId, personId))?.ende !== heute) {
    throw z.nichtUebernommen('das Ende der Mitgliedschaft');
  }
}

/** „Rückgängig“ nach dem Beenden: Enddatum leeren. */
export async function beendenZurueck(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
): Promise<void> {
  await z.schreiben(gruppeId, personId, { memberEndDate: null });
  if (!laeuft(await z.lesen(gruppeId, personId))) {
    throw z.nichtUebernommen('das Zurücknehmen des Endes');
  }
}
