import type { VorliebenGrund } from '@shared/dienstplan/vorlieben';

/** Was ein Grund für den Planer heißt – eine Stelle für Lesen und Speichern. */
export function vorliebenGrundText(g: VorliebenGrund): string {
  switch (g) {
    case 'abgemeldet':
      return 'Du bist bei ChurchTools nicht mehr angemeldet. Bitte die Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools hat die Vorliebe nicht übernommen – dir fehlt das Recht, diese Dienstgruppe zu bearbeiten.';
    case 'nicht-angekommen':
      return 'ChurchTools hat „gespeichert“ gemeldet, nachgelesen steht aber etwas anderes da. Bitte noch einmal versuchen.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht. Nichts verloren – bitte gleich noch einmal versuchen.';
  }
}
