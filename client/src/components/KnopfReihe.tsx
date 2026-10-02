import type { ReactNode } from 'react';
import { Icon } from './icons';
import styles from './KnopfReihe.module.scss';

interface RundKnopfProps {
  onClick: () => void;
  /** Name für Screenreader und Tooltip – der Knopf zeigt nur ein Symbol. */
  title: string;
  /** Ziel der geführten Einführung (`utils/onboarding.ts`). */
  dataTour?: string;
  /** Blau gefüllt: Hier läuft gerade etwas (Puls, Zeichnen, fremde Notizen). */
  aktiv?: boolean;
  /** Öffnet der Knopf ein Menü? Dann `aria-expanded` mit dessen Zustand. */
  menuOffen?: boolean;
  /**
   * Hellblau hinterlegt: Ein Fenster, das zu diesem Knopf gehört, ist offen (Alwin, 02.10.2026). Bewusst
   * ein anderer Ton als `aktiv` (voll blau = es läuft etwas) – sonst sagte die Farbe zweierlei.
   */
  offen?: boolean;
  children: ReactNode;
}

/** Ein runder Knopf (Teilen, Bearbeiten, Werkzeuge …) – Setlist und Liedblatt teilen ihn. */
export function RundKnopf({
  onClick,
  title,
  dataTour,
  aktiv,
  menuOffen,
  offen,
  children,
}: RundKnopfProps) {
  return (
    <button
      type="button"
      className={`${styles.knopf}${aktiv ? ' ' + styles.aktiv : offen ? ' ' + styles.offen : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      data-tour={dataTour}
      aria-haspopup={menuOffen === undefined ? undefined : 'menu'}
      aria-expanded={menuOffen}
    >
      {children}
    </button>
  );
}

/**
 * Der runde Zurück-Knopf – dunkel wie in den iPhone-Einstellungen. Eine Stelle für Setlist
 * (`KnopfReihe`) und Liedblatt (`ChartHeader`); sichtbar ist nur der Pfeil, der Name nennt das Ziel.
 */
export function ZurueckKnopf({ onClick, ziel }: { onClick: () => void; ziel?: string }) {
  return (
    <button
      type="button"
      className={`${styles.knopf} ${styles.zurueck}`}
      onClick={onClick}
      aria-label={ziel ? `Zurück zu ${ziel}` : 'Zurück'}
    >
      <Icon name="chev-left" size={22} stroke={2.4} />
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
        {zurueck && <ZurueckKnopf onClick={zurueck} ziel={zurueckLabel} />}
      </div>
      <div className={styles.gruppe}>{aktionen}</div>
    </div>
  );
}
