import type { Zeitzeile } from '@shared/dienstplan/abfrageFenster';
import styles from './AbfrageFenster.module.scss';

/** „Was passiert wann“ – die Zeilen kommen fertig aus `zeitleiste` (`shared/dienstplan/abfrageFenster.ts`). */
export function AbfrageZeitleiste({ zeilen }: { zeilen: Zeitzeile[] }) {
  return (
    <section aria-label="Was passiert wann">
      <h3 className={styles.titel}>Was passiert wann</h3>
      <ul className={styles.zeitleiste}>
        {zeilen.map((z) => (
          <li key={z.schluessel} className={z.vorbei ? styles.vorbei : undefined}>
            <span className={styles.wann}>
              {z.wann}
              {z.klein && <small>{z.klein}</small>}
            </span>
            <span>{z.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
