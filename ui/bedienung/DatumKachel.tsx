import styles from './DatumKachel.module.scss';

/**
 * **Die Datumskachel einer Terminliste** – hellblau wie „Anstehende Termine“ in der ChurchTools-App
 * (#393). Eine Kachel für die Terminliste der Musik-App und die des Dienstplaners (E3-2). Tag und Monat
 * kommen als Text, damit jede App ihre Schreibweise behält.
 */
export function DatumKachel({ tag, monat }: { tag: string; monat: string }) {
  return (
    <div className={styles.kachel}>
      <span className={styles.tag}>{tag}</span>
      <span className={styles.monat}>{monat}</span>
    </div>
  );
}
