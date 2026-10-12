import { ApiError } from '@ui/ct/fehler';
import { istUeberlastet } from '@ui/ct/verbindung';
import type { Start } from './start';

/** Was die Startseite gerade zeigt (#474). */
export type Zustand =
  | { art: 'laedt' }
  | { art: 'fertig'; start: Start }
  | { art: 'fehler'; text: string; nochmal: boolean };

/**
 * Was bei einem Fehler gesagt wird – die Zweige einzeln: abgemeldet ist etwas anderes als „antwortet
 * gerade nicht". Nur das Vorübergehende bekommt „Erneut versuchen".
 */
export function fehlerZustand(e: unknown): Zustand {
  if (e instanceof ApiError && e.status === 401) {
    return {
      art: 'fehler',
      text: 'Du bist bei ChurchTools nicht mehr angemeldet. Bitte lade die Seite neu und melde dich an.',
      nochmal: false,
    };
  }
  if (istUeberlastet(e) || (e instanceof ApiError && e.status >= 500) || !(e instanceof ApiError)) {
    return {
      art: 'fehler',
      text: 'ChurchTools antwortet gerade nicht. Bitte versuch es gleich noch einmal.',
      nochmal: true,
    };
  }
  return { art: 'fehler', text: e.message, nochmal: true };
}
