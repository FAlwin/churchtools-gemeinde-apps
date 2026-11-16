/**
 * **Mitglieder in ChurchTools pflegen – im Browser** (Bauplan O6): der `MitgliedZugriff` für die Regeln in
 * `shared/organigramm/mitgliedschaft.ts` und die Rechte je Gruppe. Gemessen an der Test-Instanz (O6, 23.10.2026).
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctId } from '@shared/ct/ctId';
import { teilnehmerRolleAus } from '@shared/organigramm/gruppenwechselSicht';
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

/**
 * Die Teilnehmer-Rolle einer Gruppe (`GET /groups/{id}/roles`, gemessen 16.11.2026) – Rolle der Kinder, die als
 * Ausnahme gleich in die Wechsel-Gruppe aufgenommen werden (O9-3). Gibt es keine, wirft es eine Meldung, die das sagt.
 */
export async function ladeTeilnehmerRolle(gruppeId: number): Promise<number> {
  const rolle = teilnehmerRolleAus(
    await ctDaten<Parameters<typeof teilnehmerRolleAus>[0]>(`/groups/${gruppeId}/roles`),
  );
  if (rolle === null) {
    throw new ApiError(
      404,
      'Die Wechsel-Gruppe hat in ChurchTools keine Teilnehmer-Rolle. Bitte einen Admin fragen.',
    );
  }
  return rolle;
}
