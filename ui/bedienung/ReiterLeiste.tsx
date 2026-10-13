import { Icon, type IconName } from '../icons/icons';
import styles from './ReiterLeiste.module.scss';

export interface Reiter<T extends string> {
  id: T;
  label: string;
  icon: IconName;
}

interface Props<T extends string> {
  reiter: Reiter<T>[];
  aktiv: T;
  /** Ausgegraute Reiter (z. B. Liedersammlung ohne Netz) – bleiben tippbar, der Aufrufer erklärt warum. */
  gedimmt?: T[];
  onWechsel: (id: T) => void;
  /** Tipp auf den schon aktiven Reiter – die Musik-App scrollt dann nach oben (wie in iOS-Apps). */
  onErneut?: () => void;
  /** Ziel der geführten Einführung (`data-tour`), falls die App eine hat. */
  tour?: string;
}

/**
 * **Die untere Reiterleiste** im ChurchTools-Stil – eine für alle Apps (Dienstplaner E3; vorher nur
 * `TabBar` der Musik-App, die jetzt diese Leiste mit ihren Reitern füllt).
 */
export function ReiterLeiste<T extends string>({
  reiter,
  aktiv,
  gedimmt = [],
  onWechsel,
  onErneut,
  tour,
}: Props<T>) {
  return (
    <nav className={styles.tabbar} data-tour={tour} aria-label="Bereiche">
      {reiter.map((r) => {
        const an = aktiv === r.id;
        const aus = gedimmt.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={an}
            className={`${styles.tab}${an ? ' ' + styles.on : ''}${aus ? ' ' + styles.off : ''}`}
            onClick={() => (an ? onErneut?.() : onWechsel(r.id))}
          >
            <Icon name={r.icon} size={24} stroke={1.9} />
            <span>{r.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
