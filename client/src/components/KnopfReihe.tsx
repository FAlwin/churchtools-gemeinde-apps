import type { ReactNode } from 'react';
import { Icon } from './icons';
import styles from './KnopfReihe.module.scss';

interface RundKnopfProps {
  onClick: () => void;
  /** Name für Screenreader und Tooltip – der Knopf zeigt nur ein Symbol. */
  title: string;
  /** Ziel der geführten Einführung (`utils/onboarding.ts`). */
  dataTour?: string;
  children: ReactNode;
}

/** Ein runder Knopf der Reihe (Teilen, Bearbeiten …). */
export function RundKnopf({ onClick, title, dataTour, children }: RundKnopfProps) {
  return (
    <button
      type="button"
      className={styles.knopf}
      onClick={onClick}
      title={title}
      aria-label={title}
      data-tour={dataTour}
    >
      {children}
    </button>
  );
}

interface KnopfReiheProps {
  /** Zurück links. */
  zurueck?: () => void;
  /** Wohin „zurück" führt – nur für Screenreader, sichtbar ist nur der Pfeil. */
  zurueckLabel?: string;
  /** Runde Knöpfe rechts (`RundKnopf`). */
  aktionen?: ReactNode;
}

/**
 * **Runde Knöpfe statt Kopfleiste** (02.10.2026, Alwin – Vorbild die iPhone-Einstellungen).
 *
 * Seit iOS 26/27 legt das System über die oberen ~95 pt ein Unschärfe-Band, das sich nicht
 * abschalten lässt; die weiße Leiste der Setlist lag darin und wirkte milchig, ihr Text weich. Am
 * 02.10. am Gerät belegt: Auch eine deckende Statusleiste (`default`) ändert daran nichts. Also steht
 * im Band gar nichts mehr – die Knöpfe schweben direkt darunter, bleiben beim Scrollen stehen und
 * kosten keinen eigenen Streifen. Ersetzt `NavBar`, die nur noch hier im Einsatz war.
 */
export function KnopfReihe({ zurueck, zurueckLabel, aktionen }: KnopfReiheProps) {
  return (
    <div className={styles.reihe}>
      <div className={styles.gruppe}>
        {zurueck && (
          <button
            type="button"
            className={`${styles.knopf} ${styles.zurueck}`}
            onClick={zurueck}
            aria-label={zurueckLabel ? `Zurück zu ${zurueckLabel}` : 'Zurück'}
          >
            <Icon name="chev-left" size={22} stroke={2.4} />
          </button>
        )}
      </div>
      <div className={styles.gruppe}>{aktionen}</div>
    </div>
  );
}
