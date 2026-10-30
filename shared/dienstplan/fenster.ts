/**
 * **Welche Termine die Matrix gerade zeigt** (Bauplan E3-5, Entwurf v17: Terminleiste ‹ ＋ … ＋ ›).
 * Ein Fenster über die geladenen Termine: erster sichtbarer (`start`) und Anzahl – `null` heißt
 * „passend zur Fensterbreite“ (so viele, wie nebeneinander passen).
 */

/**
 * Spaltenbreiten in Pixeln: schmal und breit (Alwin, 29.10.2026, Entwurf `e6-6-breiten-plus.html` – vorher S/M/L mit
 * 124/176/256; S fiel weg, dort waren die Titel im Ablauf abgeschnitten).
 */
export const SPALTENBREITE = { schmal: 176, breit: 256 } as const;
export type Breite = keyof typeof SPALTENBREITE;

/** Breite der festen Spalte „Dienst“ links. */
export const DIENST_SPALTE = 178;

export interface Fenster {
  /** Index des ersten sichtbaren Termins. */
  start: number;
  /** Wie viele; `null` = passend zur Fensterbreite. */
  anzahl: number | null;
}

/**
 * Wie viele Spalten in `platz` Pixel passen. Mindestens eine. Ist die Breite unbekannt (0, z. B. vor dem
 * ersten Messen), alle – lieber zu viel zeigen als nur eine Spalte.
 */
export function passendeAnzahl(platz: number, breite: Breite, gesamt: number): number {
  if (platz <= 0) return Math.max(1, gesamt);
  return Math.max(1, Math.floor((platz - DIENST_SPALTE - 2) / SPALTENBREITE[breite]));
}

/** Das sichtbare Stück: von `von` bis vor `bis`; ob es davor/danach noch Termine gibt. */
export function sichtbar(
  f: Fenster,
  gesamt: number,
  passend: number,
): { von: number; bis: number; davor: boolean; danach: boolean } {
  const von = Math.min(Math.max(0, f.start), Math.max(0, gesamt - 1));
  const bis = Math.min(gesamt, von + (f.anzahl ?? passend));
  return { von, bis, davor: von > 0, danach: bis < gesamt };
}

export type FensterSchritt = 'zurueck' | 'weiter' | 'frueherDazu' | 'spaeterDazu' | 'passend';

/** Ein Schritt in der Terminleiste – wie im Entwurf (`data-tnav`). */
export function schritt(f: Fenster, was: FensterSchritt, gesamt: number, passend: number): Fenster {
  const s = sichtbar(f, gesamt, passend);
  const zahl = s.bis - s.von;
  switch (was) {
    case 'zurueck':
      return s.davor ? { ...f, start: s.von - 1 } : f;
    case 'weiter':
      return s.danach ? { ...f, start: s.von + 1 } : f;
    case 'frueherDazu':
      return s.davor ? { start: s.von - 1, anzahl: zahl + 1 } : f;
    case 'spaeterDazu':
      return s.danach ? { start: s.von, anzahl: zahl + 1 } : f;
    case 'passend':
      return { ...f, anzahl: null };
  }
}
