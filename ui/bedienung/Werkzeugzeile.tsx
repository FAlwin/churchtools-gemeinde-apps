import type { ReactNode } from 'react';
import styles from './Werkzeugzeile.module.scss';

/**
 * **Die Werkzeugzeile** (R5/R12/E6/E9, „Ruhige Bedienung“ B3): die eine Zeile mit Werkzeugen über dem Inhalt einer
 * Arbeitsansicht, in drei Bereichen –
 * - `links`: die Ansicht (`AnsichtWahl`),
 * - `mitte`: der Zeitraum, **in der Fenstermitte, egal wie viel links und rechts steht** (Raster `1fr auto 1fr`),
 * - `rechts`: Filter und „⋯“ (`FilterKnopf`, `MehrMenue`).
 *
 * Am Handy (`handy`) zweizeilig: oben links die Ansichtswahl, rechts daneben die übrigen Werkzeuge; darunter der Zeitraum über
 * die ganze Breite. **Dort bekommt jedes Bedienelement der Zeile einen Rahmen** (R12/E8: „kein Knopf steht frei im Raum“) –
 * das macht diese Zeile selbst, die Knöpfe darin bleiben still.
 *
 * Jeder Bereich ist optional. Der Aufrufer hängt nichts Eigenes an die Zeile – was selten ist, gehört ins „⋯“-Menü.
 */
export function Werkzeugzeile({
  links,
  mitte,
  rechts,
  handy = false,
  ariaLabel = 'Werkzeuge',
}: {
  links?: ReactNode;
  mitte?: ReactNode;
  rechts?: ReactNode;
  handy?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`${styles.zeile}${handy ? ' ' + styles.handy : ''}`}
      role="toolbar"
      aria-label={ariaLabel}
    >
      <div className={styles.links}>{links}</div>
      {/* Am Handy steht der Zeitraum in der zweiten Reihe – im Dokument also nach den Werkzeugen, damit Tab-Reihenfolge und Bild übereinstimmen. */}
      {!handy && mitte && <div className={styles.mitte}>{mitte}</div>}
      <div className={styles.rechts}>{rechts}</div>
      {handy && mitte && <div className={styles.mitte}>{mitte}</div>}
    </div>
  );
}
