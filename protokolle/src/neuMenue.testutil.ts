import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

/**
 * **Der grüne Knopf „Neu ⌄“ der Sitzungen in Tests** (B6, R3/E14): „Neues Protokoll“, „Neue Sitzung“, „Punkt vorschlagen“
 * und „Protokoll nachtragen“ sind seitdem Einträge in seinem Menü – früher vier Knöpfe in der Kopfzeile von „Kommend“.
 */

/** Das Menü öffnen, falls es nicht schon offen ist (der Knopf schaltet um); wartet auf den Knopf. */
export async function neuOeffnen() {
  if (!screen.queryByRole('menu', { name: 'Neu' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Neu' }));
  return within(await screen.findByRole('menu', { name: 'Neu' }));
}

/** Einen Eintrag des Menüs wählen – das Menü ist danach zu, die Aktion läuft. */
export async function neuWaehlen(name: string) {
  fireEvent.click((await neuOeffnen()).getByRole('menuitem', { name }));
  await waitFor(() => expect(screen.queryByRole('menu', { name: 'Neu' })).toBeNull());
}

/** Was „Neu ⌄“ anbietet – leer, wenn es den Knopf gar nicht gibt. Das Menü bleibt danach zu. */
export async function neuAngebot(): Promise<string[]> {
  const knopf = screen.queryByRole('button', { name: 'Neu' });
  if (!knopf) return [];
  fireEvent.click(knopf);
  const namen = within(await screen.findByRole('menu', { name: 'Neu' }))
    .getAllByRole('menuitem')
    .map((x) => x.textContent ?? '');
  fireEvent.click(knopf);
  return namen;
}
