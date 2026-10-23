/**
 * **Die Struktur in ChurchTools ändern – im Browser** (Bauplan O5): der `StrukturZugriff` für die Regeln in
 * `shared/organigramm/struktur.ts`, mit der Sitzung der Seite. Gemessen an der Test-Instanz (O0 §1/§2, 22.10.2026;
 * `parents` und Stammdaten 23.10.2026).
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctId } from '@shared/ct/ctId';
import { aktivStatus, type StrukturZugriff } from '@shared/organigramm/struktur';

const VERWEIGERT = 'Du darfst die Gruppen in ChurchTools nicht so ändern.';

/** „Die Gruppe ist bereits als Obergruppe gesetzt.“ – 400 mit `group.reference.already…` (O0 §1): Ziel erreicht. */
function schonGesetzt(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 400) return false;
  const key = (e.daten as { messageKey?: unknown } | undefined)?.messageKey;
  return typeof key === 'string' && key.includes('already');
}

export const strukturZugriff: StrukturZugriff = {
  // `parents` liefert Gruppen-Verweise, die ID als Text in `domainIdentifier` (gemessen 23.10.2026).
  async obergruppen(gruppeId) {
    const liste = await ctDaten<unknown>(`/groups/${gruppeId}/parents`);
    if (!Array.isArray(liste)) {
      throw new ApiError(502, 'ChurchTools hat die Obergruppen nicht geliefert.');
    }
    return liste
      .map((x) => ctId((x as { domainIdentifier?: unknown } | null)?.domainIdentifier))
      .filter((id): id is number => id !== null);
  },
  async setzen(gruppeId, elternId) {
    try {
      await ctAnfrage(`/groups/${gruppeId}/parents/${elternId}`, {
        method: 'PUT',
        body: '{}',
        verweigert: VERWEIGERT,
      });
    } catch (e) {
      if (!schonGesetzt(e)) throw e;
    }
  },
  async loesen(gruppeId, elternId) {
    await ctAnfrage(`/groups/${gruppeId}/parents/${elternId}`, {
      method: 'DELETE',
      verweigert: VERWEIGERT,
    });
  },
  async anlegen(d) {
    const body = await ctAnfrage<{ data?: { id?: unknown } } | null>('/groups', {
      method: 'POST',
      body: JSON.stringify({
        name: d.name,
        groupTypeId: d.typId,
        groupStatusId: d.statusId,
        parentGroupId: d.elternId,
      }),
      verweigert: VERWEIGERT,
    });
    const id = ctId(body?.data?.id);
    if (id === null) throw new NichtUebernommen('die neue Gruppe');
    return id;
  },
  async gibtEs(gruppeId) {
    try {
      await ctDaten<unknown>(`/groups/${gruppeId}`);
      return true;
    } catch (e) {
      // Nur „nicht gefunden“ heißt „gibt es nicht“ – alles andere (vorübergehend!) wirft weiter.
      if (e instanceof ApiError && e.status === 404) return false;
      throw e;
    }
  },
  async loeschen(gruppeId) {
    await ctAnfrage(`/groups/${gruppeId}`, { method: 'DELETE', verweigert: VERWEIGERT });
  },
  nichtUebernommen: (was) => new NichtUebernommen(was),
};

/** Der Status „aktiv“ für neue Gruppen (`/person/masterdata`) – sonst der Status der Obergruppe. */
export async function ladeAktivStatus(obergruppe: number | null): Promise<number | null> {
  const d = await ctDaten<{ groupStatuses?: unknown } | null>('/person/masterdata');
  const statusse = Array.isArray(d?.groupStatuses)
    ? (d.groupStatuses as { id?: unknown; name?: unknown }[])
    : null;
  return aktivStatus(statusse, obergruppe);
}
