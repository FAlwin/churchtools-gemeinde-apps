import { fehlerMeldung as allgemeineFehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { NichtUebernommen } from './einrichten';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';

export type { Fehlermeldung };

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
    }
  | { art: 'fehler'; text: string; nochmal: boolean };

/**
 * Was bei einem Fehler gesagt wird. Die allgemeinen Zweige (abgemeldet, vorübergehend, „ChurchTools sagt
 * Nein“) stehen EINMAL für alle Erweiterungen in `ui/ct/fehlerMeldung.ts`. Hier nur, was die Anmeldungen
 * zusätzlich kennen: Hat ChurchTools geantwortet, aber nicht übernommen (`NichtUebernommen`, A3), steht
 * genau das da – nicht „antwortet gerade nicht“. Muss VOR dem allgemeinen Teil stehen, denn
 * `NichtUebernommen` ist ein 502 und fiele dort unter „vorübergehend“.
 */
export function fehlerMeldung(e: unknown): Fehlermeldung {
  if (e instanceof NichtUebernommen) return { text: e.message, nochmal: true };
  return allgemeineFehlerMeldung(e);
}

/** Die Startseite im Fehlerfall. */
export function fehlerZustand(e: unknown): Zustand {
  return { art: 'fehler', ...fehlerMeldung(e) };
}
