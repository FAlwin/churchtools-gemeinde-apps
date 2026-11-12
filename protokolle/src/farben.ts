import { COLORS_DARK_MODE_DEFAULT, COLORS_DEFAULT } from '@blocknote/core';
import { de } from '@blocknote/core/locales';
import type { Thema } from '@ui/design/thema';
import type { Rgb } from '@shared/ct/terminBlatt';

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

/**
 * **Der Textmarker auf Papier** (S6-3a): `--markiert` der hellen Farben (`ui/design/_farben.scss`,
 * `rgba(250, 204, 21, 0.45)`) auf Weiß gemischt – ein PDF kennt keine CSS-Variablen. `farben.test.ts` rechnet es aus der
 * SCSS-Datei nach, damit beide nicht auseinanderlaufen.
 */
export const MARKIERT_PAPIER: Rgb = [253, 232, 150];

const hex = (h: string): Rgb | null => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};

/**
 * **Eine Markier-Farbe fürs PDF** – dieselbe Farbe wie auf dem hellen Blatt (`farbWert`), als Rot/Grün/Blau. Gelb als
 * Hintergrund ist unser Textmarker (`MARKIERT_PAPIER`).
 */
export function papierFarbe(name: unknown, art: FarbArt): Rgb | null {
  const wert = farbWert(name, art, 'light');
  if (!wert) return null;
  if (wert === EIGENE_HINTERGRUENDE.yellow) return MARKIERT_PAPIER;
  return hex(wert);
}
