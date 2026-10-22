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
