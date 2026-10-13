import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './Plakette.module.scss';

/**
 * **Eine Plakette für einen Dienst**: zugesagt (grün, Haken), angefragt (blau, „?“) oder abgesagt (grau).
 * Termine-Liste und Startseite zeigen dieselben – hier steht, wie sie aussehen.
 */
export function Plakette({
  art,
  gross = false,
  children,
}: {
  art: 'zugesagt' | 'angefragt' | 'abgesagt';
  gross?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.plakette} ${styles[art]}${gross ? ' ' + styles.gross : ''}`}>
      {art === 'zugesagt' && <Icon name="check" size={13} />}
      {art === 'angefragt' && <span aria-hidden="true">?</span>}
      <span>{children}</span>
    </span>
  );
}
