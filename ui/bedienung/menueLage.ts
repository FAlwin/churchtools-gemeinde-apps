/**
 * **Wo ein aufgeklapptes Menü steht und wohin seine Liste scrollt** – reine Rechnungen, entstanden an „Anfangen bei“
 * im Organigramm (#915). Hier in `ui/`, damit ein weiteres Menü mit langer Liste sie nicht ein zweites Mal baut.
 */

/** So viel Abstand hält das Menü zum Rand des Bildschirms (px) – wie der Seitenrand am Handy. */
const RAND = 16;

/**
 * Wie weit das Menü nach links rücken muss, damit es rechts nicht über den Bildschirm ragt – höchstens so weit, dass
 * es links noch `RAND` Abstand hat. Am Handy steht der Knopf mitten in der Leiste; das 320 px breite Menü ragte rechts
 * hinaus, und ChurchTools schob dafür die ganze Seite zur Seite (Test-Instanz 11.11.2026, 375 px breit).
 */
export function menueVersatz(links: number, breite: number, fensterBreite: number): number {
  const ueber = links + breite - (fensterBreite - RAND);
  if (ueber <= 0) return 0;
  return -Math.min(ueber, Math.max(0, links - RAND));
}

/**
 * Wohin die Liste scrollen muss, damit eine Zeile ganz zu sehen ist – sonst bleibt sie, wo sie ist. Bewusst von Hand
 * statt `scrollIntoView`: Das scrollt auch alle Behälter darüber, und in ChurchTools rückte so die ganze Seite um 49 px
 * zur Seite (Test-Instanz 11.11.2026).
 */
export function listenScroll(
  scrollTop: number,
  hoehe: number,
  zeileOben: number,
  zeileHoehe: number,
): number {
  if (zeileOben < scrollTop) return zeileOben;
  if (zeileOben + zeileHoehe > scrollTop + hoehe) return zeileOben + zeileHoehe - hoehe;
  return scrollTop;
}
