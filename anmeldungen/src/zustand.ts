import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';
import type { NachweisEinstiegDaten } from './nachweisArten';

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
      /**
       * Der Einstieg „Nachweise“ (N1b): `null` = nichts zu zeigen (kein Recht, keine Nachweis-Gruppe geleitet – oder
       * nicht lesbar; dann fehlt nur die Karte). `darfEinrichten`: „Berechtigungen verwalten“. N2a: dazu die Arten mit
       * ihren Personen (leer, wenn sie sich nicht lesen ließen – dann ohne Zahlen).
       */
      nachweise: NachweisEinstiegDaten | null;
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
