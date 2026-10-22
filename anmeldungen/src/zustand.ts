import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';

export type { Fehlermeldung };
export { fehlerMeldung };

/** Was die Startseite gerade zeigt (#474, Übersicht seit A2 #480). */
export type Zustand =
  | { art: 'laedt' }
  | {
      art: 'fertig';
      start: Start;
      uebersicht: Uebersicht;
      /** Wo die Person anlegen darf (A3); `artId: null` = Gruppenart „Anmeldung“ fehlt. */
      anlegen: { artId: number | null; teamIds: number[] };
      /** Gruppen-Admin: darf jede Veranstaltung freigeben (A5: Hinweis auf der Startseite). */
      admin: boolean;
      /** Adresse der Formular-Seite der Gemeinde – `null`, solange keine eingerichtet ist (A6-2). */
      formular: string | null;
      /** Zahlarten der Gemeinde (A7-2) – ohne gespeicherte Liste die Standardliste. */
      zahlarten: string[];
    }
  | { art: 'fehler'; text: string; nochmal: boolean };

/** Die Startseite im Fehlerfall. */
export function fehlerZustand(e: unknown): Zustand {
  return { art: 'fehler', ...fehlerMeldung(e) };
}
