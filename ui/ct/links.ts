/**
 * **Links nach ChurchTools** – die eine Stelle für die Adresse einer Person (stand vorher fünfmal ausgeschrieben:
 * Anmeldungen ×2, Organigramm ×2, N2b ×1).
 */
import { ctBasis } from './basis';

/** Die Personenseite in ChurchTools („In ChurchTools öffnen“). */
export const personLink = (personId: number): string =>
  `${ctBasis()}/?q=churchdb#PersonView/searchEntry:%23${personId}/`;
