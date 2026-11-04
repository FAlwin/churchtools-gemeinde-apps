/**
 * Was ein Fehlschlag beim Tauschen in Worten heißt (Gründe aus `@shared/dienstplan/tausch`, E7-3) – eigene Datei, damit
 * die Komponenten-Dateien nur Komponenten exportieren (Fast Refresh).
 */
import type { TauschGrund } from '@shared/dienstplan/tausch';

export const TAUSCH_VORUEBERGEHEND =
  'ChurchTools antwortet gerade nicht – nicht bestätigt. Bitte gleich noch einmal.';

export function tauschFehlerText(grund: TauschGrund): string {
  switch (grund) {
    case 'schon-angefragt':
      return 'An diesem Dienst läuft schon eine Tausch-Anfrage – erst zurückziehen, dann jemand anderen fragen.';
    case 'weg':
      return 'Diesen Dienst hast du nicht mehr – die Liste wird neu geladen.';
    case 'beantwortet':
      return 'Die Tausch-Anfrage ist inzwischen beantwortet oder zurückgezogen.';
    case 'unklar':
      return 'Unklar, ob ChurchTools es übernommen hat – bitte die Seite neu laden und nachsehen.';
  }
}
