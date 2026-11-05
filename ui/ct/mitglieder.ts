/**
 * **Eine Mitgliedschaft in ChurchTools lesen, anlegen, ändern, entfernen** – die eine Stelle dafür (#848).
 *
 * Gemessen an der Test-Instanz (28.10.2026, #759; Protokoll `organigramm-planung/docs/messung-mitglieder-patch-2026-10-28.md`):
 *
 * - **Anlegen nur per `PUT` mit `only_add: true`.** Ist die Person schon in der Gruppe, lehnt ChurchTools ab (403
 *   `member.add.already-in-group`) – nie wird so eine bestehende überschrieben.
 * - **Ändern nur per `PATCH`.** Es ändert nur, was geschickt wird, und legt nichts an (404). Ändern per `PUT` ist
 *   veraltet und **löscht** dabei Kommentar und Enddatum, die nicht mitgeschickt wurden.
 * - **Lesen:** `GET /groups/{g}/members/{p}`, 404 = nicht in der Gruppe.
 *
 * Bis zum 05.11.2026 stand die Regel einzeln an sechs Schreibstellen in Anmeldungen und Organigramm, dazu viermal das
 * Lesen und zweimal „404 heißt nicht dabei“. Richtig waren alle – aber jede neue Lehre hätte sechsmal eingebaut werden
 * müssen. Der Wächter `ui/design/eineMitgliedschaft.test.ts` hält fest, dass niemand die Adresse selbst anspricht.
 */
import { ctAnfrage, ctDaten } from './verbindung';
import { ApiError } from './fehler';

/** Was beim Anlegen und Ändern mitgehen kann (ChurchTools-Namen). Felder als Nummer → Wert. */
export interface MitgliedAngaben {
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
  waitinglistPosition?: number;
  fields?: Record<number, string | boolean | null>;
  [weitere: string]: unknown;
}

/** Meldung bei fehlendem Recht (siehe `fehlerAus`) – sonst sagt ChurchTools es allgemein. */
interface Optionen {
  verweigert?: string;
}

const adresse = (gruppe: number, person: number) => `/groups/${gruppe}/members/${person}`;

/** Die Mitgliedschaft lesen – wirft bei jedem Fehler, auch bei 404. */
export function mitgliedLesen<T>(gruppe: number, person: number): Promise<T> {
  return ctDaten<T>(adresse(gruppe, person));
}

/**
 * Die Mitgliedschaft – oder `null`, wenn die Person nicht in der Gruppe ist (404, gemessen). Alles andere wirft
 * weiter: Ein vorübergehender Fehler ist nicht „nicht dabei“.
 */
export async function mitgliedOderNichts<T>(gruppe: number, person: number): Promise<T | null> {
  try {
    return await mitgliedLesen<T>(gruppe, person);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Neu in die Gruppe aufnehmen – `PUT` mit `only_add`, überschreibt nie eine bestehende Mitgliedschaft. */
export async function mitgliedAnlegen(
  gruppe: number,
  person: number,
  angaben: MitgliedAngaben,
  o: Optionen = {},
): Promise<void> {
  await ctAnfrage(adresse(gruppe, person), {
    method: 'PUT',
    body: JSON.stringify({ ...angaben, only_add: true }),
    verweigert: o.verweigert,
  });
}

/** Eine bestehende Mitgliedschaft ändern – `PATCH`, ändert nur das Geschickte, legt nichts an. */
export async function mitgliedAendern(
  gruppe: number,
  person: number,
  angaben: MitgliedAngaben,
  o: Optionen = {},
): Promise<void> {
  await ctAnfrage(adresse(gruppe, person), {
    method: 'PATCH',
    body: JSON.stringify(angaben),
    verweigert: o.verweigert,
  });
}

/** Aus der Gruppe entfernen. */
export async function mitgliedEntfernen(
  gruppe: number,
  person: number,
  o: Optionen = {},
): Promise<void> {
  await ctAnfrage(adresse(gruppe, person), { method: 'DELETE', verweigert: o.verweigert });
}
