import type { ReactNode } from 'react';
import { Icon } from '../icons/icons';
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
  /** Zurückgenommen: gehört zum nicht aktiven Lied im Querformat (ein Tipp wählt es). */
  blass?: boolean;
  children: ReactNode;
}

/**
 * Ein runder Knopf (Werkzeuge im Liedblatt, `ChartHeader`). Die Seiten nutzen seit Scheibe S (26.10.2026) `KopfKnopf`;
 * das Liedblatt folgt mit B1 – dann fällt diese Datei weg.
 */
export function RundKnopf({
  onClick,
  title,
  dataTour,
  aktiv,
  menuOffen,
  offen,
  blass,
  children,
}: RundKnopfProps) {
  return (
    <button
      type="button"
      className={`${styles.knopf}${aktiv ? ' ' + styles.aktiv : offen ? ' ' + styles.offen : ''}${
        blass ? ' ' + styles.blass : ''
      }`}
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
 * Der runde Zurück-Knopf des Liedblatts (`ChartHeader`, bis B1); sichtbar ist nur der Pfeil, der Name nennt das Ziel.
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
