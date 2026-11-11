import { fireEvent, screen, within } from '@testing-library/react';

/** Wo gesucht wird – der ganze Bildschirm oder z. B. nur das PDF-Fenster. */
type Wo = Pick<typeof screen, 'getByRole'>;

/** Der Knopf von „Anfangen bei“ bzw. „Ausschnitt“ – sein Name nennt die Wahl („Anfangen bei: Technik“). */
export const spitzenKnopf = (label: string, wo: Wo = screen) =>
  wo.getByRole('button', { name: new RegExp(`^${label}: `) });

/** Der gewählte Pfad (`''` = ganze Gemeinde). */
export const spitzenWert = (label: string, wo: Wo = screen) =>
  spitzenKnopf(label, wo).getAttribute('data-wert');

/** Der Name der Wahl, wie er auf dem Knopf steht. */
export const spitzenName = (label: string, wo: Wo = screen) => spitzenKnopf(label, wo).textContent;

/** Aufklappen, die Namen in der Liste lesen, wieder zuklappen. */
export function spitzenOptionen(label: string, wo: Wo = screen): string[] {
  fireEvent.click(spitzenKnopf(label, wo));
  const namen = within(screen.getByRole('listbox', { name: label }))
    .getAllByRole('option')
    .map((o) => o.textContent ?? '');
  fireEvent.click(spitzenKnopf(label, wo));
  return namen;
}

/** Aufklappen und eine Gruppe (oder „Ganze Gemeinde“) anklicken. */
export function waehleSpitze(label: string, name: string, wo: Wo = screen): void {
  fireEvent.click(spitzenKnopf(label, wo));
  fireEvent.click(
    within(screen.getByRole('listbox', { name: label })).getByRole('option', { name }),
  );
}
