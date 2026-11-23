import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../icons/icons';
import { BodyPortal } from '../fenster/BodyPortal';
import { Sheet } from '../fenster/Sheet';
import { useEscape } from './useEscape';
import { TextKnopf } from './TextKnopf';
import styles from './SpaltenFilter.module.scss';

/**
 * **Filtern über die Spaltenüberschrift** (Anmeldungen R2, Entwurf `r2-u3-filter-ansichten-v1`, abgenommen 23.11.2026):
 * der Trichter neben der Überschrift, die gesetzten Filter als Chips und das Fenster, das direkt am Trichter aufgeht.
 * Was gefiltert wird, rechnet der Aufrufer (`@shared/anmeldung/tabellenFilter`) – hier steht nur die Bedienung.
 */

/** **Der Trichter in der Spaltenüberschrift** – blau, solange nach dieser Spalte gefiltert wird. */
export function SpaltenTrichter({
  spalte,
  name,
  aktiv,
  offen,
  onOeffnen,
}: {
  /** Schlüssel der Spalte – am Knopf als `data-trichter`, damit ein Chip das Fenster hier aufmachen kann. */
  spalte: string;
  /** Name der Spalte für Vorleser und Tooltip. */
  name: string;
  aktiv: boolean;
  offen: boolean;
  onOeffnen: (anker: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.trichter}${aktiv ? ` ${styles.aktiv}` : ''}`}
      aria-label={aktiv ? `Filter „${name}“ ändern` : `Nach „${name}“ filtern`}
      title={aktiv ? `Filter „${name}“ ändern` : `Nach „${name}“ filtern`}
      aria-expanded={offen}
      aria-haspopup="dialog"
      data-trichter={spalte}
      onClick={(ev) => {
        // Der Trichter sitzt im Sortier-Knopf der Überschrift: Filtern sortiert nicht.
        ev.stopPropagation();
        onOeffnen(ev.currentTarget);
      }}
    >
      <Icon name="trichter" size={14} />
    </button>
  );
}

export interface FilterChip {
  spalte: string;
  name: string;
  text: string;
}

/**
 * **Die gesetzten Filter als Chips** – antippen ändert (das Fenster geht am Trichter der Spalte auf, ist sie
 * ausgeblendet, am Chip), × entfernt. Dahinter „Alle Filter entfernen“, rechts Platz für „Als Ansicht speichern“ (U3).
 */
export function FilterChips({
  chips,
  onAendern,
  onWeg,
  onAlleWeg,
  ohneFilter,
  rechts,
}: {
  chips: FilterChip[];
  onAendern: (spalte: string, anker: HTMLElement) => void;
  onWeg: (spalte: string) => void;
  onAlleWeg: () => void;
  /** Steht da, wenn es keinen Chip gibt (eigene Ansicht ohne Filter). */
  ohneFilter?: string;
  rechts?: ReactNode;
}) {
  return (
    <div className={styles.chips}>
      {chips.map((c) => (
        <span key={c.spalte} className={styles.chip}>
          <button
            type="button"
            className={styles.chipText}
            title="Filter ändern"
            data-chip={c.spalte}
            onClick={(ev) => onAendern(c.spalte, ev.currentTarget)}
          >
            <b>{c.name}:</b> <span>{c.text}</span>
          </button>
          <button
            type="button"
            className={styles.chipWeg}
            aria-label={`Filter „${c.name}“ entfernen`}
            title="Filter entfernen"
            onClick={() => onWeg(c.spalte)}
          >
            <Icon name="x" size={13} />
          </button>
        </span>
      ))}
      {chips.length > 0 ? (
        <TextKnopf onClick={onAlleWeg}>Alle Filter entfernen</TextKnopf>
      ) : ohneFilter ? (
        <span className={styles.leise}>{ohneFilter}</span>
      ) : null}
      {rechts && <span className={styles.rechts}>{rechts}</span>}
    </div>
  );
}

/** So viel Abstand hält das Fenster zum Rand (px) – wie `menueLage`. */
const RAND = 16;

/**
 * **Das Filterfenster am Trichter** – am Rechner ein kleines Fenster direkt unter dem Trichter (an `body`, damit die
 * Tabelle es nicht abschneidet; beim Scrollen der Seite geht es zu, sonst liefe es dem Trichter davon), am Handy ein
 * Fenster wie jedes andere (`Sheet`, „Fenster sind immer Modale“). Tipp daneben und Escape schließen.
 */
export function AnkerFenster({
  anker,
  titel,
  handy,
  onClose,
  children,
  links,
  knopf,
}: {
  anker: HTMLElement | null;
  titel: string;
  handy: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Links unten (am Handy links in der Fußzeile): „Filter entfernen“. */
  links?: ReactNode;
  /** Der Hauptknopf („Anwenden“). */
  knopf: ReactNode;
}) {
  const fenster = useRef<HTMLDivElement>(null);
  const zuRef = useRef(onClose);
  zuRef.current = onClose;

  // Unter den Trichter, innerhalb des Bildschirms – vor dem ersten Bild gemessen.
  useLayoutEffect(() => {
    const f = fenster.current;
    if (handy || !f || !anker) return;
    const a = anker.getBoundingClientRect();
    const breite = document.documentElement.clientWidth;
    const w = f.getBoundingClientRect().width;
    f.style.top = `${Math.round(a.bottom + 6)}px`;
    f.style.left = `${Math.round(Math.max(RAND, Math.min(a.left - 12, breite - w - RAND)))}px`;
  }, [anker, handy]);

  useEffect(() => {
    if (handy) return;
    const weg = (ev: Event) => {
      const ziel = ev.target as Node;
      if (fenster.current?.contains(ziel)) return;
      // Ein Tipp auf denselben Trichter schaltet um – das erledigt dessen Klick.
      if (ev.type === 'pointerdown' && anker?.contains(ziel)) return;
      zuRef.current();
    };
    document.addEventListener('pointerdown', weg);
    window.addEventListener('scroll', weg, true);
    window.addEventListener('resize', weg);
    return () => {
      document.removeEventListener('pointerdown', weg);
      window.removeEventListener('scroll', weg, true);
      window.removeEventListener('resize', weg);
    };
  }, [anker, handy]);
  useEscape(!handy, () => zuRef.current());

  // Das erste Feld bekommt den Fokus – Tastatur und Vorleser landen im Fenster.
  useEffect(() => {
    if (handy) return;
    fenster.current?.querySelector<HTMLElement>('input')?.focus();
  }, [handy]);

  if (handy)
    return (
      <Sheet title={titel} onClose={onClose} links={links} knoepfe={knopf}>
        {children}
      </Sheet>
    );
  return (
    <BodyPortal>
      <div ref={fenster} className={styles.fenster} role="dialog" aria-label={titel}>
        <h4 className={styles.titel}>{titel}</h4>
        {children}
        <div className={styles.fuss}>
          {links ?? <span />}
          {knopf}
        </div>
      </div>
    </BodyPortal>
  );
}
