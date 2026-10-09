import styles from '../pages/Settings.module.scss';
import { Schalter } from '@ui/bedienung/Schalter';

interface SchalterZeileProps {
  /** Beschriftung links – zugleich der Name des Schalters für Screenreader. */
  label: string;
  an: boolean;
  onUmschalten: () => void;
  /** Erklärung unter der Beschriftung (optional, z. B. im Teilen-Fenster). */
  hinweis?: string;
}

/**
 * Eine Einstellungszeile mit Schalter rechts (#407). Die ganze Zeile ist EIN Knopf mit
 * `aria-pressed`; der Schalter darin ist reine Anzeige.
 *
 * Stand bis zum 23.09.2026 dreimal fast wortgleich in `pages/Settings.tsx` – und zwar als klickbare
 * Zeile mit einem ZWEITEN Knopf darin, der per `stopPropagation` verhindern musste, dass ein Tipp
 * doppelt schaltet (dann springt der Wert zweimal, also gar nicht). Verschachtelte Bedienelemente
 * sind außerdem für Screenreader ein Ärgernis. Ein einziger Knopf braucht beides nicht. Der Schalter selbst ist
 * `Schalter` (#413) – derselbe wie in `LinksManager` und `ItemActionSheet`.
 */
export function SchalterZeile({ label, an, onUmschalten, hinweis }: SchalterZeileProps) {
  return (
    <button
      type="button"
      className={`${styles.setRow} ${styles.tappable}`}
      aria-pressed={an}
      onClick={onUmschalten}
    >
      {hinweis ? (
        <span className={styles.textMitHinweis}>
          <span className={styles.setLabel}>{label}</span>
          <span className={styles.zeilenHinweis}>{hinweis}</span>
        </span>
      ) : (
        <span className={styles.setLabel}>{label}</span>
      )}
      <Schalter an={an} />
    </button>
  );
}
