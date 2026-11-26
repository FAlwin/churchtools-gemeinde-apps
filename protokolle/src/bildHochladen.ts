/**
 * **Das Bild eines Termins hochladen und nachlesen** (Feld „Bild“ im Reiter „Kalender“). Gemessen in der Test-Instanz am
 * 26.11.2026:
 * - `POST /files/appointment_image/{Termin-Basis-ID}` als multipart, Feld `files[]`; Antwort `200` mit `data: [{id, name, imageUrl, …}]`.
 * - Das Bild gilt für die ganze Serie; ein Termin hat höchstens eins, ein zweiter Upload ersetzt das erste.
 * - `GET /calendars/{kalender}/appointments/{id}` zeigt es als `appointment.image` (sonst `null`).
 *
 * **Ein `200` ist kein Beleg** (Lehre 11.08.2026): Nach dem Hochladen – auch nach einem Fehler beim Hochladen – wird der Termin
 * neu gelesen. `fehlt` heißt: gelesen, aber kein Bild; `unklar`: das Lesen ist gescheitert. Der Termin bleibt in jedem Fall
 * bestehen, es wird nie etwas gelöscht, und ein vorübergehender Fehler (Zeitgrenze, 5xx) macht nichts kaputt – er wird gemeldet.
 */
import { hatBild } from '@shared/protokolle/terminBild';
import { ctHochladen } from '@ui/ct/verbindung';
import { terminLaden } from './termin';

export const bildPfad = (termin: number): string => `/files/appointment_image/${termin}`;

/** Hochladen und nachlesen. Wirft nie. */
export async function bildHochladen(q: {
  kalender: number;
  termin: number;
  bild: File;
}): Promise<{ fehlt: boolean; unklar: boolean }> {
  try {
    const form = new FormData();
    form.append('files[]', q.bild, q.bild.name);
    await ctHochladen(bildPfad(q.termin), form);
  } catch {
    // Auch nach einem Fehler nachlesen: Eine Zeitgrenze oder ein 5xx sagt nicht, dass das Bild nicht ankam.
  }
  try {
    const roh = await terminLaden({ kalender: q.kalender, id: q.termin });
    return { fehlt: !hatBild(roh.image), unklar: false };
  } catch {
    return { fehlt: false, unklar: true };
  }
}
