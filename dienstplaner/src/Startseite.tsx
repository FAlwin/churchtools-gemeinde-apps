import { Icon } from '@ui/icons/icons';
import { darfDienstgruppePlanen } from '@shared/ct/dienstRechte';
import type { Start } from './start';
import styles from './Startseite.module.scss';

/**
 * Die Startseite des Dienstplaners in E2 (Bauplan: „leer, aber echt“): deine Gruppen und welche
 * Dienstgruppen du laut ChurchTools planst. Termine, Planen und Abwesenheiten kommen mit E3 als Reiter.
 */
export function Startseite({ start }: { start: Start }) {
  const planbar = start.dienstgruppen.filter((g) => darfDienstgruppePlanen(start.rechte, g.id));

  return (
    <div className={styles.raster}>
      <section className={styles.karte} aria-labelledby="planen">
        <div className={styles.kopf}>
          <h2 id="planen">Planen</h2>
        </div>
        <ul className={styles.liste}>
          {planbar.length === 0 && (
            <li className={styles.zeile}>
              <span className={styles.leise}>
                Laut deinen ChurchTools-Rechten planst du keine Dienstgruppe.
              </span>
            </li>
          )}
          {planbar.map((g) => (
            <li key={g.id} className={styles.zeile}>
              <span className={styles.kachel} aria-hidden="true">
                <Icon name="calendar" size={18} />
              </span>
              <b className={styles.mitte}>{g.name}</b>
            </li>
          ))}
        </ul>
        <p className={styles.hinweis}>
          Planen darf, wer die Dienstgruppe in ChurchTools bearbeiten darf. Wer die Gruppe eines
          Dienstes leitet oder Admin eines Termins ist, plant dort ebenfalls – das zeigt der
          Dienstplaner, sobald die Termine dazukommen.
        </p>
      </section>

      <section className={styles.karte} aria-labelledby="deine-gruppen">
        <div className={styles.kopf}>
          <h2 id="deine-gruppen">Deine Gruppen</h2>
        </div>
        <ul className={styles.liste}>
          {start.gruppen.length === 0 && (
            <li className={styles.zeile}>
              <span className={styles.leise}>Du bist in keiner Gruppe.</span>
            </li>
          )}
          {start.gruppen.map((g) => (
            <li key={g.id} className={styles.zeile}>
              <span className={`${styles.kachel} ${styles.kachelGrau}`} aria-hidden="true">
                <Icon name="people" size={18} />
              </span>
              <b className={styles.mitte}>{g.name}</b>
              <span className={g.leitung ? styles.rolleLeitung : styles.rolle}>
                {g.leitung ? 'Leitung' : 'Mitglied'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.bau}>
        Der Dienstplaner wird gerade gebaut. Als Nächstes kommen Termine, Planen und Abwesenheiten.
      </p>
    </div>
  );
}
