import type { ReactNode } from 'react';
import styles from './ZeilenKnopf.module.scss';

interface Props {
  onClick: () => void;
  /** Name für Screenreader („„Treu“ zu einem Ablauf hinzufügen“). */
  label: string;
  /** Kurzer Tooltip („Zu Ablauf hinzufügen“); sonst der Name. */
  title?: string;
  disabled?: boolean;
  /** Das Symbol (`Icon`). */
  children: ReactNode;
}

/**
 * **Ein Knopf am Ende einer Listenzeile** („+“ in den Ablauf, Stift für Stammdaten) – eckig mit Rahmen wie die
 * „…“-Knöpfe in der ChurchTools-App (Scheibe S2, Alwin 26.10.2026: Variante A). Vorher hellblau gefüllte Kreise, je
 * eine Kopie in Liederliste und Lied-Auswahl.
 */
export function ZeilenKnopf({ onClick, label, title, disabled, children }: Props) {
  return (
    <button
      type="button"
      className={styles.knopf}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
    >
      {children}
    </button>
  );
}
