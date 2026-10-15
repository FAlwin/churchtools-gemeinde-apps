/**
 * **Hell oder dunkel – wie ChurchTools** (Alwin, 14.10.2026: „so einen Dunkelmodus wie die ChurchTools-App“).
 *
 * Gemessen in der Test-Instanz (14.10.2026): ChurchTools merkt sich die Wahl im `localStorage` (`theme`) und
 * zeigt sie als Klasse an `<body>` – `light` oder `dark`. Das ist unabhängig vom Gerät: Ein Mac im
 * Dunkelmodus mit ChurchTools auf „hell“ hat `body.light`. Maßgeblich ist deshalb die **Klasse**, nicht
 * `prefers-color-scheme`.
 *
 * Diese Funktion meldet die App für das dunkle Farbschema von ChurchTools an (`data-dunkel='churchtools'`,
 * Farben in `_variables.scss`) und setzt `data-theme` auf `<html>` passend zur Klasse – und zieht mit,
 * wenn ChurchTools sie ändert. Läuft die App außerhalb von ChurchTools (Entwickeln mit `?demo`), hat
 * `<body>` keine der Klassen; dann gilt die Einstellung des Geräts.
 *
 * Wie eine weitere App (z. B. die Musik-App) umsteigt: `docs/entwicklung/dunkelmodus.md`.
 */

export type Thema = 'light' | 'dark';

/** Das Thema, das ChurchTools an `<body>` zeigt – `null` außerhalb von ChurchTools. */
export function churchToolsThema(body: HTMLElement = document.body): Thema | null {
  if (body.classList.contains('dark')) return 'dark';
  if (body.classList.contains('light')) return 'light';
  return null;
}

const GERAET_DUNKEL = '(prefers-color-scheme: dark)';

/**
 * Hell/dunkel ab jetzt wie ChurchTools. Gibt eine Funktion zurück, die das Mitziehen beendet (Tests).
 */
export function folgeChurchToolsThema(): () => void {
  const html = document.documentElement;
  html.dataset.dunkel = 'churchtools';
  const geraet = typeof window.matchMedia === 'function' ? window.matchMedia(GERAET_DUNKEL) : null;

  const anwenden = () => {
    html.dataset.theme = churchToolsThema() ?? (geraet?.matches ? 'dark' : 'light');
  };
  anwenden();

  const beobachter = new MutationObserver(anwenden);
  beobachter.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  geraet?.addEventListener('change', anwenden);
  return () => {
    beobachter.disconnect();
    geraet?.removeEventListener('change', anwenden);
  };
}
