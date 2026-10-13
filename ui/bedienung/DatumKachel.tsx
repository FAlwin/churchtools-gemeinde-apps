import styles from './DatumKachel.module.scss';

/**
 * **Die Datumskachel einer Terminliste** – hellblau wie „Anstehende Termine“ in der ChurchTools-App
 * (#393). Eine Kachel für die Terminliste der Musik-App und die des Dienstplaners (E3-2). Tag und Monat
 * kommen als Text, damit jede App ihre Schreibweise behält.
 */
export function DatumKachel({
  tag,
  monat,
  gedimmt = false,
}: {
  tag: string;
  monat: string;
  /** Grau statt blau – für einen Termin, bei dem es noch nichts zu öffnen gibt (Musik-App: „Kein Ablauf"). */
  gedimmt?: boolean;
}) {
  return (
    <div className={`${styles.kachel}${gedimmt ? ' ' + styles.gedimmt : ''}`}>
      <span className={styles.tag}>{tag}</span>
      <span className={styles.monat}>{monat}</span>
    </div>
  );
}
