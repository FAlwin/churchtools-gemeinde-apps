/**
 * **Wer an einem Punkt zuständig ist** (Alwin, 02.11.2026, Entwurf „Ablauf mit Info-Spalten“ Bild 5 C): klappt direkt
 * am Knopf der Kreise auf (`Kuerzel`). Alle Personen mit ihrem Dienst, offene Dienste rot.
 *
 * Bis zum Durchklick auf Staging (02.11.2026) war es ein Fenster in der Mitte – es stand aber an der falschen Stelle der
 * Seite („nach dem Klick ist die Position nicht schön … entweder es kommt direkt aus diesem Button“).
 */
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import styles from './ZustaendigeListe.module.scss';

export function ZustaendigeListe({ punkt }: { punkt: Pick<AblaufZeile, 'title' | 'responsible'> }) {
  return (
    <>
      <b className={styles.titel}>Zuständig · {punkt.title}</b>
      <ul className={styles.liste}>
        {punkt.responsible.map((e, i) => (
          <li key={i} className={styles.zeile}>
            {e.open ? (
              <>
                <span className={styles.offen}>{e.label}</span>
                <span className={styles.dienst}>offen</span>
              </>
            ) : (
              <>
                <span className={styles.name}>{e.label}</span>
                {e.dienst && <span className={styles.dienst}>{e.dienst}</span>}
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
