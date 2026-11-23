import type { Betriebsart } from '@shared/ct/liveAgenda';
import type { SpeicherGrund } from '@shared/ct/versionierterWert';

/** Die drei Betriebsarten der Live-Ansicht (A3/A4) – Wortlaut aus dem abgenommenen Entwurf `live-2.html`, Abschnitt 8. */
export const BETRIEBSART_WAHL: { wert: Betriebsart; label: string; erklaerung: string }[] = [
  {
    wert: 'bis-beginn',
    label: 'Bis Beginn nach der Uhr, ab Beginn klicken',
    erklaerung:
      'Vor Beginn läuft alles von selbst. Ab Beginn wartet die Ansicht auf „Weiter“ und läuft sonst rot ins Minus.',
  },
  {
    wert: 'immer-uhr',
    label: 'Immer nach der Uhr',
    erklaerung: 'Wie bisher: folgt der Uhr, bis jemand „Starten“ drückt.',
  },
  {
    wert: 'klicken',
    label: 'Von Anfang an klicken',
    erklaerung: 'Auch der erste Punkt vor Beginn muss gestartet werden.',
  },
];

/** Was unter dem Fenster steht, wenn Lesen oder Speichern scheitert. */
export function einstellungenFehlerText(grund: SpeicherGrund, lesen: boolean): string {
  switch (grund) {
    case 'konflikt':
      return 'Ein anderer hat die Einstellung gerade geändert – nichts überschrieben.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir das nicht. Dafür braucht es in ChurchTools die Rechte für die Kategorie „Einstellungen“ des Dienstplaners.';
    case 'voruebergehend':
      return lesen
        ? 'ChurchTools antwortet gerade nicht – die Einstellung konnte nicht gelesen werden. Bis dahin gilt die Standard-Einstellung.'
        : 'ChurchTools antwortet gerade nicht – nicht gespeichert. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es angenommen, nachgelesen steht aber der alte Wert da.';
    case 'zu-gross':
      return 'Das ist zu groß für einen Wert in ChurchTools.';
  }
}
