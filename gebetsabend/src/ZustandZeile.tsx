import styles from './Zuhoeren.module.scss';

/** „● Läuft seit …“ – grüner Punkt, wenn es läuft, sonst grau. EINE Stelle für Zuhören und Technik. */
export function ZustandZeile({ gut, children }: { gut: boolean; children: string }) {
  return (
    <p className={gut ? `${styles.zustand} ${styles.an}` : styles.zustand} role="status">
      <span className={styles.punkt} aria-hidden="true" />
      {children}
    </p>
  );
}
