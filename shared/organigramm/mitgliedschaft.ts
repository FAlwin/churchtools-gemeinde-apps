/**
 * **Leitung und Mitglieder pflegen** (Bauplan O6, Alwin 23.10.2026). Nur die Regeln; wie geschrieben wird, reicht der
 * Aufrufer herein (`MitgliedZugriff`).
 *
 * Gemessen an der Test-Instanz (O6, 23.10.2026, `organigramm-planung/docs/messung-o6-2026-10-23.md`):
 * - **Anlegen und Ändern sind zwei Aufrufe** (gemessen 28.10.2026, ChurchTools-Mail „veraltete APIs“):
 *   `PUT /groups/{g}/members/{p}` mit `only_add: true` legt an (gibt es die Mitgliedschaft schon → 403, nichts
 *   überschrieben); `PATCH` ändert nur die geschickten Felder und legt NICHT an (→ 404). Ändern per `PUT` ist veraltet
 *   und löscht dabei Kommentar und Enddatum, wenn sie nicht mitgeschickt werden.
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
  /** Mitgliedschaft neu anlegen – scheitert, wenn es sie schon gibt. */
  anlegen(gruppeId: number, personId: number, felder: Record<string, unknown>): Promise<void>;
  /** Felder einer bestehenden Mitgliedschaft ändern – legt keine an; Ungeschicktes bleibt. */
  aendern(gruppeId: number, personId: number, felder: Record<string, unknown>): Promise<void>;
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
  if (vorher === null)
    await z.anlegen(gruppeId, personId, { groupTypeRoleId: rolleId, groupMemberStatus: 'active' });
  else
    await z.aendern(gruppeId, personId, {
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
  await z.aendern(gruppeId, personId, {
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
  await z.aendern(gruppeId, personId, { groupTypeRoleId: rolleId });
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
  await z.aendern(gruppeId, personId, { memberEndDate: heute });
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
  await z.aendern(gruppeId, personId, { memberEndDate: null });
  if (!laeuft(await z.lesen(gruppeId, personId))) {
    throw z.nichtUebernommen('das Zurücknehmen des Endes');
  }
}

// ── Ausnahme im Gruppenwechsel (O9-3) ──────────────────────────────────────────────────────────────────────────────
//
// Eine **Ausnahme** ist der Status „zu löschen“ des Kindes in der Wechsel-Gruppe – die Regeln in ChurchTools lassen es
// dann in Ruhe (gemessen O9-0). Gemessen 16.11.2026 (`organigramm-planung/docs/messung-o9-3-2026-11-16.md`):
// - Die Leitung der Wechsel-Gruppe ändert den Status per `PATCH` (`+edit groupmemberstatus`), darf aber weder aufnehmen
//   noch austragen. Wer `+add person` hat (Admin, Bereichsleitung), nimmt ein Kind, das noch nicht in der Wechsel-Gruppe
//   ist, gleich als „zu löschen“ auf (`PUT` + `only_add`).
// - „Rückgängig“ einer solchen Aufnahme ist Austragen (`DELETE`) – das darf nur, wer aufnehmen darf.

/** Der Status, der in der Wechsel-Gruppe „Ausnahme“ heißt. */
export const AUSNAHME_STATUS = 'to_delete';

const hatStatus = (m: Mitgliedschaft | null, status: string): boolean =>
  m !== null && m.status === status && m.ende === null;

/**
 * **Ausnahme setzen**: ist das Kind schon in der Wechsel-Gruppe, wird sein Status „zu löschen“; sonst wird es mit der
 * Teilnehmer-Rolle (`teilnehmerRolle`, nur dann geholt) gleich als „zu löschen“ aufgenommen. Nachgelesen wird der
 * **Status**. Liefert, was VORHER war – das braucht „Rückgängig“.
 */
export async function ausnahmeSetzen(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
  teilnehmerRolle: () => Promise<number>,
): Promise<Mitgliedschaft | null> {
  const vorher = await z.lesen(gruppeId, personId);
  if (vorher === null) {
    await z.anlegen(gruppeId, personId, {
      // Erst jetzt holen: Nur wer neu aufgenommen wird, braucht die Rolle – und der Stand eben gelesen gilt, nicht der der Anzeige.
      groupTypeRoleId: await teilnehmerRolle(),
      groupMemberStatus: AUSNAHME_STATUS,
    });
  } else {
    await z.aendern(
      gruppeId,
      personId,
      // Eine beendete Mitgliedschaft käme sonst als Ausnahme mit Enddatum zurück – und wäre für die Regeln kein Mitglied.
      vorher.ende === null
        ? { groupMemberStatus: AUSNAHME_STATUS }
        : { groupMemberStatus: AUSNAHME_STATUS, memberEndDate: null },
    );
  }
  if (!hatStatus(await z.lesen(gruppeId, personId), AUSNAHME_STATUS)) {
    throw z.nichtUebernommen('die Ausnahme');
  }
  return vorher;
}

/** **Ausnahme aufheben**: Status wieder „aktiv“, nachgelesen. Liefert, was VORHER war („Rückgängig“). */
export async function ausnahmeAufheben(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
): Promise<Mitgliedschaft | null> {
  const vorher = await z.lesen(gruppeId, personId);
  // Nicht (mehr) in der Gruppe: Es gibt nichts aufzuheben – und nichts, das „Rückgängig“ zurückholen könnte.
  if (vorher === null) return null;
  await z.aendern(gruppeId, personId, { groupMemberStatus: 'active' });
  if (!hatStatus(await z.lesen(gruppeId, personId), 'active')) {
    throw z.nichtUebernommen('das Aufheben der Ausnahme');
  }
  return vorher;
}

/**
 * „Rückgängig“ zu `ausnahmeSetzen`/`ausnahmeAufheben`: War das Kind vorher nicht in der Gruppe, wird es ausgetragen
 * (`DELETE`); sonst kommt der alte Status zurück (und ein altes Enddatum).
 */
export async function ausnahmeZurueck(
  z: MitgliedZugriff,
  gruppeId: number,
  personId: number,
  vorher: Mitgliedschaft | null,
): Promise<void> {
  if (vorher === null) {
    // Schon weg (z. B. von Hand ausgetragen): Es ist nichts mehr zurückzunehmen.
    if ((await z.lesen(gruppeId, personId)) === null) return;
    await z.entfernen(gruppeId, personId);
    if ((await z.lesen(gruppeId, personId)) !== null) throw z.nichtUebernommen('das Entfernen');
    return;
  }
  const status = vorher.status ?? 'active';
  await z.aendern(
    gruppeId,
    personId,
    vorher.ende === null
      ? { groupMemberStatus: status }
      : { groupMemberStatus: status, memberEndDate: vorher.ende },
  );
  const ist = await z.lesen(gruppeId, personId);
  if (ist === null || ist.status !== status || ist.ende !== vorher.ende) {
    throw z.nichtUebernommen('den alten Stand');
  }
}
