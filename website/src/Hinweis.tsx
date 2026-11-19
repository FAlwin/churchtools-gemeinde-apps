import styles from './Hinweis.module.scss';

/** Eine ruhige Karte mit Überschrift und Text – für „kommt noch“, „kein Zugang“ und „nicht eingerichtet“. */
export function Hinweis({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className={styles.karte} aria-label={titel}>
      <h2>{titel}</h2>
      {children}
    </section>
  );
}

/** Ein Absatz in der ruhigeren Farbe (Erklärung, Tipp). */
export function Leise({ children }: { children: React.ReactNode }) {
  return <p className={styles.leise}>{children}</p>;
}
