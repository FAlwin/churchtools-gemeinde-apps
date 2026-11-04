import { COLORS_DARK_MODE_DEFAULT, COLORS_DEFAULT } from '@blocknote/core';
import { de } from '@blocknote/core/locales';
import type { Thema } from '@ui/design/thema';

/**
 * **Die Markier-Farben des Protokolls** (Bauplan K3a, Alwin 04.11.2026: „alle Farben des Editors, Hintergrund und
 * Schriftfarbe; im PDF gleich“). Werte und Namen kommen **aus BlockNote selbst** (`COLORS_DEFAULT`, für dunkel
 * `COLORS_DARK_MODE_DEFAULT`, Namen aus dem deutschen Wörterbuch) – der Editor färbt mit genau diesen Tabellen. So zeigen
 * Leiste, Lese-Ansicht und später das PDF dieselbe Farbe wie das Blatt, ohne dass hier eine Kopie der Werte steht.
 *
 * Gespeichert wird nur der Name (`styles.backgroundColor` / `styles.textColor`, z. B. `"yellow"`); `"default"` heißt keine.
 */

export type FarbArt = 'hintergrund' | 'schrift';

/** Die Farben in BlockNotes Reihenfolge: Grau, Braun, Rot, Orange, Gelb, Grün, Blau, Lila, Rosa. */
export const MARKIER_FARBEN: readonly { name: string; titel: string }[] = Object.keys(
  COLORS_DEFAULT,
).map((name) => ({
  name,
  titel: (de.color_picker.colors as Record<string, string>)[name] ?? name,
}));

/**
 * **Wo der Editor von BlockNote abweicht:** Gelb als Hintergrund ist unser Textmarker (`--markiert`, kräftiger als
 * BlockNotes blasses Gelb, hell und dunkel aus `ui/design`) – so seit S4-1. Der Editor bekommt das über
 * `DokumentEditor.scss` (`--bn-colors-highlights-yellow-background`); `ui/design/markierFarben.test.ts` prüft, dass beide Seiten
 * übereinstimmen.
 */
export const EIGENE_HINTERGRUENDE: Readonly<Record<string, string>> = { yellow: 'var(--markiert)' };

/** Der Farbwert zu einem gespeicherten Namen – `undefined` für „keine“ oder Unbekanntes (dann bleibt der Text, wie er ist). */
export function farbWert(name: unknown, art: FarbArt, thema: Thema): string | undefined {
  if (typeof name !== 'string' || name === 'default') return undefined;
  const tabelle = thema === 'dark' ? COLORS_DARK_MODE_DEFAULT : COLORS_DEFAULT;
  if (!Object.hasOwn(tabelle, name)) return undefined;
  if (art === 'hintergrund') return EIGENE_HINTERGRUENDE[name] ?? tabelle[name].background;
  return tabelle[name].text;
}
