import type { ReactNode } from 'react';
import styles from './Startseite.module.scss';

/**
 * **Das Status-Etikett der Anmeldungen** (R9/E24, „Ruhige Bedienung“ B7): eine Form, vier Farben – neutral, blau (wartet auf
 * dich), grün (läuft, in Ordnung), rot (Aufmerksamkeit). Die EINE Stelle dafür in dieser App: Startseite, Veranstaltung,
 * Nachprüfung und Liste setzen ihre Etiketten hierüber, nicht mit eigenen Klassen. Das gemeinsame Etikett für alle Apps
 * (B8b) stellt hier um und sonst nirgends.
 */
export type EtikettTon = 'neutral' | 'blau' | 'gruen' | 'rot';

const KLASSE: Record<EtikettTon, string> = {
  neutral: styles.chip,
  blau: `${styles.chip} ${styles.chipBlau}`,
  gruen: `${styles.chip} ${styles.chipGruen}`,
  rot: `${styles.chip} ${styles.chipRot}`,
};

export function Etikett({ ton = 'neutral', children }: { ton?: EtikettTon; children: ReactNode }) {
  return <span className={KLASSE[ton]}>{children}</span>;
}
