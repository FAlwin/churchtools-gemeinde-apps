/** Ab wie vielen Zeichen ein Gastname gilt – eine Regel für „Wer kann?“ und die Gäste-Zeile in „Personen“ (P2d). */
export const GAST_MIN_ZEICHEN = 2;

/** Der Name, wie er eingetragen wird (ohne Leerzeichen am Rand) – `null`, wo er noch nicht reicht. */
export const gastNameAus = (eingabe: string): string | null => {
  const n = eingabe.trim();
  return n.length >= GAST_MIN_ZEICHEN ? n : null;
};

/** Der Satz unter dem Feld – derselbe in „Wer kann?“ und im Fenster „Gast eintragen“. */
export const GAST_HINWEIS =
  'Zum Beispiel ein Gastprediger. Er bekommt keine Anfrage, sein Name steht im Plan.';
