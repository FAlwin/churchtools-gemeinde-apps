import { useState, type ReactNode } from 'react';
import { KlickZeile } from '@ui/bedienung/KlickZeile';
import styles from './Klappbar.module.scss';

/**
 * **Ein klappbarer Abschnitt im To-Do-Fenster** (W10, Entwurf `todos-jeder-w10-v1`): eine Zeile mit Pfeil, Titel und einer
 * **Kurzzeile**, die schon sagt, was darunter steht („Alle (14) · Jeder für sich“, „2 von 14 fertig“, „5 Einträge · zuletzt …“).
 * Antippen klappt auf; beim Öffnen des Fensters ist er zu (`startOffen` für Fälle, in denen der Inhalt das Ziel ist, etwa
 * ein neues To-Do). Der Inhalt bleibt nur gemountet, solange er offen ist – was er einstellt, merkt sich das Fenster.
 */
export function Klappbar({
  titel,
  kurz,
  startOffen = false,
  children,
}: {
  titel: string;
  /** Was unter dem Abschnitt steht – in der Kopfzeile neben dem Titel. */
  kurz: ReactNode;
  startOffen?: boolean;
  children: ReactNode;
}) {
  const [auf, setAuf] = useState(startOffen);
  return (
    <div className={styles.klapp}>
      <KlickZeile
        className={styles.kopf}
        pfeil={auf ? 'auf' : 'zu'}
        ariaExpanded={auf}
        onClick={() => setAuf(!auf)}
      >
        <span className={styles.titel}>{titel}</span>
        <span className={styles.kurz}>{kurz}</span>
      </KlickZeile>
      {auf && <div className={styles.innen}>{children}</div>}
    </div>
  );
}
