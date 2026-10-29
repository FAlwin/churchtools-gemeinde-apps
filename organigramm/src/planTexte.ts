import { MAX_ZEICHEN } from '@shared/ct/modulDaten';
import type { SpeicherGrund } from '@shared/ct/versionierterWert';

/** Wovon die Rede ist – der Plan (O7-2) oder „Was das Organigramm zeigt“ (O7b-7). */
export interface Gespeichertes {
  /** „den Plan“ */
  akk: string;
  /** „der alte Plan“ */
  alt: string;
  /** Die Kategorie in ChurchTools: „Plan“ */
  kategorie: string;
}

export const PLAN: Gespeichertes = { akk: 'den Plan', alt: 'der alte Plan', kategorie: 'Plan' };

/**
 * Was beim Laden oder Speichern schiefging (O7-2) – im Ton der Dienstplaner-Texte (`plaetzeTexte`). EINE Stelle für
 * den Plan und „Was das Organigramm zeigt“.
 */
export function planFehlerText(grund: SpeicherGrund, was: Gespeichertes = PLAN): string {
  switch (grund) {
    case 'konflikt':
      return `Ein anderer hat ${was.akk} gerade geändert – nichts überschrieben.`;
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'kein-recht':
      return `ChurchTools erlaubt dir das nicht. Dafür braucht es in ChurchTools die Rechte für die Kategorie „${was.kategorie}“ der Erweiterung.`;
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht – nicht gespeichert. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return `ChurchTools hat es angenommen, nachgelesen steht aber ${was.alt} da.`;
    case 'zu-gross':
      return `Das ist zu groß für einen Wert in ChurchTools (höchstens ${MAX_ZEICHEN.toLocaleString('de-DE')} Zeichen).`;
  }
}

/** Ein anderer war schneller – nichts überschrieben. `von` = wer jetzt dasteht; `null` = der Plan ist verworfen. */
export function konfliktText(von: string | null): string {
  return von === null
    ? 'Der Plan wurde inzwischen verworfen. Deine letzte Änderung ist nicht gespeichert.'
    : `${von} hat den Plan inzwischen geändert. Deine letzte Änderung ist nicht gespeichert.`;
}
