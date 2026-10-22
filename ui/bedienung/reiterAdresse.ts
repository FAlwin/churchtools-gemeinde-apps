import type { Reiter } from './ReiterLeiste';

/**
 * **Der Reiter steht in der Adresse** (`#/termine`), damit Neuladen und der Zurück-Knopf funktionieren – für alle
 * Erweiterungen (vorher nur im Dienstplaner, E3; die Protokolle brauchen dasselbe für „Verwaltung“, S2-2).
 * Unbekannt oder nicht erlaubt → `start`.
 */
export function reiterAusAdresse<T extends string>(
  hash: string,
  erlaubt: readonly Reiter<T>[],
  start: T,
): T {
  const id = /^#\/([a-z]+)$/.exec(hash)?.[1];
  return erlaubt.find((r) => r.id === id)?.id ?? start;
}

/** Die Adresse eines Reiters – der Start-Reiter hat keine (leere Adresse). */
export function adresseFuer<T extends string>(id: T, start: T): string {
  return id === start ? '' : `#/${id}`;
}
