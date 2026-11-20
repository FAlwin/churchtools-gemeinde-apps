import { fireEvent, screen, within } from '@testing-library/react';

/**
 * Das „⋯“-Menü von Planen (B3) für die Tests: öffnen (am Rechner ein Menü, am Handy das Blatt „Mehr“) und einen Eintrag
 * antippen. Wer „Erinnern“, „Teilen“, „Vorlagen“, „Ablauf bearbeiten“ oder „Hilfe“ braucht, geht seit B3 hier entlang.
 */
export function oeffneMehr(): HTMLElement {
  const offen =
    screen.queryByRole('menu', { name: 'Mehr' }) ?? screen.queryByRole('dialog', { name: 'Mehr' });
  if (offen) return offen;
  fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
  return (
    screen.queryByRole('menu', { name: 'Mehr' }) ?? screen.getByRole('dialog', { name: 'Mehr' })
  );
}

/** Der Eintrag im „⋯“-Menü – `null`, wenn es ihn nicht gibt (und auch, wenn es gar kein Menü gibt). Lässt das Menü offen. */
export function mehrEintragOder(name: string | RegExp): HTMLElement | null {
  if (
    !screen.queryByRole('button', { name: 'Mehr' }) &&
    !screen.queryByRole('menu', { name: 'Mehr' })
  )
    return null;
  const menue = oeffneMehr();
  const rolle = menue.getAttribute('role') === 'menu' ? 'menuitem' : 'button';
  return within(menue).queryByRole(rolle, { name });
}

/** Einen Eintrag im „⋯“-Menü antippen (das Menü geht dabei zu, dann läuft die Aktion). */
export function mehrEintrag(name: string | RegExp): void {
  const eintrag = mehrEintragOder(name);
  if (!eintrag) throw new Error(`Im „⋯“-Menü gibt es keinen Eintrag ${String(name)}.`);
  fireEvent.click(eintrag);
}

/**
 * „＋ früherer / späterer Termin“ liegen seit B3 im Fenster des Zeitraum-Knopfs: Fenster öffnen (falls zu), Knopf antippen.
 * Das Fenster bleibt danach offen – man holt mehrere hintereinander.
 */
export function zeitraumDazu(
  name: 'Früheren Termin dazunehmen' | 'Späteren Termin dazunehmen',
): void {
  if (!screen.queryByRole('dialog', { name: 'Zeitraum wählen' }))
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
  fireEvent.click(
    within(screen.getByRole('dialog', { name: 'Zeitraum wählen' })).getByRole('button', { name }),
  );
}

/** Das Filter-Fenster von Planen (falls zu) öffnen und zurückgeben. */
export function oeffneFilter(): HTMLElement {
  const offen = screen.queryByRole('dialog', { name: 'Filter' });
  if (offen) return offen;
  fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
  return screen.getByRole('dialog', { name: 'Filter' });
}

/** „Breite Spalten“ im Filter-Fenster unter „Anzeige“ – seit B3 ein Häkchen statt des Umschalters in der Zeile. */
export function breiteSpaltenUmschalten(): void {
  fireEvent.click(within(oeffneFilter()).getByRole('checkbox', { name: 'Breite Spalten' }));
}
