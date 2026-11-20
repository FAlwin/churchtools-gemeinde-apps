import type { ReactNode } from 'react';
import { Icon } from '../icons/icons';
import styles from './ZeitraumLeiste.module.scss';

/** Ein Pfeil der Zeitraum-Leiste: ob er geht, wie er heißt (Screenreader) und was er tut. */
export interface ZeitraumPfeil {
  aktiv: boolean;
  label: string;
  onClick: () => void;
}

/**
 * **Die Zeitraum-Leiste** (R5/E6, „Ruhige Bedienung“ B3, B4): EIN gerahmtes Element ‹ [Zeitraum] › für die Mitte der
 * Werkzeugzeile (`Werkzeugzeile`, `mitte`). Der Zeitraum-Knopf (`ZeitraumKnopf`) steht als `knopf` zwischen den Pfeilen; Pfeile
 * und Knopf haben darin keinen eigenen Rand. Bis B4 gab es das nur in „Planen“ (`Terminleiste`) – seit „Wann kann ich?“ denselben
 * Rahmen nutzt, ist es ein Baustein.
 *
 * Am Handy (`handy`) füllt der Knopf die Breite; die Pfeile gibt es dort nur, wenn `blaettern` es sagt (der Aufrufer weiß,
 * ob dort anders geblättert wird).
 */
export function ZeitraumLeiste({
  knopf,
  handy = false,
  blaettern = true,
  davor,
  danach,
  dataTour,
}: {
  knopf: ReactNode;
  handy?: boolean;
  /** Pfeile zeigen? Vorgabe ja. */
  blaettern?: boolean;
  davor: ZeitraumPfeil;
  danach: ZeitraumPfeil;
  /** Ziel der geführten Einführung. */
  dataTour?: string;
}) {
  const pfeil = (p: ZeitraumPfeil, richtung: 'links' | 'rechts') => (
    <button
      type="button"
      className={styles.pfeil}
      disabled={!p.aktiv}
      aria-label={p.label}
      onClick={p.onClick}
    >
      <Icon name={richtung === 'links' ? 'chev-left' : 'chev-right'} size={16} />
    </button>
  );
  return (
    <div
      className={`${styles.leiste}${handy ? ' ' + styles.handy : ''}`}
      role="group"
      aria-label="Zeitraum"
      data-tour={dataTour}
    >
      {blaettern && pfeil(davor, 'links')}
      {knopf}
      {blaettern && pfeil(danach, 'rechts')}
    </div>
  );
}
