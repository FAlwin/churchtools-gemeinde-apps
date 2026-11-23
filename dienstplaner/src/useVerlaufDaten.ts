import { useMemo } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import {
  schnittAus,
  schnittSchluessel,
  type Schnitt,
  type VerlaufTermin,
} from '@shared/ct/liveRueckblick';
import { restText } from '@shared/ct/liveAgenda';
import { ladeAlleVerlaeufe } from './ladeVerlauf';

/** Die Verläufe aller Termine, wie der Speicher sie hält. */
export type VerlaufTermine = ReadonlyMap<number, VerlaufTermin>;

/**
 * **Alle Live-Verläufe für Rückblick und Schnitt** (L4-4): einmal je Seitenaufruf gelesen (`ladeAlleVerlaeufe`) – wer neu lesen
 * will, leert vorher `verlaufCacheLeeren` und ruft `neuLesen()`. Die alten Daten bleiben beim Neuladen stehen. Scheitert das Lesen, fehlt Rückblick und Ø leise (`termine: null`) – nichts geht kaputt.
 * `setze` ersetzt den Verlauf eines Termins sofort (nach dem Festhalten einer Markierung).
 */
export function useVerlaufDaten(
  /** Wird überhaupt etwas davon gezeigt? Sonst wird auch nicht gelesen. */
  an = true,
  laden: typeof ladeAlleVerlaeufe = ladeAlleVerlaeufe,
): {
  termine: VerlaufTermine | null;
  schnitt: Schnitt | null;
  setzeTermin: (terminId: number, neu: VerlaufTermin) => void;
  /** Noch einmal lesen (leise: die bisherigen Daten bleiben stehen, bis neue da sind). */
  neuLesen: () => void;
} {
  const { stand, setze, neu } = useLaden<VerlaufTermine>(
    () =>
      an
        ? laden().then((r) => {
            if (!r.ok) throw new Error(r.grund);
            return r.termine;
          })
        : null,
    [an, laden],
    { behalten: true },
  );
  const termine = stand.art === 'fertig' ? stand.daten : null;
  const schnitt = useMemo(() => (termine ? schnittAus(termine.values()) : null), [termine]);
  return {
    termine,
    schnitt,
    setzeTermin: (terminId, verlauf) => setze((alt) => new Map(alt).set(terminId, verlauf)),
    neuLesen: neu,
  };
}

/** „Ø 8:10“ für einen Punkt (Titel, Lied?) – `null`, wo es noch keinen Schnitt gibt. Die eine Stelle für Rückblick und Ablauf bearbeiten. */
export function schnittKurz(schnitt: Schnitt | null, titel: string, lied: boolean): string | null {
  const k = schnittSchluessel(titel, lied);
  const w = k === null ? undefined : schnitt?.get(k);
  return w ? `Ø ${restText(w.sek)}` : null;
}
