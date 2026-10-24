/** Menü „Einfügen“ im Lied-Editor (L6): was es anbietet – eigene Datei, damit die Komponente nur Komponenten exportiert. */

/** Was das Menü einfügen kann – der Editor setzt es in den Text. */
export type Einfuegen =
  | { art: 'teil'; name: string }
  | { art: 'pedal' }
  | { art: 'anderes'; tag: string; mitWert: boolean };

/** Die Teile, die das Menü anbietet; „Vers“ nummeriert sich selbst (`neuerTeilName`). */
export const TEILE = [
  'Vers',
  'Refrain',
  'Pre-Chorus',
  'Bridge',
  'Intro',
  'Zwischenspiel',
  'Outro',
  'Ende',
];

/**
 * Gültiges ChordPro, das in DIESER App nichts bewirkt (Kapo kommt vom Kapo-Wähler am Blatt, die übrigen
 * übergeht die Vorschau) – für Notenblätter, die auch in anderen Programmen laufen. Die Kopfangaben (Titel,
 * Autor, Tempo …) stehen hier bewusst NICHT: Sie gehören seit L4 in die Liedinfo und würden im Text unsichtbar
 * eingefügt.
 */
export const ANDERE: { tag: string; label: string; mitWert: boolean }[] = [
  { tag: 'capo', label: 'Kapo (Bund)', mitWert: true },
  { tag: 'column_break', label: 'Neue Spalte', mitWert: false },
  { tag: 'new_page', label: 'Neue Seite', mitWert: false },
  { tag: 'subtitle', label: 'Untertitel', mitWert: true },
];
