/**
 * **Die Einstellungen des Gebetsabends** (Bauplan Gebetsabend G2/G3): aus welchem Kalender der nächste Termin kommt
 * und woran man ihn erkennt. Ein Wert in der Kategorie „Einstellungen“ – lesen alle, schreiben die Technik (G3).
 *
 * Das Suchwort braucht es, weil der Gebetsabend meist in einem gemeinsamen Kalender steht (gemessen G0-4: Mitglieder
 * sehen z. B. „Sonstige Veranstaltung“, nicht aber interne Kalender) – dort stehen auch andere Termine.
 */

import type { Dokumentart } from '../ct/versionierterWert';

export interface Einstellungen {
  /** ID des Kalenders, `null` = keiner gewählt → kein Termin auf der Seite. */
  kalender: number | null;
  /** Termine, deren Titel dieses Wort enthält (Groß-/Kleinschreibung egal); leer = jeder Termin des Kalenders. */
  suchwort: string;
}

export const STANDARD_EINSTELLUNGEN: Einstellungen = { kalender: null, suchwort: 'Gebet' };

/** Wie der Zugang ein Dokument mit Versionsnummer (G3, `ablage.ts`); Fassung 1 (bis G2, nie live) gilt als „nichts gespeichert“. */
export const EINSTELLUNGEN_DOKUMENT: Dokumentart = { art: 'gebetsabend-einstellungen', fassung: 2 };

/** Aus dem gespeicherten Inhalt; fehlt etwas, gilt die Vorgabe – ein kaputter Wert legt die Seite nicht lahm. */
export function einstellungenAus(inhalt: unknown): Einstellungen {
  const r = (inhalt && typeof inhalt === 'object' ? inhalt : {}) as Partial<Einstellungen>;
  return {
    kalender:
      typeof r.kalender === 'number' && Number.isInteger(r.kalender) && r.kalender > 0
        ? r.kalender
        : null,
    suchwort: typeof r.suchwort === 'string' ? r.suchwort.trim() : STANDARD_EINSTELLUNGEN.suchwort,
  };
}
