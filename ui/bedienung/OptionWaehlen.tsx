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
            <button key={o.label} type="button" className={styles.option} onClick={o.onClick}>
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
 * abgeschlossener Ablauf – dann der Hinweis des Aufrufers).
 */
export function HinzufuegenMenue({
  label,
  optionen,
  gesperrt,
  dataTour,
}: {
  label: string;
  optionen: Option[];
  gesperrt?: () => void;
  dataTour?: string;
}) {
  // Auf, zu, Tipp daneben, Escape – derselbe Baustein wie Filter- und Zeitraum-Knopf.
  const { offen, setOffen, rahmen } = useAufklapp();
  return (
    <div className={styles.huelle} ref={rahmen}>
      <KopfKnopf
        onClick={() => (gesperrt ? gesperrt() : setOffen((o) => !o))}
        label={label}
        neu
        menuOffen={gesperrt ? undefined : offen}
        dataTour={dataTour}
        symbol={<Icon name="plus" size={16} stroke={2.4} />}
      />
      {offen && (
        <div className={styles.menue} role="menu" aria-label="Option wählen">
          {optionen.map((o) => (
            <button
              key={o.label}
              type="button"
              role="menuitem"
              className={styles.option}
              onClick={() => {
                setOffen(false);
                o.onClick();
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
