import { useEffect, useRef } from 'react';
import { Icon } from '../icons/icons';
import { KopfKnopf } from './KopfKnopf';
import { useAufklapp } from './useAufklapp';
import styles from './OptionWaehlen.module.scss';

/**
 * Escape schließt das Blatt (am Rechner mit Tastatur der gewohnte Weg hinaus). Das Menü am Rechner nutzt dafür
 * `useAufklapp` wie Filter- und Zeitraum-Knopf.
 */
function useEscape(aktiv: boolean, schliessen: () => void): void {
  const aktuell = useRef(schliessen);
  aktuell.current = schliessen;
  useEffect(() => {
    if (!aktiv) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aktuell.current();
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [aktiv]);
}

/** Eine Möglichkeit in „Option wählen“ („Programmpunkt hinzufügen“). */
export interface Option {
  label: string;
  onClick: () => void;
  /** Eine Linie davor – trennt „… dahinter“ von „… davor einfügen“ wie in ChurchTools (Alwin, 30.10.2026). */
  trenner?: boolean;
}

/**
 * **Die Möglichkeiten als kleines Menü unter einem Knopf** – eine Stelle für „+ … hinzufügen“ im Seitenkopf und das
 * Plus an einer Ablauf-Zeile (`SortableRow`, Alwin 30.10.2026). Das Aufklappen selbst (`useAufklapp`) bleibt beim
 * Aufrufer, der den Rahmen um Knopf und Menü legt.
 */
export function MenueListe({
  optionen,
  schliessen,
}: {
  optionen: Option[];
  schliessen: () => void;
}) {
  return (
    <div className={styles.menue} role="menu" aria-label="Option wählen">
      {optionen.map((o) => (
        <button
          key={o.label}
          type="button"
          role="menuitem"
          className={`${styles.option}${o.trenner ? ` ${styles.trenner}` : ''}`}
          onClick={() => {
            schliessen();
            o.onClick();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * **„Option wählen“ als Blatt von unten** – wie in der ChurchTools-App nach dem Plus (Scheibe S2, Screenshots Alwin
 * 26.10.2026): Griff, Titel, ✕ und die Möglichkeiten als Liste. Am Handy; am iPad/Rechner `HinzufuegenMenue`.
 */
export function AuswahlBlatt({
  titel = 'Option wählen',
  optionen,
  onClose,
}: {
  titel?: string;
  optionen: Option[];
  onClose: () => void;
}) {
  useEscape(true, onClose);
  return (
    <div className={styles.hintergrund} onClick={onClose}>
      <div
        className={styles.blatt}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.griff} aria-hidden="true" />
        <div className={styles.kopf}>
          <h2 className={styles.titel}>{titel}</h2>
          <button type="button" className={styles.zu} aria-label="Schließen" onClick={onClose}>
            <Icon name="x" size={16} stroke={2.2} />
          </button>
        </div>
        <div className={styles.liste}>
          {optionen.map((o) => (
            <button
              key={o.label}
              type="button"
              className={`${styles.option}${o.trenner ? ` ${styles.trenner}` : ''}`}
              onClick={o.onClick}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * **„+ … hinzufügen“ im Seitenkopf** (iPad/Rechner): grüner Knopf wie „+ Gruppe erstellen“ in ChurchTools, der die
 * Möglichkeiten als kleines Menü darunter aufklappt. `gesperrt` statt Menü, wenn nichts hinzugefügt werden darf (z. B.
 * abgeschlossener Ablauf – dann der Hinweis des Aufrufers). `klein` für die Gruppenzeile der Matrix (E6-6c): nur das
 * Symbol, 26 px – dann sagt `title`, wofür das Plus ist.
 */
export function HinzufuegenMenue({
  label,
  title,
  optionen,
  gesperrt,
  klein,
  dataTour,
}: {
  label: string;
  title?: string;
  optionen: Option[];
  gesperrt?: () => void;
  klein?: boolean;
  dataTour?: string;
}) {
  // Auf, zu, Tipp daneben, Escape – derselbe Baustein wie Filter- und Zeitraum-Knopf.
  const { offen, setOffen, rahmen } = useAufklapp();
  return (
    <div className={styles.huelle} ref={rahmen}>
      <KopfKnopf
        onClick={() => (gesperrt ? gesperrt() : setOffen((o) => !o))}
        label={label}
        title={title}
        neu
        klein={klein}
        menuOffen={gesperrt ? undefined : offen}
        dataTour={dataTour}
        symbol={<Icon name="plus" size={16} stroke={2.4} />}
      />
      {offen && <MenueListe optionen={optionen} schliessen={() => setOffen(false)} />}
    </div>
  );
}
