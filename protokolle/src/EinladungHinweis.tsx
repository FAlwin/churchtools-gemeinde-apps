import { Icon } from '@ui/icons/icons';
import styles from './SitzungFestlegen.module.scss';

/**
 * **„Die Einladung geht sofort per Mail an N Personen.“** – der Satz vor dem Speichern, wenn ChurchTools Einladungen
 * verschickt (Nächste Sitzung festlegen, W15-4 Besprechungsanfragen im Fenster „In Kalender eintragen“). Eine Stelle
 * für Satz und Aussehen; `mails` zählt `mailsAnAndere` (ich bekomme keine). Bei 0 steht nichts.
 */
export function EinladungHinweis({ mails }: { mails: number }) {
  if (mails <= 0) return null;
  return (
    <p className={styles.mail} role="note">
      <Icon name="warnung" size={18} />
      <span>
        Die Einladung geht <b>sofort</b> per Mail an {mails} {mails === 1 ? 'Person' : 'Personen'}.
      </span>
    </p>
  );
}
