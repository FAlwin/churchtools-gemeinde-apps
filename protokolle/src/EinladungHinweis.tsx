import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './SitzungFestlegen.module.scss';

/**
 * **Ein Satz vor dem Speichern, wenn ChurchTools beim Anlegen sofort etwas tut, das sich nicht mehr zurücknehmen lässt**
 * (Mails, W15-5 auch Gruppen) – ruhiges Warnzeichen und Satz. Eine Stelle für das Aussehen.
 */
export function SofortHinweis({ children }: { children: ReactNode }) {
  return (
    <p className={styles.mail} role="note">
      <Icon name="warnung" size={18} />
      <span>{children}</span>
    </p>
  );
}

/**
 * **„Die Einladung geht sofort per Mail an N Personen.“** – der Satz vor dem Speichern, wenn ChurchTools Einladungen
 * verschickt (Nächste Sitzung festlegen, W15-4 Besprechungsanfragen im Fenster „In Kalender eintragen“). Eine Stelle
 * für Satz und Aussehen; `mails` zählt `mailsAnAndere` (ich bekomme keine). Bei 0 steht nichts.
 */
export function EinladungHinweis({ mails }: { mails: number }) {
  if (mails <= 0) return null;
  return (
    <SofortHinweis>
      Die Einladung geht <b>sofort</b> per Mail an {mails} {mails === 1 ? 'Person' : 'Personen'}.
    </SofortHinweis>
  );
}
