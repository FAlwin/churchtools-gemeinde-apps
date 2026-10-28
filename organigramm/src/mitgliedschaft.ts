/**
 * **Mitglieder in ChurchTools pflegen – im Browser** (Bauplan O6): der `MitgliedZugriff` für die Regeln in
 * `shared/organigramm/mitgliedschaft.ts` und die Rechte je Gruppe. Gemessen an der Test-Instanz (O6, 23.10.2026).
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctId } from '@shared/ct/ctId';
import type { MitgliedZugriff } from '@shared/organigramm/mitgliedschaft';
import { gruppenRechteAus, type GruppenRechte } from '@shared/organigramm/rechte';

const VERWEIGERT = 'Du darfst die Mitglieder dieser Gruppe in ChurchTools nicht so ändern.';

export const mitgliedZugriff: MitgliedZugriff = {
  async lesen(gruppeId, personId) {
    try {
      const m = await ctDaten<{
        groupTypeRoleId?: unknown;
        groupMemberStatus?: unknown;
        memberEndDate?: unknown;
      } | null>(`/groups/${gruppeId}/members/${personId}`);
      return {
        rolleId: ctId(m?.groupTypeRoleId),
        status: typeof m?.groupMemberStatus === 'string' ? m.groupMemberStatus : null,
        ende:
          typeof m?.memberEndDate === 'string' && m.memberEndDate !== '' ? m.memberEndDate : null,
      };
    } catch (e) {
      // Nur „nicht gefunden“ heißt „nicht in der Gruppe“ – alles andere (vorübergehend!) wirft weiter.
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  async anlegen(gruppeId, personId, felder) {
    await ctAnfrage(`/groups/${gruppeId}/members/${personId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...felder, only_add: true }),
      verweigert: VERWEIGERT,
    });
  },
  async aendern(gruppeId, personId, felder) {
    await ctAnfrage(`/groups/${gruppeId}/members/${personId}`, {
      method: 'PATCH',
      body: JSON.stringify(felder),
      verweigert: VERWEIGERT,
    });
  },
  async entfernen(gruppeId, personId) {
    await ctAnfrage(`/groups/${gruppeId}/members/${personId}`, {
      method: 'DELETE',
      verweigert: VERWEIGERT,
    });
  },
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
