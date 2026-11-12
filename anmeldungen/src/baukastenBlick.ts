/** Welcher Reiter über dem Formular gewählt ist (F1d). */
export type Blick = 'formular' | 'bedingungen';

/**
 * Der zuletzt gewählte Reiter je Veranstaltung, solange die Seite offen ist: „Rückgängig“ lädt die Veranstaltung neu
 * und baut den Baukasten neu auf – ohne das stünde man danach wieder im Formular statt bei der zurückgeholten Regel
 * (Durchklicken 12.11.2026).
 */
const BLICK = new Map<number, Blick>();

export function blickVon(id: number): Blick {
  return BLICK.get(id) ?? 'formular';
}
export function blickMerken(id: number, b: Blick) {
  BLICK.set(id, b);
}
/** Nur für Tests: den gemerkten Reiter vergessen. */
export function _blickVergessen() {
  BLICK.clear();
}
