/**
 * Die Werkzeuge des Liedblatts (Aussehen, Tempo, Zoom, Notizen von …, Anmerken) – Name und Regel an
 * EINER Stelle. Eigene Datei, weil `ChartHeader` als Komponenten-Datei nichts anderes exportieren soll
 * (Vites Fast Refresh, Lint-Regel `react-refresh/only-export-components`).
 */

/** Die Werkzeuge des Liedblatts. */
export type WerkzeugId = 'aussehen' | 'tempo' | 'zoom' | 'team' | 'anmerken' | 'vollbild';

export const WERKZEUG_NAME: Record<WerkzeugId, string> = {
  aussehen: 'Aussehen',
  tempo: 'Tempo',
  zoom: 'Zoom zurücksetzen',
  team: 'Notizen von …',
  anmerken: 'Anmerken',
  vollbild: 'Vollbild',
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
  /**
   * Vollbild der ganzen App – nur in der Erweiterung (`funktionen.vollbildKnopf`). Steht IMMER, auch
   * beim Dokument und beim Ansehen fremder Notizen: Es gilt für die App, nicht für das Lied.
   */
  vollbild?: boolean;
}): WerkzeugId[] {
  const ids: WerkzeugId[] = [];
  if (!b.zeigtDokument && !b.ansehen) ids.push('aussehen');
  // Tempo bewusst auch ohne gepflegtes Tempo (#145): Genau dann will man eins antippen.
  if (!b.ansehen) ids.push('tempo');
  if (b.gezoomt) ids.push('zoom');
  if (b.teamNotizen && !b.zeigtDokument) ids.push('team');
  if (!b.ansehen) ids.push('anmerken');
  if (b.vollbild) ids.push('vollbild');
  return ids;
}

/**
 * So schmal darf die Titel-Kapsel werden, bevor die Werkzeuge hinter EINEN Knopf wandern (Alwin,
 * 05.10.2026: feste Größe, aber nach der echten Fensterbreite – im kleinen Stage-Manager-Fenster am
 * iPad wie am iPhone). Rund zwanzig Zeichen Titel plus Tonart-Zeile.
 */
export const KAPSEL_MIN = 220;

/**
 * **Stehen die Werkzeuge im Hochformat einzeln oben – oder hinter dem Werkzeuge-Knopf?**
 *
 * Gerechnet wird mit dem, was die Titel-Kapsel übrig behält: Kopfbreite minus Zurück-Knopf minus die
 * einzelnen Werkzeug-Knöpfe, jeweils mit Abstand. Reicht der Rest für `KAPSEL_MIN`, stehen sie einzeln.
 * Mit der echten Anzahl: Kommt beim Zoomen „Zoom zurücksetzen" dazu und wird es dadurch zu eng, wandert
 * alles hinter den Knopf – zurück auf die Breite des Kopfs wirkt das nicht, es kann also nicht pendeln.
 */
export function werkzeugeEinzeln(m: {
  /** Innenbreite des Kopfs (ohne Rand-Abstand). */
  kopfBreite: number;
  /** Durchmesser eines runden Knopfs. */
  knopf: number;
  /** Abstand zwischen den Elementen des Kopfs. */
  abstand: number;
  /** Wie viele Werkzeuge gerade einzeln stünden. */
  anzahl: number;
}): boolean {
  const kapsel = m.kopfBreite - m.knopf - m.abstand - m.anzahl * (m.knopf + m.abstand);
  return kapsel >= KAPSEL_MIN;
}
