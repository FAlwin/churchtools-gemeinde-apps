/**
 * **„Weitere Infos“ eines Termins im Browser**: der Anschluss für `shared/ct/terminInfos.ts` – den Termin frisch lesen
 * (`ctDaten`, ohne Zwischenspeicher) und über den gemeinsamen Schreiber speichern. Eine Stelle für den Dienstplaner
 * (Fenster „Weitere Infos“, Scheibe T1) und die Protokolle („Reihe in Events übertragen“) – bis 27.11.2026 lag sie im
 * Dienstplaner.
 */
import { ctDaten } from './verbindung';
import { browserSchreiber } from './schreiber';
import { NichtUebernommen } from './fehler';
import {
  INFOS_NICHT_ANGEKOMMEN,
  infosSpeichern,
  type TerminInfosPort,
} from '@shared/ct/terminInfos';

/** Ein Event, frisch aus `GET /events/{id}` – nur die Felder, die Infos und Rechte brauchen. */
export interface FrischesEvent {
  name?: unknown;
  startDate?: unknown;
  description?: unknown;
  isCanceled?: unknown;
  calendar?: { domainIdentifier?: unknown };
  adminIds?: unknown;
  eventAdminIds?: unknown;
}

/** `GET /events/{id}` – **frisch**, nie aus einem Cache. */
export const leseEvent = (eventId: number): Promise<FrischesEvent> =>
  ctDaten<FrischesEvent>(`/events/${eventId}`);

const port: TerminInfosPort = {
  termin: (eventId) => leseEvent(eventId),
  schreibe: (pfad, auftrag) => browserSchreiber.schreibe(pfad, auftrag),
  // „Nicht angekommen“ als eigene Klasse – sonst machte `fehlerMeldung` aus dem 502 „ChurchTools antwortet gerade nicht“.
  fehler: (status, meldung) =>
    meldung === INFOS_NICHT_ANGEKOMMEN
      ? new NichtUebernommen('die Infos')
      : browserSchreiber.fehler(status, meldung),
};

export const speichereInfos = (eventId: number, neu: string, gesehen: string, trotzdem = false) =>
  infosSpeichern(port, eventId, neu, gesehen, trotzdem);
