/**
 * Die Wahl des Knopfs „Spalten“ (E6-4, `InfoSpalten.tsx`) – getrennt von der Komponente, damit jene Datei nur Komponenten
 * exportiert (wie `ablaufZiehen.ts`). Gemerkt über den gemeinsamen Gerätespeicher (`ui/bedienung/geraet.ts`).
 */
import { useCallback, useState } from 'react';
import type { InfoGruppe } from '@shared/types/index';
import { leseImGeraet, merkeImGeraet, zahlen } from '../bedienung/geraet';

/**
 * Die gewählten Gruppen – gemerkt unter `schluessel` (je App einer). Gruppen, die man nicht (mehr) sieht, fallen beim
 * Zeigen weg; die Reihenfolge ist die der Gemeinde, nicht die des Anhakens.
 */
export function useInfoSpalten(schluessel: string, gruppen: readonly InfoGruppe[] | undefined) {
  const [ids, setIdsRoh] = useState<number[]>(() => leseImGeraet(schluessel, [], zahlen));
  const setIds = useCallback(
    (neu: number[]) => {
      setIdsRoh(neu);
      merkeImGeraet(schluessel, neu);
    },
    [schluessel],
  );
  const gewaehlt = (gruppen ?? []).filter((g) => ids.includes(g.id));
  return { ids, setIds, gewaehlt };
}
