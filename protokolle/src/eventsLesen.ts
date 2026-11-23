/**
 * **Eventvorlagen und Events aus ChurchTools** (W15-3, Reiter „Events“ im Fenster „In Kalender eintragen“).
 *
 * - `ladeEventVorlagen`: `GET /eventtemplates` (nicht nach Kalender gefiltert – ChurchTools tut es auch nicht). **Wirft bei
 *   jedem Fehler** – „keine Vorlagen“ ist nicht „ChurchTools antwortet nicht“.
 * - `eventsNachlesen`: **Ein Erfolgssignal ist kein Beleg** (Lehre 11.08.2026). Nach dem Anlegen liest `GET /events?from&to`,
 *   ob zu jedem gewünschten Einzeltermin ein Event mit `appointmentId` = neuer Termin und demselben `startDate` da ist.
 *   Scheitert das Lesen, ist es **unklar**, nicht „fehlt“ (vorübergehend ist nicht ungültig).
 */
import { plusTage } from '@shared/ct/datum';
import { eventVorlagenAus, type EventVorlage } from '@shared/protokolle/terminEvents';
import { ctDaten } from '@ui/ct/verbindung';

/** Die Eventvorlagen in der Reihenfolge von ChurchTools. */
export async function ladeEventVorlagen(): Promise<EventVorlage[]> {
  return eventVorlagenAus(await ctDaten<unknown>('/eventtemplates'));
}

/** Eine Zeile aus `GET /events`, nur die gelesenen Felder. */
interface EventRoh {
  appointmentId?: number | null;
  startDate?: string;
}

/** Der Pfad, der die Events eines Zeitraums (Tage `JJJJ-MM-TT`) liest. */
export const eventsPfad = (von: string, bis: string): string => `/events?from=${von}&to=${bis}`;

/**
 * **Hat ChurchTools die gewünschten Events wirklich angelegt?** `fehlend` = gelesen, aber kein Event zu diesem Termin und
 * Beginn (die Tage `JJJJ-MM-TT` der Zeilen); `unklar` = das Lesen ist gescheitert. Wirft nie.
 */
export async function eventsNachlesen(q: {
  termin: number;
  gewuenscht: readonly { tag: string; startDate: string }[];
}): Promise<{ fehlend: string[]; unklar: boolean }> {
  if (!q.gewuenscht.length) return { fehlend: [], unklar: false };
  const tage = q.gewuenscht.map((g) => g.tag).sort();
  try {
    // Ein Tag Luft auf beiden Seiten – die Tage sind Ortszeit, `startDate` ist UTC.
    const liste = await ctDaten<EventRoh[] | null>(
      eventsPfad(plusTage(tage[0], -1), plusTage(tage[tage.length - 1], 1)),
    );
    const gelesen = liste ?? [];
    if (!Array.isArray(gelesen)) return { fehlend: [], unklar: true };
    const da = gelesen
      .filter((x) => x.appointmentId === q.termin && typeof x.startDate === 'string')
      .map((x) => Date.parse(x.startDate as string));
    return {
      fehlend: q.gewuenscht.filter((g) => !da.includes(Date.parse(g.startDate))).map((g) => g.tag),
      unklar: false,
    };
  } catch {
    return { fehlend: [], unklar: true };
  }
}
