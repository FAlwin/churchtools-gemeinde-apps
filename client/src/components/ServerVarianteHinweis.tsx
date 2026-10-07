import { PROJEKT_ADRESSE } from '../services/funktionen';
import styles from '../pages/Settings.module.scss';

/**
 * Der eine Hinweis in der ChurchTools-Erweiterung (#336, Plan §6): was es nur in der Musik App mit
 * eigenem Server gibt. Bewusst EINE Formulierung an EINER Stelle – nicht an jedem fehlenden Knopf.
 */
export function ServerVarianteHinweis() {
  return (
    <div className={styles.group}>
      <div className={styles.serverHinweis}>
        <div className={styles.serverHinweisTitel}>Erweiterung für ChurchTools</div>
        <p>
          Offline-Liedblätter, die Lied-Statistik, die Suche im Liedtext und die App auf dem
          Homescreen gibt es in der Musik App mit eigenem Server.
        </p>
        <a href={PROJEKT_ADRESSE} target="_blank" rel="noopener noreferrer">
          Mehr erfahren
        </a>
      </div>
    </div>
  );
}
