import type { SpeicherGrund } from '@shared/ct/versionierterWert';

/** Hinweis, wenn der gespeicherte Wert nicht lesbar ist – er stammt dann womöglich aus einer neueren Fassung: nie überschreiben. */
export const ABFRAGE_UNLESBAR =
  'Die Abfrage wurde mit einer neueren Version des Dienstplaners gespeichert – bitte neu laden.';

/** Was im Fenster „Abfrage“ steht, wenn Lesen oder Speichern scheitert. */
export function abfragenFehlerText(grund: SpeicherGrund, lesen: boolean): string {
  switch (grund) {
    case 'konflikt':
      return 'Ein anderer hat die Abfrage gerade geändert – nichts überschrieben.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir das nicht. Dafür braucht es in ChurchTools die Rechte für die Kategorie „Einstellungen“ des Dienstplaners.';
    case 'voruebergehend':
      return lesen
        ? 'ChurchTools antwortet gerade nicht – die Abfrage konnte nicht gelesen werden.'
        : 'ChurchTools antwortet gerade nicht – nicht gespeichert. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es angenommen, nachgelesen steht aber der alte Stand da. Bitte neu lesen und prüfen.';
    case 'zu-gross':
      return 'Das ist zu groß für einen Wert in ChurchTools.';
  }
}

/** Der leise Hinweis, solange es die Automatik (R-5) noch nicht gibt – ehrlich statt versprochen. */
export const automatikHinweis = (gruppe: string) =>
  `Automatische Erinnerungen sind für ${gruppe} noch nicht eingerichtet – bis dahin per „Erinnern“.`;
