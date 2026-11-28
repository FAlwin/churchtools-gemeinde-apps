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
import { reiheEventsAus, type ReiheEvent } from '@shared/protokolle/themenreihe';
import { ctDaten } from '@ui/ct/verbindung';

/** Die Eventvorlagen in der Reihenfolge von ChurchTools. */
export async function ladeEventVorlagen(): Promise<EventVorlage[]> {
  return eventVorlagenAus(await ctDaten<unknown>('/eventtemplates'));
}

/** Eine Zeile aus `GET /events`, nur die gelesenen Felder. */
interface EventRoh {
  appointmentId?: number | null;
  startDate?: string;
  id?: number;
  name?: string;
  calendar?: { domainIdentifier?: unknown };
}

/** Der Pfad, der die Events eines Zeitraums (Tage `JJJJ-MM-TT`) liest. */
export const eventsPfad = (von: string, bis: string): string => `/events?from=${von}&to=${bis}`;

/**
 * Die Events dieses Termins im Zeitraum der Tage (ein Tag Luft auf beiden Seiten – die Tage sind Ortszeit, `startDate` ist
 * UTC). **Wirft bei jedem Fehler** und bei einer Antwort, die keine Liste ist: Wer das Lesen nicht schafft, weiß nichts.
 * Die EINE Stelle für „Event zu Termin und Beginn suchen“ – `eventsNachlesen` und `eventZumTerminLesen` nutzen sie.
 */
async function eventsDesTermins(termin: number, tage: readonly string[]): Promise<EventRoh[]> {
  const sortiert = [...tage].sort();
  const liste = await ctDaten<EventRoh[] | null>(
    eventsPfad(plusTage(sortiert[0], -1), plusTage(sortiert[sortiert.length - 1], 1)),
  );
  const gelesen = liste ?? [];
  if (!Array.isArray(gelesen)) throw new Error('keine Liste');
  return gelesen.filter((x) => x.appointmentId === termin && typeof x.startDate === 'string');
}

/**
 * **Hat ChurchTools die gewünschten Events wirklich angelegt?** `fehlend` = gelesen, aber kein Event zu diesem Termin und
 * Beginn (die Tage `JJJJ-MM-TT` der Zeilen); `unklar` = das Lesen ist gescheitert. Wirft nie.
 */
export async function eventsNachlesen(q: {
  termin: number;
  gewuenscht: readonly { tag: string; startDate: string }[];
}): Promise<{ fehlend: string[]; unklar: boolean }> {
  if (!q.gewuenscht.length) return { fehlend: [], unklar: false };
  try {
    const da = (await eventsDesTermins(q.termin, q.gewuenscht.map((g) => g.tag))).map((x) =>
      Date.parse(x.startDate as string),
    );
    return {
      fehlend: q.gewuenscht.filter((g) => !da.includes(Date.parse(g.startDate))).map((g) => g.tag),
      unklar: false,
    };
  } catch {
    return { fehlend: [], unklar: true };
  }
}

/**
 * **Das Event zu einem Termin in der Hand haben** (Reihe, Scheibe 3): Nummer und Name, damit die Zeile der Reihe es tragen
 * kann – ein `201` beim Anlegen ist kein Beleg (Lehre 11.08.2026). `null` = gelesen, aber kein Event zu diesem Termin und
 * Beginn. **Wirft**, wenn das Lesen scheitert (dann weiß man es nicht – nicht „fehlt“).
 */
export async function eventZumTerminLesen(q: {
  termin: number;
  tag: string;
  startDate: string;
  zeitzone: string;
}): Promise<ReiheEvent | null> {
  const roh = (await eventsDesTermins(q.termin, [q.tag])).find(
    (x) => Date.parse(x.startDate as string) === Date.parse(q.startDate),
  );
  return roh ? (reiheEventsAus([roh], q.zeitzone)[0] ?? null) : null;
}
