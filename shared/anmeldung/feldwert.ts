/**
 * **Ein Gruppenfeld-Wert, wie ChurchTools ihn liefert** (F5c, gemessen 17.11.2026, `messung-f5c-2026-11-17.md`) – die
 * EINE Stelle, die Rohwerte liest und vergleicht: Liste (`liste.ts`), Übergabe und „Rückgängig“ (`bewegung.ts`),
 * Nachprüfen nach dem Schreiben (`felderSchreiben`), Antworten zählen (`antwortenZaehlen`).
 *
 * - Text bleibt Text, eine Zahl wird Text, Ankreuzen kommt als `'1'`/`'0'`.
 * - **Mehrfachauswahl (`multiselect`)** kommt als Liste der Options-Nummern (`["235","241"]`), geleert als `[]`.
 *   Im Verlauf steht sie dagegen als lesbarer Text („Küche, Sonstiges“).
 */

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
