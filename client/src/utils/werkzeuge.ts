/**
 * Die Werkzeuge des Liedblatts (Aussehen, Tempo, Zoom, Notizen von …, Anmerken) – Name und Regel an
 * EINER Stelle. Eigene Datei, weil `ChartHeader` als Komponenten-Datei nichts anderes exportieren soll
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
 * **Welche Werkzeuge es gibt – EINE Regel** für das Werkzeuge-Menü (Hochformat) und die einzelnen
 * Knöpfe je Lied (Querformat, Alwin 03.10.2026). Die Bedingungen sind die der früheren Einzelknöpfe:
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
