/**
 * **„Weitere Infos“ am Termin** – das „i“ in der Dienstplan-Liste von ChurchTools (Idee Alwin 02.11.2026, Entwurf
 * `termin-einstellungen.html` Variante B, Scheibe T1). Gemessen 02.11.2026 (`dienstplaner-planung/docs/
 * messung-termin-einstellungen.md`):
 *  - Das „i“ (alt `updateEventInfo`, Feld `special`) schreibt **`description`** an `/events/{id}`; `note` ist nur der
 *    veraltete zweite Name. Zeilen und Umlaute bleiben, `null` leert, **mehr als 4000 Zeichen → 400**.
 *  - **`PUT /events/{id}` ohne `isCanceled` setzt eine Absage auf `false` zurück** – ein abgesagter Termin wäre danach
 *    still wieder „findet statt“. Deshalb wird `isCanceled` vor jedem Speichern **frisch gelesen und mitgeschickt**.
 *    `adminIds` bleibt stehen, wenn es fehlt – das schicken wir bewusst nicht (ändern bräuchte „edit masterdata“).
 *  - Ändern darf, wer Admin ist, `edit events` für den Kalender des Termins hat oder Admin dieses Termins ist
 *    (`darfTerminAendern`); sonst 403. Lesen dürfen alle, die den Termin sehen.
 */
import { darfAblaufBearbeiten, type AblaufTermin } from './ablaufRecht';
import type { SchreibAuftrag } from './schreibKern';

/** Höchstlänge laut ChurchTools (4001 Zeichen → 400, gemessen). */
export const INFOS_MAX = 4000;

export const INFOS_VERWEIGERT =
  'ChurchTools erlaubt dir nicht, die Infos dieses Termins zu ändern.';
export const INFOS_NICHT_ANGEKOMMEN =
  'ChurchTools hat die Infos nicht übernommen. Bitte noch einmal speichern.';

/** Die Infos eines Termins aus der ChurchTools-Antwort – leer, wenn keine da sind. */
export function infosAus(termin: { description?: unknown } | null | undefined): string {
  return typeof termin?.description === 'string' ? termin.description : '';
}

/** So speichert ChurchTools den Text: Nur Leerraum heißt „keine Infos“ (`null`). */
const gespeichert = (text: string): string => (text.trim() === '' ? '' : text);

/**
 * **Darf ich die Infos (und Dateien) dieses Termins ändern?** Derselbe Aufbau wie beim Ablauf – Admin, das Recht für den
 * Kalender des Termins, Admin des Termins –, nur mit `edit events` statt `edit agenda` (gemessen 02.11.2026 mit Spike:
 * Kalender mit Recht 200, ohne 403, als Termin-Admin 200). Darum hier über `darfAblaufBearbeiten` statt nachgebaut.
 */
export function darfTerminAendern(
  rechte: { isAdmin: boolean; terminKalender: readonly number[] | null },
  termin: AblaufTermin,
  ichId: number | null,
): boolean {
  return darfAblaufBearbeiten(
    { isAdmin: rechte.isAdmin, ablaufKalender: rechte.terminKalender },
    termin,
    ichId,
  );
}

/** Der Anschluss: den Termin frisch lesen und schreiben (`CtSchreiber.schreibe`), Fehler in der Klasse des Aufrufers. */
export interface TerminInfosPort {
  /** `GET /events/{id}` – **frisch**, nie aus einem Cache. */
  termin(eventId: number): Promise<{ description?: unknown; isCanceled?: unknown }>;
  schreibe(pfad: string, auftrag: SchreibAuftrag): Promise<unknown>;
  fehler(status: number, meldung: string): Error;
}

export type InfosErgebnis =
  | { ok: true; text: string }
  /** Jemand hat die Infos inzwischen anders gespeichert – `aktuell` ist sein Text. Geschrieben wurde nichts. */
  | { ok: false; aktuell: string };

/**
 * **Infos speichern.** Erst frisch lesen: Steht dort nicht mehr, was das Fenster beim Öffnen sah (`gesehen`), und auch
 * nicht schon der neue Text, wird nicht still überschrieben (wie beim Ablauf, E6-3c) – außer mit `trotzdem`. Dann
 * schreiben, **mit dem frischen `isCanceled`**, und nachlesen: Erst der nachgelesene Text zählt (ein Erfolgssignal ist
 * kein Beleg). Wirft bei zu langem Text (400), Ablehnung (403 über `verweigert`) und wenn es nicht ankam (502).
 */
export async function infosSpeichern(
  port: TerminInfosPort,
  eventId: number,
  neu: string,
  gesehen: string,
  trotzdem = false,
): Promise<InfosErgebnis> {
  if (neu.length > INFOS_MAX) {
    throw port.fehler(400, `Höchstens ${INFOS_MAX} Zeichen – es sind ${neu.length}.`);
  }
  const ziel = gespeichert(neu);
  const frisch = await port.termin(eventId);
  const aktuell = infosAus(frisch);
  if (!trotzdem && aktuell !== gespeichert(gesehen) && aktuell !== ziel)
    return { ok: false, aktuell };
  await port.schreibe(`/events/${eventId}`, {
    method: 'PUT',
    json: { description: ziel === '' ? null : ziel, isCanceled: frisch.isCanceled === true },
    verweigert: INFOS_VERWEIGERT,
    fehler: 'Infos speichern fehlgeschlagen',
  });
  const nachher = infosAus(await port.termin(eventId));
  if (nachher !== ziel) throw port.fehler(502, INFOS_NICHT_ANGEKOMMEN);
  return { ok: true, text: nachher };
}
