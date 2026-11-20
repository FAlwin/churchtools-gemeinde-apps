import type { ReactNode } from 'react';
import styles from './Etikett.module.scss';

/**
 * **Das Status-Etikett** (R9/E24, „Ruhige Bedienung“ B8b): eine Form, vier Farben – neutral (grau: leise Auskunft),
 * blau (deine Rolle, in Arbeit, wartet auf dich), grün (fertig, in Ordnung), rot (braucht Aufmerksamkeit).
 * Die EINE Stelle dafür in allen Erweiterungen: keine eigene Pillen-Klasse in einer App (Wächter `etiketten.test.ts`).
 * Ein Etikett ist nur Anzeige – was man antippen kann, ist ein Knopf (`FilterKnopf`, `KopfKnopf` …), und ein Zähler
 * am Reiter ist `ReiterZaehler`.
 */
export type EtikettTon = 'neutral' | 'blau' | 'gruen' | 'rot';

const KLASSE: Record<EtikettTon, string> = {
  neutral: styles.etikett,
  blau: `${styles.etikett} ${styles.blau}`,
  gruen: `${styles.etikett} ${styles.gruen}`,
  rot: `${styles.etikett} ${styles.rot}`,
};

export function Etikett({
  ton = 'neutral',
  title,
  children,
}: {
  ton?: EtikettTon;
  /** Erklärung beim Darüberfahren (z. B. was „nur ansehen“ heißt). */
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={KLASSE[ton]} title={title}>
      {children}
    </span>
  );
}
