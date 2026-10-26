import { screen, within } from '@testing-library/react';

/**
 * **Die Knöpfe in ihrer Reihenfolge** – für die Tests „im ChurchTools-Aufbau“ (E6-O): vorn „Fenster schließen“ (das X
 * im Kopf), hinten die Fußzeile mit dem Hauptknopf zuletzt. EINE Stelle für alle Apps; bis F4 stand die Zeile in 19
 * Testdateien als Kopie. Ohne `wo` zählen alle Knöpfe auf dem Bildschirm.
 */
export const knopfFolge = (wo?: HTMLElement) =>
  (wo ? within(wo) : screen)
    .getAllByRole('button')
    .map((b) => (b.getAttribute('aria-label') ?? b.textContent)?.trim());

/** Nur die Knöpfe des offenen Fensters – für Fenster über einer Seite mit eigenen Knöpfen (E6-O F4). */
export const fensterKnoepfe = () => knopfFolge(screen.getByRole('dialog'));
