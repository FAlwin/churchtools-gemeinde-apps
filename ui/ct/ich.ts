/**
 * **Wer ist angemeldet, in welcher Gemeinde, in welchen Gruppen?** – der Anfang jeder Erweiterung dieses
 * Repos (Dienstplaner E2). Genutzt vom Dienstplaner und von der Startseite der Anmeldungen.
 *
 * Gelesen wird mit der Sitzung der ChurchTools-Seite (`verbindung.ts`); die Regeln stehen in
 * `shared/ct/` (`whoamiId`, `gemeindeNameAus`). Die Mitgliedschaften kommen **roh** zurück: Jede App
 * filtert selbst (die Anmeldungen lassen ihre Veranstaltungen weg) und wertet dann mit `meineGruppen` aus.
 */
import { ctAnfrage, ctDaten } from './verbindung';
import { ApiError } from './fehler';
import { whoamiId } from '@shared/ct/whoami';
import type { RohMitgliedschaft } from '@shared/ct/gruppen';
import { gemeindeNameAus } from '@shared/ct/info';

export interface Ich {
  id: number;
  vorname: string;
  /** `null`, wenn ChurchTools keinen Namen nennt oder `/info` gerade nicht antwortet. */
  gemeinde: string | null;
  mitgliedschaften: RohMitgliedschaft[];
  /** Die Gruppenrollen der Gemeinde (`/group/roles`) – daraus liest `meineGruppen` die Leitung. */
  rollen: { id?: unknown; isLeader?: unknown }[];
}

/**
 * **Wirft**, wenn Person, Gruppen oder Rollen nicht lesbar sind: Eine leere Liste hieße „du bist in
 * keiner Gruppe“, und das wäre bei einem Aussetzer von ChurchTools falsch. Nur der Gemeindename ist
 * Beiwerk und darf fehlen.
 */
export async function ladeIch(): Promise<Ich> {
  const ich = await ctDaten<{ id?: unknown; firstName?: unknown } | null>('/whoami');
  const id = whoamiId(ich);
  if (id === 0) throw new ApiError(401, 'Bei ChurchTools nicht angemeldet.');
  if (id === null) throw new ApiError(503, 'ChurchTools antwortet gerade nicht eindeutig.');
  const [mitgliedschaften, rollen, gemeinde] = await Promise.all([
    ctDaten<RohMitgliedschaft[] | null>(`/persons/${id}/groups`),
    ctDaten<{ id?: unknown; isLeader?: unknown }[] | null>('/group/roles'),
    ctAnfrage<unknown>('/info').then(gemeindeNameAus, () => null),
  ]);
  if (!Array.isArray(mitgliedschaften) || !Array.isArray(rollen)) {
    throw new ApiError(502, 'ChurchTools hat die Gruppen nicht vollständig geliefert.');
  }
  const vorname = typeof ich?.firstName === 'string' ? ich.firstName.trim() : '';
  return { id, vorname, gemeinde, mitgliedschaften, rollen };
}
