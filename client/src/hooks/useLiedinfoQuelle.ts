import { useMemo } from 'react';
import { useArrangements, useSongStammdaten } from './useServices';
import type { LiedinfoQuelle } from '../utils/liedinfoFormular';

/**
 * **Die Liedinfo für den Editor laden** (Lied-Editor L4): Lied-Stammdaten und das Arrangement, dessen Notenblatt
 * bearbeitet wird. EIN Baustein für alle Stellen, die den Editor öffnen (Liedblatt, Stammdaten-Blatt, Neues Lied).
 * `songId = null` lädt nichts – so lädt eine Seite erst, wenn der Editor wirklich offen ist.
 *
 * Solange etwas fehlt (lädt noch, Fehler, Arrangement nicht gefunden), kommt `undefined`: Der Editor zeigt dann keine
 * Liedinfo und lässt die Kopfzeilen im Text – nichts geht verloren.
 */
export function useLiedinfoQuelle(
  songId: number | null,
  arrangementId: number | null,
  darf: boolean,
): LiedinfoQuelle | undefined {
  const lied = useSongStammdaten(songId);
  const arrangements = useArrangements(songId);
  return useMemo(() => {
    const arrangement = arrangements.data?.find((a) => a.id === arrangementId);
    if (!lied.data || !arrangement) return undefined;
    return { lied: lied.data, arrangement, darf };
  }, [lied.data, arrangements.data, arrangementId, darf]);
}
