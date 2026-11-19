import { Icon } from '@ui/icons/icons';
import { hinweisText, type Faellige, type Vorlauf } from '@shared/protokolle/hinweis';
import styles from './FaelligBand.module.scss';

/**
 * **Hinweisband oben auf der Startseite** (Hinweis auf fällige To-Dos): „**2 To-Dos überfällig**, 1 bis Sa, 21.11. fällig“
 * mit dem Weg „Zu meinen To-Dos“. Rot getönt, solange etwas überfällig ist, sonst ruhig blau. Nichts fällig, „Aus“ oder
 * noch nicht gelesen → kein Band. Den Text macht `hinweisText` (die eine Regel), hier wird nur gezeigt.
 */
export function FaelligBand({
  faellige,
  vorlauf,
  heute,
  onZuToDos,
}: {
  faellige: Faellige | null;
  vorlauf: Vorlauf | null;
  heute: string;
  onZuToDos?: () => void;
}) {
  if (!faellige || vorlauf === null) return null;
  const t = hinweisText(faellige, vorlauf, heute);
  if (!t) return null;
  return (
    <section
      className={`${styles.band} ${t.art === 'rot' ? styles.rot : styles.ruhig}`}
      aria-label="Fällige To-Dos"
      data-art={t.art}
    >
      <Icon name={t.art === 'rot' ? 'warnung' : 'clock'} size={20} />
      <p className={styles.text}>
        <b>{t.fett}</b>
        {t.rest}
      </p>
      {onZuToDos && (
        <button type="button" className={styles.knopf} onClick={onZuToDos}>
          Zu meinen To-Dos
          <Icon name="chev-right" size={16} />
        </button>
      )}
    </section>
  );
}
