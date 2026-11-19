/**
 * **HTML-Escape für die Website** (W1). Zwei getrennte Wege, weil Text und Attribute verschiedene Zeichen
 * gefährden: Im Text genügt `& < >`, im Attribut kommen die beiden Anführungszeichen dazu (sonst bricht
 * `" onerror=…` aus dem Wert aus).
 *
 * Bewusst eigene Datei: `htmlSicher` (`shared/anmeldung/rundmail.ts`, ohne `'`) und `htmlText`
 * (`shared/dienstplan/erinnern.ts`) gibt es zwar, hängen aber in fremden Modulen – der Bau-Dienst soll nicht den
 * halben Dienstplaner mitladen, und jede Website-Ausgabe braucht beide Wege.
 */

const TEXT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const ATTRIBUT: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text so, dass HTML ihn wörtlich zeigt – für alles zwischen zwei Tags. */
export function htmlText(text: string): string {
  return text.replace(/[&<>]/g, (z) => TEXT[z]);
}

/** Wert eines Attributs (immer in doppelten Anführungszeichen setzen, aber auch für einfache sicher). */
export function htmlAttr(wert: string): string {
  return wert.replace(/[&<>"']/g, (z) => ATTRIBUT[z]);
}
