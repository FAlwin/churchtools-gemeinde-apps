import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import styles from '../pages/ChordChart.module.scss';

/**
 * Die Fußleiste der Lied-Anzeige (#314 – vorher inline in `pages/ChordChart.tsx`).
 *
 * **Scheibe B3 (30.10.2026, Entwurf Variante B):** „‹ Zurück“ mit Rahmen, in der Mitte „Nächstes Lied: …“, rechts
 * „Weiter ›“ in Blau – dieselben Knöpfe wie im Kopf (`KopfKnopf`), am Handy nur die Pfeile. Die Punktreihe ist weg:
 * Springen zu einem Lied übernimmt die Ablauf-Leiste im Kopf (B2). Die Seitenangabe bleibt als Schild auf dem Blatt
 * (`PageDeck`, Alwin: „Schild bleibt wie heute“).
 */
interface ChartFooterProps {
  /** Wie viele Lieder der Ablauf hat – ab zwei steht beim letzten „Letztes Lied“. */
  songCount: number;
  /** Titel des nächsten Lieds – `null` beim letzten. */
  nextSongTitle: string | null;
  atStart: boolean;
  atEnd: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function ChartFooter({
  songCount,
  nextSongTitle,
  atStart,
  atEnd,
  onPrev,
  onNext,
}: ChartFooterProps) {
  return (
    <div className={styles.ftr}>
      <KopfKnopf
        label="Zurück"
        title="Zurück / vorige Seite"
        symbol={<Icon name="chev-left" size={18} stroke={2.2} />}
        onClick={onPrev}
        disabled={atStart}
      />
      <div className={styles.ftrInfo}>
        {nextSongTitle ? (
          <span className={styles.ftrNext}>
            <span className={styles.ftrNextWort}>Nächstes Lied: </span>
            <span className={styles.ftrNextKurz}>Nächstes: </span>
            <strong>{nextSongTitle}</strong>
          </span>
        ) : songCount > 1 ? (
          <span className={styles.ftrNext}>Letztes Lied</span>
        ) : null}
      </div>
      <KopfKnopf
        label="Weiter"
        title="Weiter / nächste Seite"
        symbol={<Icon name="chev-right" size={18} stroke={2.2} />}
        symbolHinten
        haupt
        onClick={onNext}
        disabled={atEnd}
      />
    </div>
  );
}
