/**
 * **Spam-Schutz des öffentlichen Formulars** (A6-3, #593) – unsichtbar (Alwin, 16.10.2026: „nur unsichtbar“).
 *
 * Gemessen 16.10.2026: ChurchTools hat beim öffentlichen Anmelden keinen eigenen Schutz (kein Captcha in
 * `/publicgroups/{id}/form`). Ein Captcha ohne eigenen Server ließe sich nicht prüfen – ein Bot schickt dann direkt an
 * ChurchTools. Dieser Schutz hält deshalb die üblichen Formular-Bots auf, die unsere Seite ausfüllen:
 *
 * - **Honigtopf:** ein Feld, das Menschen nie sehen. Ist es gefüllt, wird nichts geschickt – aber mit einer
 *   **sichtbaren** Meldung, nicht still: Füllt ein Browser es doch einmal automatisch, merkt der Mensch es und kann
 *   neu laden, statt zu glauben, er sei angemeldet.
 * - **Mindest-Ausfüllzeit:** Wer schneller als `MIN_AUSFUELLZEIT_MS` nach dem Laden abschickt, wird gebeten, kurz zu
 *   prüfen. Beim zweiten Tippen ist die Zeit um – Menschen kommen immer durch.
 */

/** So schnell füllt kein Mensch ein Formular aus. */
export const MIN_AUSFUELLZEIT_MS = 3000;

/** Name des Honigtopf-Felds – ungewöhnlich, damit kein Browser ihn automatisch füllt. */
export const HONIGTOPF_NAME = 'af-zusatz-hinweis';

export type SpamGrund = 'honigtopf' | 'zuSchnell';

/** Was Menschen in diesem Fall lesen. */
export const SPAM_TEXT: Record<SpamGrund, string> = {
  honigtopf:
    'Die Anmeldung konnte nicht geschickt werden. Bitte die Seite neu laden und noch einmal versuchen.',
  zuSchnell:
    'Bitte die Angaben kurz prüfen und dann noch einmal auf „Verbindlich anmelden“ tippen.',
};

/** **Sieht das Abschicken nach einem Bot aus?** `null` = in Ordnung, schicken. */
export function spamGrund(a: { honigtopf: string; seitDemLadenMs: number }): SpamGrund | null {
  if (a.honigtopf.trim()) return 'honigtopf';
  if (a.seitDemLadenMs < MIN_AUSFUELLZEIT_MS) return 'zuSchnell';
  return null;
}
