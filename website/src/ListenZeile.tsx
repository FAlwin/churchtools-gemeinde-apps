import type { ReactNode } from 'react';
import { Icon, type IconName } from '@ui/icons/icons';
import styles from './Seiten.module.scss';

/**
 * **Eine Zeile der Listen links** – Seitenliste (Reiter „Seiten“) und Liste des Reiters „Freigaben“: dieselbe Zeile, damit
 * beide gleich aussehen und sich gleich bedienen. Die aktuelle Zeile ist blau hinterlegt; `etikett` steht hinten.
 */
export function ListenZeile({
  titel,
  symbol,
  aktiv,
  gesperrt,
  etikett,
  onClick,
}: {
  titel: string;
  symbol: IconName;
  aktiv: boolean;
  /** Nicht tippbar (etwas ist noch nicht gespeichert). */
  gesperrt?: boolean;
  etikett?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.eintrag}${aktiv ? ' ' + styles.an : ''}`}
      aria-current={aktiv ? 'page' : undefined}
      disabled={gesperrt}
      onClick={onClick}
    >
      <Icon name={symbol} size={16} />
      <span className={styles.titel}>{titel}</span>
      {etikett}
    </button>
  );
}
