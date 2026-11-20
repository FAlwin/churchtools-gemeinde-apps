import { fireEvent, screen, within } from '@testing-library/react';

/**
 * **Das Filter-Fenster der To-Dos in Tests** (B6, „Ruhige Bedienung“): „Spalten nach“ und „Reihenfolge“ – früher die Knöpfe
 * „Gruppieren“ und „Sortieren“ in der Kopfzeile – und der Kurzweg „Nur meine“ liegen seitdem im Filter. Eine Stelle für
 * alle To-Do-Tests, damit sich die Wege nicht in jeder Datei anders entwickeln.
 */
const filterKnopf = () => screen.getByRole('button', { name: /^Filter/ });

/** Das offene Filter-Fenster. */
export const imFilter = () => within(screen.getByRole('dialog', { name: 'Filter' }));

/** Das Filter-Fenster öffnen, falls es nicht schon offen ist (der Knopf schaltet um) – und hineinsehen. */
export function offenesFilter() {
  if (!screen.queryByRole('dialog', { name: 'Filter' })) fireEvent.click(filterKnopf());
  return imFilter();
}

/** „Spalten nach“ bzw. „Gruppieren nach“ im Filter: Status · Fälligkeit · Person. */
export const gruppiereNach = (name: 'Status' | 'Fälligkeit' | 'Person') =>
  fireEvent.click(offenesFilter().getByRole('radio', { name }));

/** „Reihenfolge“ im Filter: Dringlichkeit · Bis-Datum · Alphabetisch · Manuell. */
export const ordneNach = (name: 'Dringlichkeit' | 'Bis-Datum' | 'Alphabetisch' | 'Manuell') =>
  fireEvent.click(offenesFilter().getByRole('radio', { name }));

/** Die Kurzwege unter „Zuständig“: „Alle“ räumt den Filter, „Nur meine“ blendet Andere und „Noch niemand“ aus. */
export const zustaendigKurz = (name: 'Alle' | 'Nur meine') =>
  fireEvent.click(offenesFilter().getByRole('button', { name }));
