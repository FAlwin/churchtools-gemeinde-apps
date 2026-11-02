/**
 * **„Weitere Infos“ im Browser** (Scheibe T1): der Anschluss für `shared/ct/terminInfos.ts` – den Termin frisch lesen
 * (`ctDaten`, ohne Zwischenspeicher) und über den gemeinsamen Schreiber speichern.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { browserSchreiber } from '@ui/ct/schreiber';
import { NichtUebernommen } from '@ui/ct/fehler';
import {
  INFOS_NICHT_ANGEKOMMEN,
  infosSpeichern,
  type TerminInfosPort,
} from '@shared/ct/terminInfos';

const port: TerminInfosPort = {
  termin: (eventId) =>
    ctDaten<{ description?: unknown; isCanceled?: unknown }>(`/events/${eventId}`),
  schreibe: (pfad, auftrag) => browserSchreiber.schreibe(pfad, auftrag),
  // „Nicht angekommen“ als eigene Klasse – sonst machte `fehlerMeldung` aus dem 502 „ChurchTools antwortet gerade nicht“.
  fehler: (status, meldung) =>
    meldung === INFOS_NICHT_ANGEKOMMEN
      ? new NichtUebernommen('die Infos')
      : browserSchreiber.fehler(status, meldung),
};

export const speichereInfos = (eventId: number, neu: string, gesehen: string, trotzdem = false) =>
  infosSpeichern(port, eventId, neu, gesehen, trotzdem);
