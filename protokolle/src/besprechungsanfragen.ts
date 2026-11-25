/**
 * **Besprechungsanfragen aus ChurchTools** (W15-4, Reiter „Besprechungsanfragen“ im Fenster „In Kalender eintragen“).
 *
 * - `ladeKandidaten`: `GET /calendars/{id}/meetingrequest/candidates` (das alte `…/meetingrequestpersons` ist veraltet).
 *   **Wirft bei jedem Fehler** – „niemand“ ist nicht „ChurchTools antwortet nicht“.
 * - `anfragenNachlesen`: **Ein Erfolgssignal ist kein Beleg** (Lehre 11.08.2026). Nach dem Anlegen liest
 *   `…/appointments/{id}/meetingrequests`, ob jede gewünschte Person eine Anfrage hat. Scheitert das Lesen, ist es
 *   **unklar**, nicht „fehlt“. Wirft nie.
 */
import { kandidatenAus, type Kandidat } from '@shared/protokolle/besprechungsanfrage';
import { ctDaten } from '@ui/ct/verbindung';
import { anfragenLesen, type TerminRef } from './termin';

export async function ladeKandidaten(kalender: number): Promise<Kandidat[]> {
  return kandidatenAus(await ctDaten<unknown>(`/calendars/${kalender}/meetingrequest/candidates`));
}

/** Haben alle `gewuenscht` eine Anfrage am Termin? `fehlend` = gelesen, aber keine Anfrage; `unklar` = Lesen gescheitert. */
export async function anfragenNachlesen(q: {
  termin: TerminRef;
  gewuenscht: readonly number[];
}): Promise<{ fehlend: number[]; unklar: boolean }> {
  if (!q.gewuenscht.length) return { fehlend: [], unklar: false };
  try {
    const da = new Set((await anfragenLesen(q.termin)).map((a) => a.person));
    return { fehlend: q.gewuenscht.filter((p) => !da.has(p)), unklar: false };
  } catch {
    return { fehlend: [], unklar: true };
  }
}
