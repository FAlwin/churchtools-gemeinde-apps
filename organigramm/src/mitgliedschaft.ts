/**
 * **Mitglieder in ChurchTools pflegen – im Browser** (Bauplan O6): der `MitgliedZugriff` für die Regeln in
 * `shared/organigramm/mitgliedschaft.ts` und die Rechte je Gruppe. Gemessen an der Test-Instanz (O6, 23.10.2026).
 */
import { ctDaten } from '@ui/ct/verbindung';
import { NichtUebernommen } from '@ui/ct/fehler';
import { ctId } from '@shared/ct/ctId';
import type { MitgliedZugriff } from '@shared/organigramm/mitgliedschaft';
import { gruppenRechteAus, type GruppenRechte } from '@shared/organigramm/rechte';
import {
  mitgliedAendern,
  mitgliedAnlegen,
  mitgliedEntfernen,
  mitgliedOderNichts,
} from '@ui/ct/mitglieder';

const VERWEIGERT = 'Du darfst die Mitglieder dieser Gruppe in ChurchTools nicht so ändern.';

export const mitgliedZugriff: MitgliedZugriff = {
  async lesen(gruppeId, personId) {
    // Nur „nicht gefunden“ heißt „nicht in der Gruppe“ – alles andere (vorübergehend!) wirft weiter.
    const m = await mitgliedOderNichts<{
      groupTypeRoleId?: unknown;
      groupMemberStatus?: unknown;
      memberEndDate?: unknown;
    } | null>(gruppeId, personId);
    if (m === null) return null;
    return {
      rolleId: ctId(m?.groupTypeRoleId),
      status: typeof m?.groupMemberStatus === 'string' ? m.groupMemberStatus : null,
      ende: typeof m?.memberEndDate === 'string' && m.memberEndDate !== '' ? m.memberEndDate : null,
    };
  },
  anlegen: (gruppeId, personId, felder) =>
    mitgliedAnlegen(gruppeId, personId, felder, { verweigert: VERWEIGERT }),
  aendern: (gruppeId, personId, felder) =>
    mitgliedAendern(gruppeId, personId, felder, { verweigert: VERWEIGERT }),
  entfernen: (gruppeId, personId) =>
    mitgliedEntfernen(gruppeId, personId, { verweigert: VERWEIGERT }),
  nichtUebernommen: (was) => new NichtUebernommen(was),
};

/** Was die eigene Rolle IN dieser Gruppe erlaubt (`/permissions/internal/groups/{id}`). */
export async function ladeGruppenRechte(gruppeId: number): Promise<GruppenRechte> {
  return gruppenRechteAus(
    await ctDaten<Record<string, Record<string, unknown>> | null>(
      `/permissions/internal/groups/${gruppeId}`,
    ),
  );
}
