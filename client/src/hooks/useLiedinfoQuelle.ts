import { useMemo } from 'react';
import {
  useArrangementAendern,
  useArrangements,
  useLiedAendern,
  useSongStammdaten,
} from './useServices';
import type { LiedinfoQuelle } from '../utils/liedinfoFormular';

/**
 * **Die Liedinfo für den Editor laden und speichern** (Lied-Editor L4): Lied-Stammdaten und das Arrangement, dessen
 * Notenblatt bearbeitet wird. EIN Baustein für alle Stellen, die den Editor öffnen (Liedblatt, Stammdaten-Blatt,
 * Neues Lied). `songId = null` lädt nichts – so lädt eine Seite erst, wenn der Editor wirklich offen ist.
 *
 * Gespeichert wird über die Schreibwege des Stammdaten-Blatts (`useLiedAendern`, `useArrangementAendern`); beide
 * liefern den Stand, den ChurchTools übernommen hat – und genau der entscheidet, welche Kopfzeilen gehen dürfen.
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
  const liedAendern = useLiedAendern(songId ?? 0);
  const arrangementAendern = useArrangementAendern(songId ?? 0);
  return useMemo(() => {
    const arrangement = arrangements.data?.find((a) => a.id === arrangementId);
    if (!lied.data || !arrangement) return undefined;
    const quelle: LiedinfoQuelle = {
      lied: lied.data,
      arrangement,
      darf,
      speichern: async (aenderung) => ({
        lied: aenderung.lied ? await liedAendern.mutateAsync(aenderung.lied) : lied.data,
        arrangement: aenderung.arrangement
          ? await arrangementAendern.mutateAsync({
              arrangementId: arrangement.id,
              auftrag: aenderung.arrangement,
            })
          : arrangement,
      }),
    };
    return quelle;
    // Die Mutationen sind stabil genug: `mutateAsync` wechselt nicht zwischen den Aufrufen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lied.data, arrangements.data, arrangementId, darf]);
}
