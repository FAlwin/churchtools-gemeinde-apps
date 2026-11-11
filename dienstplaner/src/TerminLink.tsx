import type { ReactNode } from 'react';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import styles from './TerminLink.module.scss';

/**
 * **Datum und Titel führen in die Termin-Ansicht** (Wunsch 8, Alwin 11.11.2026: „nicht über Umwege“). Eine Stelle für
 * Startseite („Als Nächstes“, Dienst-Zeilen) und den Kopf eines Termins in Planen am Handy. Kachel und Titel sind zwei
 * Knöpfe zum selben Ziel – nur der Titel ist per Tastatur erreichbar und wird vorgelesen; Knöpfe daneben (Zusagen,
 * Tauschen) bleiben eigene Knöpfe.
 */
export function KachelLink({
  tag,
  monat,
  onKlick,
}: {
  tag: string;
  monat: string;
  /** Ohne: nur die Kachel, wie bisher. */
  onKlick?: () => void;
}) {
  if (!onKlick) return <DatumKachel tag={tag} monat={monat} />;
  return (
    <button
      type="button"
      className={styles.kachel}
      onClick={onKlick}
      tabIndex={-1}
      aria-hidden="true"
    >
      <DatumKachel tag={tag} monat={monat} />
    </button>
  );
}

export function TitelLink({
  onKlick,
  children,
  className,
}: {
  /** Ohne: nur der Inhalt, wie bisher. */
  onKlick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!onKlick) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      className={`${styles.titel}${className ? ' ' + className : ''}`}
      onClick={onKlick}
    >
      {children}
    </button>
  );
}
