/**
 * Was ein Fehlschlag beim Beantworten in Worten heißt (Gründe aus `@shared/dienstplan/einteilen`, E7-1) – eigene
 * Datei, damit `AntwortKnoepfe.tsx` nur Komponenten exportiert (Fast Refresh).
 */
import type { Grund, ZuSpaet } from '@shared/dienstplan/einteilen';

export function antwortFehlerText(grund: Grund | ZuSpaet): string {
  switch (grund) {
    case 'konflikt':
      return 'Die Anfrage hat sich inzwischen geändert – die Liste wird neu geladen.';
    case 'weg':
      return 'Den Termin oder Platz gibt es nicht mehr.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir das bei diesem Dienst nicht.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht – nicht bestätigt. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return 'ChurchTools hat die Antwort nicht übernommen. Bitte noch einmal.';
    case 'zu-spaet':
      return 'Zurücknehmen geht nur zehn Minuten lang – bitte in ChurchTools ändern.';
  }
}
