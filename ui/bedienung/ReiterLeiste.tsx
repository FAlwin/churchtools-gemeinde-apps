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
  /**
   * **Oben statt unten** (Musik-App am iPad, Scheibe S, 26.10.2026): Text mit blauer Unterstreichung wie die Reiter in
   * ChurchTools („Events“: Dienstplan · Abwesenheiten …), ohne Symbole. Am Handy bleibt die Leiste unten.
   */
  oben?: boolean;
}

/**
 * **Die Reiterleiste** im ChurchTools-Stil – eine für alle Apps (Dienstplaner E3; vorher nur `TabBar` der Musik-App,
 * die jetzt diese Leiste mit ihren Reitern füllt). Unten mit Symbol und Text (Handy), mit `oben` als Textreiter.
 */
export function ReiterLeiste<T extends string>({
  reiter,
  aktiv,
  gedimmt = [],
  onWechsel,
  onErneut,
  tour,
  oben = false,
}: Props<T>) {
  return (
    <nav className={oben ? styles.oben : styles.tabbar} data-tour={tour} aria-label="Bereiche">
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
            {!oben && <Icon name={r.icon} size={24} stroke={1.9} />}
            <span>{r.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
