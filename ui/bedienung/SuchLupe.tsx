import { useEffect, useRef } from 'react';
import { Icon } from '../icons/icons';
import { useEscape } from './useEscape';
import styles from './SuchLupe.module.scss';

/**
 * **Die Lupe im Kopf** (R7/E5/E11, „Ruhige Bedienung“ B1 – vorher `SuchLeiste` in den Protokollen, S3-4b, Alwin
 * 23.10.2026): ein Tipp klappt die Suchleiste neben den Reitern aus und setzt den Cursor ins Feld; ist die Zeile zu
 * schmal, bekommt sie eine eigene. ✕ oder Esc klappt sie zu – die App führt dann zur vorherigen Ansicht zurück und
 * leert den Begriff (`onSchliessen`). Aufgeklappt bleibt sie, bis jemand das tut: Wegklicken schließt nicht, auch ein
 * leeres Feld nicht.
 *
 * Die App hält den Zustand (`offen`, `begriff`) selbst, weil sie bei offener Suche den Inhalt durch die Treffer
 * ersetzt. Esc hört über `useEscape` (nur das oberste Blatt/Fenster reagiert; dieselbe Taste hat dort Vorrang).
 */
export function SuchLupe({
  offen,
  begriff,
  onOeffnen,
  onBegriff,
  onSchliessen,
  platzhalter = 'Suchen …',
}: {
  offen: boolean;
  begriff: string;
  onOeffnen: () => void;
  onBegriff: (b: string) => void;
  onSchliessen: () => void;
  /** Was gesucht wird („Beschlüsse, To-Dos, Protokolle …“) – das Feld sagt es, die Lupe allein nicht. */
  platzhalter?: string;
}) {
  useEscape(offen, onSchliessen);
  const feld = useRef<HTMLInputElement>(null);

  // Nach dem Aufklappen gleich tippen können.
  useEffect(() => {
    if (offen) feld.current?.focus();
  }, [offen]);

  if (!offen)
    return (
      <button type="button" className={styles.lupe} aria-label="Suchen" onClick={onOeffnen}>
        <Icon name="search" size={18} />
      </button>
    );

  return (
    <div className={styles.leiste} role="search">
      <Icon name="search" size={16} />
      <input
        ref={feld}
        type="search"
        aria-label="Suchbegriff"
        placeholder={platzhalter}
        value={begriff}
        onChange={(e) => onBegriff(e.target.value)}
      />
      <button type="button" aria-label="Suche schließen" onClick={onSchliessen}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
