/**
 * Texte des Plätze-Fachs (E4-5-3) – eigene Datei, damit `PlaetzeFach.tsx` nur die Komponente exportiert
 * (Fast Refresh).
 */
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';

/** Was ein Fehlschlag in Worten heißt (Gründe aus `anzahl.ts`). */
export function anzahlFehlerText(r: Extract<AnzahlErgebnis, { ok: false }>): string {
  switch (r.grund) {
    case 'konflikt':
      return `Jemand hat die Zahl eben geändert – jetzt ${r.jetzt ?? '?'}. Nichts geändert.`;
    case 'belegt':
      return 'Belegte Plätze lassen sich nicht wegnehmen – erst die Person zurückziehen.';
    case 'weg':
      return 'Den Termin gibt es nicht mehr.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir nicht, die Plätze dieses Termins zu ändern.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht – nicht bestätigt. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es angenommen, nachgelesen steht aber die alte Zahl da.';
  }
}
