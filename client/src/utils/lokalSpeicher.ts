/**
 * In den Gerätespeicher (`localStorage`) schreiben – **ohne dass ein voller Speicher etwas anderes
 * verhindert** (#251, #457).
 *
 * `localStorage.setItem` wirft, wenn das Gerät voll ist (viele bemalte Seiten offline). Stand der
 * Aufruf ungeschützt VOR dem Hochladen aufs Konto, fiel das Hochladen gleich mit aus – die Anmerkung
 * oder Einstellung war dann nur noch im Speicher der Seite, und ein Fehler lief bis zum
 * Fehlerbildschirm. Die Lehre stand bis v2.32.0 nur in `usePageDraw.saveStrokes`; zwei Zeilen darüber
 * und an zehn weiteren Stellen fehlte sie. Deshalb gibt es genau EINE Stelle, die schreibt:
 *
 * - **wirft nie** – gibt nur zurück, ob es geklappt hat;
 * - **meldet einmal je Sitzung**, dass der Speicher voll ist (nicht bei jedem Strich).
 */
export const SPEICHER_VOLL_MELDUNG =
  'Der Speicher dieses Geräts ist voll. Was zu deinem Konto gehört, wird weiter dort gesichert – offline steht es aber nicht bereit.';

let melder: ((meldung: string) => void) | null = null;
let gemeldet = false;

/** Wer den Hinweis anzeigt (die App setzt hier ihren Toast). */
export function setSpeicherVollMelder(fn: ((meldung: string) => void) | null): void {
  melder = fn;
}

/** Schreibt `wert` unter `key`, `null` löscht. `false` heißt: Der Gerätespeicher hat es nicht genommen. */
export function lokalSchreiben(key: string, wert: string | null): boolean {
  try {
    if (wert === null) localStorage.removeItem(key);
    else localStorage.setItem(key, wert);
    return true;
  } catch {
    if (!gemeldet && melder) {
      gemeldet = true;
      melder(SPEICHER_VOLL_MELDUNG);
    }
    return false;
  }
}

/** Nur für Tests: den „schon gemeldet"-Merker zurücksetzen. */
export function __resetLokalSpeicherForTests(): void {
  gemeldet = false;
  melder = null;
}

/**
 * Einen gespeicherten JSON-Wert lesen – `null` bei fehlendem oder kaputtem Inhalt (#463: stand als
 * `safeParse`/`safeJson` zweimal wortgleich da). Ungeprüft: Wer eine bestimmte Form braucht, prüft sie.
 */
export function jsonOderNull<T>(roh: string | null): T | null {
  if (!roh) return null;
  try {
    return JSON.parse(roh) as T;
  } catch {
    return null;
  }
}
