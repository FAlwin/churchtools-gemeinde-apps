import type { ReactNode } from 'react';
import { Schalter } from '@ui/bedienung/Schalter';
import styles from './TerminSchalter.module.scss';

/**
 * **Der Schalter der Reiter im Fenster „In Kalender eintragen“** (Besprechungsanfragen W15-4, Anmeldung W15-5): ein
 * unsichtbarer Haken (`role="switch"`, die Tastatur bedient ihn) mit dem einen `Schalter` der App und seiner Beschriftung.
 * Vorher stand das Muster in `TerminAnfragen.tsx` – der zweite Reiter hätte es abgeschrieben.
 */
export function TerminSchalter({
  an,
  onAn,
  disabled,
  children,
}: {
  an: boolean;
  onAn: (an: boolean) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <label className={styles.schalter}>
      <input
        type="checkbox"
        role="switch"
        className={styles.versteckt}
        checked={an}
        disabled={disabled}
        onChange={(ev) => onAn(ev.target.checked)}
      />
      <Schalter an={an} />
      <span>{children}</span>
    </label>
  );
}
