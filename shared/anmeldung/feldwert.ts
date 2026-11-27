/**
 * **Ein Gruppenfeld-Wert, wie ChurchTools ihn liefert** (F5c, gemessen 17.11.2026, `messung-f5c-2026-11-17.md`) – die
 * EINE Stelle, die Rohwerte liest und vergleicht: Liste (`liste.ts`), Übergabe und „Rückgängig“ (`bewegung.ts`),
 * Nachprüfen nach dem Schreiben (`felderSchreiben`), Antworten zählen (`antwortenZaehlen`).
 *
 * - Text bleibt Text, eine Zahl wird Text, Ankreuzen kommt als `'1'`/`'0'`.
 * - **Mehrfachauswahl (`multiselect`)** kommt als Liste der Options-Nummern (`["235","241"]`), geleert als `[]`.
 *   Im Verlauf steht sie dagegen als lesbarer Text („Küche, Sonstiges“).
 */

/**
 * **Höchstlänge eines Gruppenfelds in ChurchTools: 4.000 Zeichen** (Zeichen, nicht Bytes), fest – eine höhere `maxLength`
 * nimmt ChurchTools an und ignoriert sie (A6-2b, `messung-a6-2026-10-14.md`). Schreibt die Leitung mehr, lehnt ChurchTools
 * mit 400 ab; **beim öffentlichen Anmelden ohne Login schneidet es still ab** (Antwort 200, gespeichert die ersten 4.000 –
 * M9, `messung-m9-2026-11-27.md`). Wer ohne Login schreibt, muss die Länge also selbst prüfen. Die EINE Stelle für diese
 * Zahl (Unterschrift, Liste mit Zeilen).
 */
export const GRUPPENFELD_MAX = 4000;

/** Eine Zahl lesbar: deutsch, höchstens zwei Nachkommastellen („1.234,5“) – Tabelle, Summen, Liste mit Zeilen. */
export function zahlText(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Ein Wert zum Schreiben oder Vergleichen: Text, Liste von Options-Nummern, Kästchen, leer. */
export type CtFeldwert = string | string[] | boolean | null;

/** **Den Rohwert lesen** – Text, Liste (Mehrfachauswahl) oder `null`. */
export function rohWert(v: unknown): string | string[] | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v))
    return v.filter((x) => typeof x === 'string' || typeof x === 'number').map((x) => String(x));
  return null;
}

/** Leer: nichts, kein Text oder eine leere Liste. */
export function istLeer(w: string | string[] | null): boolean {
  return w === null || (Array.isArray(w) ? w.length === 0 : w.trim() === '');
}

/** **Steht da, was geschrieben wurde?** Leer gleicht leer (auch `[]`), Listen ohne Rücksicht auf die Reihenfolge. */
export function wertGleich(soll: CtFeldwert, ist: unknown): boolean {
  const da = rohWert(ist);
  if (typeof soll === 'boolean') return (da === '1' || ist === true) === soll;
  if (soll === null || (Array.isArray(soll) && soll.length === 0)) return istLeer(da);
  if (Array.isArray(soll))
    return Array.isArray(da) && da.length === soll.length && soll.every((x) => da.includes(x));
  return typeof da === 'string' && da === soll;
}
