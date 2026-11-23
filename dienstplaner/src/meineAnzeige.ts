/**
 * **„Meine Anzeige“ – was ich vom Live-Rückblick und vom Schnitt sehen will** (Live-Ansicht 2, A8/A15). Je Person, auf allen
 * Geräten; das Ein- und Ausschalten kommt mit L4-5 („Einstellungen → Meine Anzeige“, Ort: Personen-Datei, T7). Bis dahin
 * liefert `useMeineAnzeige` den Standard – **alles an** (A15). Rückblick und „Ø beim Ablauf bearbeiten“ lesen nur diese Werte;
 * L4-5 muss nur `useMeineAnzeige` füttern.
 */
export interface MeineAnzeige {
  /** Die Karte „Rückblick“ im Termin zeigen. */
  rueckblick: boolean;
  /** Das leise „Ø m:ss“ unter der Dauer beim Ablauf bearbeiten (A8). */
  schnittBeimPlanen: boolean;
  /** Im Rückblick die Spalte „Ø bisher“. */
  spalteSchnitt: boolean;
  /** Im Rückblick die Spalte „±“. */
  spalteAbweichung: boolean;
}

export const STANDARD_ANZEIGE: MeineAnzeige = {
  rueckblick: true,
  schnittBeimPlanen: true,
  spalteSchnitt: true,
  spalteAbweichung: true,
};

/** Die Anzeige-Wünsche dieser Person. L4-5 ersetzt den Standard durch die gespeicherten Werte. */
export function useMeineAnzeige(): MeineAnzeige {
  return STANDARD_ANZEIGE;
}
