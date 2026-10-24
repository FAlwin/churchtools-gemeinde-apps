import { MAX_ZEICHEN } from '@shared/ct/modulDaten';
import type { SpeicherGrund } from '@shared/ct/versionierterWert';

/** Was der Plan beim Laden oder Speichern sagt (O7-2) – im Ton der Dienstplaner-Texte (`plaetzeTexte`). */
export function planFehlerText(grund: SpeicherGrund): string {
  switch (grund) {
    case 'konflikt':
      return 'Ein anderer hat den Plan gerade geändert – nichts überschrieben.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir den Plan nicht. Dafür braucht es in ChurchTools die Rechte für die Kategorie „Plan“ der Erweiterung.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht – nicht gespeichert. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es angenommen, nachgelesen steht aber der alte Plan da.';
    case 'zu-gross':
      return `Der Plan ist zu groß für einen Wert in ChurchTools (höchstens ${MAX_ZEICHEN.toLocaleString('de-DE')} Zeichen).`;
  }
}

/** Ein anderer war schneller – nichts überschrieben. `von` = wer jetzt dasteht; `null` = der Plan ist verworfen. */
export function konfliktText(von: string | null): string {
  return von === null
    ? 'Der Plan wurde inzwischen verworfen. Deine letzte Änderung ist nicht gespeichert.'
    : `${von} hat den Plan inzwischen geändert. Deine letzte Änderung ist nicht gespeichert.`;
}
