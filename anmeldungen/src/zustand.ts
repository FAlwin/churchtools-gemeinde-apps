import { ApiError } from '@ui/ct/fehler';
import { istUeberlastet } from '@ui/ct/verbindung';
import { NichtUebernommen } from './einrichten';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';

/** Was die Startseite gerade zeigt (#474, Übersicht seit A2 #480). */
export type Zustand =
  | { art: 'laedt' }
  | {
      art: 'fertig';
      start: Start;
      uebersicht: Uebersicht;
      /** Wo die Person anlegen darf (A3); `artId: null` = Gruppenart „Anmeldung“ fehlt. */
      anlegen: { artId: number | null; teamIds: number[] };
    }
  | { art: 'fehler'; text: string; nochmal: boolean };

/** Was bei einem Fehler gesagt wird – und ob „Erneut versuchen“ sinnvoll ist. */
export interface Fehlermeldung {
  text: string;
  nochmal: boolean;
}

/**
 * Was bei einem Fehler gesagt wird – die Zweige einzeln: abgemeldet ist etwas anderes als „antwortet
 * gerade nicht". Nur das Vorübergehende bekommt „Erneut versuchen". Hat ChurchTools geantwortet, aber
 * nicht übernommen (`NichtUebernommen`, A3), steht genau das da – nicht „antwortet gerade nicht“.
 */
export function fehlerMeldung(e: unknown): Fehlermeldung {
  if (e instanceof ApiError && e.status === 401) {
    return {
      text: 'Du bist bei ChurchTools nicht mehr angemeldet. Bitte lade die Seite neu und melde dich an.',
      nochmal: false,
    };
  }
  if (e instanceof NichtUebernommen) return { text: e.message, nochmal: true };
  if (istUeberlastet(e) || (e instanceof ApiError && e.status >= 500) || !(e instanceof ApiError)) {
    return {
      text: 'ChurchTools antwortet gerade nicht. Bitte versuch es gleich noch einmal.',
      nochmal: true,
    };
  }
  return { text: e.message, nochmal: true };
}

/** Die Startseite im Fehlerfall. */
export function fehlerZustand(e: unknown): Zustand {
  return { art: 'fehler', ...fehlerMeldung(e) };
}
