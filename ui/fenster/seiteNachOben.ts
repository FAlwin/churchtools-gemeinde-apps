/**
 * **Holt einen verschobenen Dokument-Scroll SOFORT zurück** – iOS schiebt beim Tippen die Seite hoch (#207), und wir
 * drehen das zurück. EINE Stelle für alle Erweiterungen.
 *
 * Nie mehr ein schlichtes `scrollTo` auf 0/0: ChurchTools setzt auf `html` `scroll-behavior: smooth` (live gemessen 18.11.2026).
 * Dort wurde das Zurückholen zur Animation, die bei jedem `visualViewport`-Ereignis neu begann – die Seite kroch über
 * ~4 s ruckelnd nach unten, und weil währenddessen laufend Ereignisse kamen, passte sich das Fenster erst danach an
 * (Alwin am iPhone, „Punkt vorschlagen“, v1.0.8). `behavior: 'instant'` schlägt die CSS-Einstellung.
 * `quelltexteSeiteNachOben.test.ts` wacht darüber, dass das schlichte nicht zurückkommt.
 */
export function seiteNachOben(): void {
  // Doppelt genäht: Ein Safari, der `instant` nicht kennt, nähme sonst `auto` – und damit wieder das weiche Scrollen
  // aus dem CSS. Die Einstellung gilt im Moment des Aufrufs, darum danach sofort zurück.
  const html = document.documentElement;
  const vorher = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  html.style.scrollBehavior = vorher;
}
