/**
 * Die Werkzeuge des Liedblatts (Aussehen, Tempo, Zoom, Notizen von …, Anmerken) – Name und Regel an
 * EINER Stelle. Eigene Datei, weil `BlattKopf` als Komponenten-Datei nichts anderes exportieren soll
 * (Vites Fast Refresh, Lint-Regel `react-refresh/only-export-components`).
 */

/** Die Werkzeuge des Liedblatts. */
export type WerkzeugId = 'aussehen' | 'tempo' | 'zoom' | 'team' | 'anmerken';

export const WERKZEUG_NAME: Record<WerkzeugId, string> = {
  aussehen: 'Aussehen',
  tempo: 'Tempo',
  zoom: 'Zoom zurücksetzen',
  team: 'Notizen von …',
  anmerken: 'Anmerken',
};

/**
 * **Welche Werkzeuge es gibt – EINE Regel** für die Knöpfe der Kopfkarte (Scheibe B1; vorher Werkzeuge-Menü im
 * Hochformat und einzelne Knöpfe je Lied im Querformat). Die Bedingungen sind die der früheren Einzelknöpfe:
 * Ein Dokument statt Akkorden kennt weder Aussehen noch Team-Notizen; beim Ansehen fremder Notizen
 * gibt es nur den Weg zurück; „Zoom zurücksetzen" nur, wenn reingezoomt ist.
 */
export function verfuegbareWerkzeuge(b: {
  zeigtDokument: boolean;
  ansehen: boolean;
  gezoomt: boolean;
  teamNotizen: boolean;
}): WerkzeugId[] {
  const ids: WerkzeugId[] = [];
  if (!b.zeigtDokument && !b.ansehen) ids.push('aussehen');
  // Tempo bewusst auch ohne gepflegtes Tempo (#145): Genau dann will man eins antippen.
  if (!b.ansehen) ids.push('tempo');
  if (b.gezoomt) ids.push('zoom');
  if (b.teamNotizen && !b.zeigtDokument) ids.push('team');
  if (!b.ansehen) ids.push('anmerken');
  return ids;
}

/** Kurzwort unter dem Symbol im 4er-Raster am Handy (Scheibe B1). Der volle Name bleibt für Screenreader. */
export const WERKZEUG_KURZ: Record<WerkzeugId, string> = {
  aussehen: 'Aussehen',
  tempo: 'Tempo',
  zoom: 'Zoom',
  team: 'Notizen',
  anmerken: 'Anmerken',
};

/**
 * **Kopfkarte des Liedblatts: breit oder kompakt?** (Scheibe B1, Entscheidung Alwin 28.10.2026)
 *
 * - **breit** (iPad quer UND hochkant, Rechner): Titelzeile mit Zurück, Termin und Vollbild; darunter Lied-Leiste
 *   und Knöpfe in EINER Zeile – die Leiste scrollt, wenn wenig Platz bleibt.
 * - **kompakt** (Handy hochkant): keine Titelzeile, Zurück und Vollbild nur als Symbol neben der Leiste, die Knöpfe
 *   im Raster mit Kurzwort darunter. Spart am iPhone rund 40 px Blatt (Messung B0).
 * - **flach** (niedriges Fenster, Handy quer): alles in EINER Zeile – Zurück, Leiste, Knöpfe nur als Symbol, Vollbild.
 *   Eine zweite Zeile kostete dort fast die Hälfte des Blatts (bei 390 px Höhe blieben ~150 px statt ~250 px).
 *
 * Gemessen an der echten Kopfbreite und Fensterhöhe, nicht am Gerätenamen – im kleinen Stage-Manager-Fenster am iPad
 * wie am iPhone. Die Höhe geht vor. Ohne Messung (0, jsdom) bleibt es breit.
 */
export const KOMPAKT_UNTER_BREITE = 700;
export const KOMPAKT_UNTER_HOEHE = 500;

export type KopfAufbau = 'breit' | 'kompakt' | 'flach';

export function kopfAufbau(m: { breite: number; hoehe: number }): KopfAufbau {
  if (m.breite <= 0) return 'breit';
  if (m.hoehe > 0 && m.hoehe < KOMPAKT_UNTER_HOEHE) return 'flach';
  return m.breite < KOMPAKT_UNTER_BREITE ? 'kompakt' : 'breit';
}

/**
 * **Was ein Tipp auf ein Lied in der Leiste tut** (Scheibe B2): das gewählte → sein Lied-Menü (beim Ansehen fremder
 * Notizen nichts – das Menü ist dann gesperrt, wie vorher an der Titel-Kapsel); ein anderes, das gerade zu sehen ist
 * (Querformat, zweite Hälfte) → wählen, ohne dass das Blatt springt; eines, das nicht zu sehen ist → hinspringen.
 */
export function leistenTipp(
  idx: number,
  b: { gewaehlt: number; sichtbar: ReadonlySet<number>; ansehen: boolean },
): 'menue' | 'waehlen' | 'springen' | 'nichts' {
  if (idx === b.gewaehlt) return b.ansehen ? 'nichts' : 'menue';
  return b.sichtbar.has(idx) ? 'waehlen' : 'springen';
}
