import { Icon } from '@ui/icons/icons';
import { fristAnzeige } from '@shared/protokolle/frist';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import styles from './FristKaestchen.module.scss';

/**
 * **Das Frist-Kästchen** (W8b, Entwurf `todos-vorschlaege-v2`) – die eine Darstellung der Frist auf Karte, Tabelle und
 * Startseite: „seit 20.10.“ (rot umrandet), „heute“/„morgen“ (orange), der Wochentag, sonst „29.11.“. Was wann wie heißt, sagt
 * `fristAnzeige`; hier wird nur gezeichnet. Ohne Frist nichts.
 */
export function FristKaestchen({
  a,
  heute,
}: {
  a: Pick<Aufgabe, 'bis' | 'status'>;
  heute: string;
}) {
  const f = fristAnzeige(a, heute);
  if (!f) return null;
  return (
    <span
      className={f.art === 'normal' ? styles.kaestchen : `${styles.kaestchen} ${styles[f.art]}`}
      title={f.titel}
    >
      <Icon name="calendar" size={13} />
      {f.text}
    </span>
  );
}
