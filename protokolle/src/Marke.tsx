import type { ReactNode } from 'react';
import styles from './Marke.module.scss';

/**
 * **Ein kleines Schild** („eingerichtet“, „versteckt“ …) – eine Bauart für Startseite und Verwaltung der Protokolle,
 * Farben nach dem ChurchTools-Look: Grün = gut, Rot = Problem, Grau = neutral.
 */
export function Marke({
  art,
  children,
}: {
  art: 'gut' | 'problem' | 'leise';
  children: ReactNode;
}) {
  return <span className={`${styles.marke} ${styles[art]}`}>{children}</span>;
}
