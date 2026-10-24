/**
 * **Die Struktur in ChurchTools ändern – im Browser** (Bauplan O5): der `StrukturZugriff` für die Regeln in
 * `shared/organigramm/struktur.ts`, mit der Sitzung der Seite. Gemessen an der Test-Instanz (O0 §1/§2, 22.10.2026;
 * `parents` und Stammdaten 23.10.2026).
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctId } from '@shared/ct/ctId';
import { ctAlleSeiten } from '@ui/ct/verbindung';
import { aktivStatus, archivStatus, type StrukturZugriff } from '@shared/organigramm/struktur';
import type { UmbauStatus, UmbauZugriff } from '@shared/organigramm/umbau';
import type { RohGruppe } from '@shared/organigramm/gruppen';

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
        // Ohne Obergruppe: ein neuer Bereich (Umbau O7-3) – das Feld bleibt dann weg (so gemessen 24.10.2026).
        ...(d.elternId === null ? {} : { parentGroupId: d.elternId }),
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

/** Die Gruppen-Status aus den Stammdaten (`/person/masterdata` → `groupStatuses`) – `null`, wenn sie fehlen. */
async function ladeStatusse(): Promise<{ id?: unknown; name?: unknown }[] | null> {
  const d = await ctDaten<{ groupStatuses?: unknown } | null>('/person/masterdata');
  return Array.isArray(d?.groupStatuses)
    ? (d.groupStatuses as { id?: unknown; name?: unknown }[])
    : null;
}

/** Der Status „aktiv“ für neue Gruppen (`/person/masterdata`) – sonst der Status der Obergruppe. */
export async function ladeAktivStatus(obergruppe: number | null): Promise<number | null> {
  return aktivStatus(await ladeStatusse(), obergruppe);
}

/**
 * **Für den Umbau (O7-3):** die Status „aktiv“ und „archiviert“ – und welche Gruppen archiviert sind. Die liefert
 * ChurchTools nur eigens über `group_status_ids[]` (Messung O7-3, 24.10.2026); ohne Status „archiviert“ ist die Liste
 * `null` (= unbekannt, Archivieren gilt dann nie als erledigt).
 */
export async function ladeUmbauStatus(): Promise<
  UmbauStatus & { archivierteGruppen: Map<number, string> | null }
> {
  const statusse = await ladeStatusse();
  const archiviert = archivStatus(statusse);
  // Mit Namen – die Gruppe steht sonst nirgends mehr, und der erledigte Schritt soll sagen, welche es war.
  const archivierteGruppen =
    archiviert === null
      ? null
      : new Map(
          (await ctAlleSeiten<RohGruppe>(`/groups?group_status_ids[]=${archiviert}`)).flatMap(
            (g) =>
              typeof g.id === 'number'
                ? [[g.id, typeof g.name === 'string' ? g.name : ''] as const]
                : [],
          ),
        );
  return { aktiv: aktivStatus(statusse, null), archiviert, archivierteGruppen };
}

/**
 * Der `UmbauZugriff` (O7-3): wie `strukturZugriff`, dazu Name und Status einer Gruppe lesen und per `PATCH` ändern
 * (gemessen 24.10.2026: `PATCH /groups/{id}` mit `name` bzw. `groupStatusId` → 200, auch für archivierte lesbar).
 */
export const umbauZugriff: UmbauZugriff = {
  ...strukturZugriff,
  async gruppe(id) {
    let roh: { name?: unknown; information?: { groupStatusId?: unknown } } | null;
    try {
      roh = await ctDaten(`/groups/${id}`);
    } catch (e) {
      // Nur „nicht gefunden“ heißt „gibt es nicht“ – alles andere (vorübergehend!) wirft weiter.
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
    if (typeof roh?.name !== 'string') {
      throw new ApiError(502, 'ChurchTools hat die Gruppe nicht geliefert.');
    }
    const st = roh.information?.groupStatusId;
    return { name: roh.name, statusId: typeof st === 'number' ? st : null };
  },
  async aendern(id, felder) {
    await ctAnfrage(`/groups/${id}`, {
      method: 'PATCH',
      // Nicht genannte Felder sind `undefined` – die lässt `JSON.stringify` weg, ChurchTools ändert sie nicht.
      body: JSON.stringify({ name: felder.name, groupStatusId: felder.statusId }),
      verweigert: VERWEIGERT,
    });
  },
};
