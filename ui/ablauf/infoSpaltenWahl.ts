/**
 * Die Wahl des Knopfs „Spalten“ (E6-4, `InfoSpalten.tsx`) – getrennt von der Komponente, damit jene Datei nur Komponenten
 * exportiert (wie `ablaufZiehen.ts`).
 */
import { useCallback, useState } from 'react';
import type { InfoGruppe } from '@shared/types/index';

function lies(schluessel: string): number[] {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(schluessel) ?? '[]');
    return Array.isArray(roh) ? roh.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

/**
 * Die gewählten Gruppen – gemerkt unter `schluessel` (je App einer). Gruppen, die man nicht (mehr) sieht, fallen beim
 * Zeigen weg; die Reihenfolge ist die der Gemeinde, nicht die des Anhakens.
 */
export function useInfoSpalten(schluessel: string, gruppen: readonly InfoGruppe[] | undefined) {
  const [ids, setIdsRoh] = useState<number[]>(() => lies(schluessel));
  const setIds = useCallback(
    (neu: number[]) => {
      setIdsRoh(neu);
      try {
        localStorage.setItem(schluessel, JSON.stringify(neu));
      } catch {
        // Privater Modus o. Ä.: Dann gilt die Wahl nur bis zum Neuladen.
      }
    },
    [schluessel],
  );
  const gewaehlt = (gruppen ?? []).filter((g) => ids.includes(g.id));
  return { ids, setIds, gewaehlt };
}
