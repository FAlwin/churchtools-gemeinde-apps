/**
 * **Lato mitbringen – nur außerhalb von ChurchTools** (#654). Alle Apps schreiben in Lato wie die
 * ChurchTools-Weboberfläche (`--ui` in `_variables.scss`). In ChurchTools ist die Schrift schon geladen; eine
 * zweite `@font-face` „Lato“ aus der Erweiterung träfe ChurchTools selbst – deshalb laden sie nur die Musik-App
 * als PWA und das öffentliche Formular. Normal und fett, Latein samt Erweiterung (Namen mit ł, č …); der
 * Service Worker der PWA hält die Dateien offline vor (`globPatterns` mit `woff2`).
 */
export function latoMitbringen(): Promise<unknown> {
  return Promise.all([import('@fontsource/lato/400.css'), import('@fontsource/lato/700.css')]);
}

/**
 * **Schriften nie ins CSS einbetten** – für `build.assetsInlineLimit` jeder App, die `latoMitbringen` nutzt.
 * Vite bettet Dateien unter 4 KB als `data:` ein; das traf die `lato-latin-ext-*.woff` (3,8 KB). Die CSP der
 * Musik-App erlaubt Schriften nur von `'self'` → zwei Konsolenfehler bei jedem Start (gemessen 05.11.2026, auch
 * live). Sichtbar war nichts, weil der Browser die woff2 nimmt – aber ein Fehler, der immer leuchtet, verdeckt
 * den echten. Lieber eigene Dateien als die CSP um `data:` aufweichen.
 */
export function schriftNichtEinbetten(datei: string): false | undefined {
  return /\.(woff2?|ttf|otf|eot)$/i.test(datei) ? false : undefined;
}
