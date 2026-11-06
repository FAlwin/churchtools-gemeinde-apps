import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import type { FensterSchritt } from '@shared/dienstplan/fenster';
import styles from './Planen.module.scss';

/**
 * Die Terminleiste: ‹ ＋ [Zeitraum] ＋ › – bei „ab heute“ blättern ‹ › und ＋ im Fenster, bei gewähltem Bereich springen
 * ‹ › um den ganzen Bereich und ＋ nimmt eine einzelne Veranstaltung davor/danach dazu (E9-3, Alwin 05.11.2026). Am
 * Handy nur Knopf und ‹ › für einen gewählten Bereich – geblättert wird dort in der Datumsleiste.
 */
export function Terminleiste({
  knopf,
  bereich,
  handy,
  davor,
  danach,
  onSchritt,
  onVerschieben,
  onDazu,
}: {
  knopf: ReactNode;
  bereich: boolean;
  handy: boolean;
  davor: boolean;
  danach: boolean;
  onSchritt: (was: FensterSchritt) => void;
  onVerschieben: (richtung: 1 | -1) => void;
  /** ＋ bei gewähltem Zeitraum (E9-3): eine Veranstaltung davor (`-1`) bzw. danach (`1`) dazunehmen. */
  onDazu: (richtung: 1 | -1) => void;
}) {
  const pfeil = (richtung: 1 | -1, aktiv: boolean) => (
    <button
      type="button"
      className={styles.leistenKnopf}
      disabled={!aktiv}
      aria-label={
        bereich
          ? richtung < 0
            ? 'Zeitraum davor'
            : 'Zeitraum danach'
          : richtung < 0
            ? 'Einen Termin zurück'
            : 'Einen Termin weiter'
      }
      onClick={() =>
        bereich ? onVerschieben(richtung) : onSchritt(richtung < 0 ? 'zurueck' : 'weiter')
      }
    >
      <Icon name={richtung < 0 ? 'chev-left' : 'chev-right'} size={16} />
    </button>
  );
  const dazu = (was: 'frueherDazu' | 'spaeterDazu', aktiv: boolean) => (
    <button
      type="button"
      className={styles.leistenKnopf}
      disabled={!aktiv}
      aria-label={
        was === 'frueherDazu' ? 'Früheren Termin dazunehmen' : 'Späteren Termin dazunehmen'
      }
      onClick={() => (bereich ? onDazu(was === 'frueherDazu' ? -1 : 1) : onSchritt(was))}
    >
      <Icon name="plus" size={16} />
    </button>
  );
  const blaettern = !handy || bereich;
  return (
    <div
      className={`${styles.leiste}${handy ? ' ' + styles.leisteHandy : ''}`}
      role="group"
      aria-label="Zeitraum"
    >
      {blaettern && pfeil(-1, davor)}
      {!handy && dazu('frueherDazu', davor)}
      {knopf}
      {!handy && dazu('spaeterDazu', danach)}
      {blaettern && pfeil(1, danach)}
    </div>
  );
}
