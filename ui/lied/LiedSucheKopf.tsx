/**
 * **Das eine Suchfeld** – im Liederheft, in „Lied hinzufügen" und in „Lied verknüpfen" (#378).
 *
 * Bis zum 03.09.2026 stand hier darunter ein Umschalter „Bibliothek · Liedtexte · SongSelect". Alwins
 * Rückmeldung: **ein** Suchfeld, die Bibliothek zuerst, die anderen Quellen erst, wenn man sie braucht.
 * Der Umschalter ist deshalb weg; die Quellen sind **Angebote unter der Liste** (`SucheAngebot`), und die
 * Regeln dazu liegen in `useLiedSuche`.
 *
 * Damit ist dieser Baustein wirklich nur noch das Feld – und genau deshalb kann ihn jetzt auch das
 * Liederheft nutzen, das bis dahin eine eigene Kopie desselben Markups hatte (`AllSongs.module.scss`,
 * `.search`). Zwei Suchfelder, die gleich aussehen sollen, sind eines zu viel.
 *
 * Was hier **nicht** liegt: die Trefferlisten. Die Bibliothek zeigt in jeder Ansicht etwas anderes (im
 * Liederheft mit „+"- und Stift-Knopf, in der Auswahl ohne), deshalb rendert sie der Aufrufer.
 */
import { FINGER_BEDIENUNG, useMedienAbfrage } from '../bedienung/useMedienAbfrage';
import { Icon } from '../icons/icons';
import styles from './LiedSucheKopf.module.scss';

interface LiedSucheKopfProps {
  eingabe: string;
  onEingabe: (wert: string) => void;
  /**
   * Die Eingabetaste schickt den Begriff an SongSelect – **nur**, wenn es SongSelect an dieser Stelle
   * gibt. Im Liederheft und in „Lied verknüpfen" fehlt der Weg, dort tut Enter nichts: Die Bibliothek
   * ist beim Tippen längst gefiltert.
   */
  onSongSelectSuchen?: () => void;
  /**
   * Das Feld beim Öffnen fokussieren – **nur mit Maus**. Am iPad/Handy ginge sonst sofort die Tastatur auf und
   * verdeckte die Liederliste (Alwin am iPad, 27.11.2026); dort öffnet erst der Tipp ins Feld die Tastatur.
   */
  autoFocus?: boolean;
}

export function LiedSucheKopf({
  eingabe,
  onEingabe,
  onSongSelectSuchen,
  autoFocus,
}: LiedSucheKopfProps) {
  const finger = useMedienAbfrage(FINGER_BEDIENUNG);
  return (
    <div className={styles.feld}>
      <Icon name="search" size={18} stroke={2} className={styles.lupe} />
      <input
        placeholder="Lied oder Autor suchen…"
        value={eingabe}
        autoFocus={autoFocus && !finger}
        onChange={(e) => onEingabe(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSongSelectSuchen) onSongSelectSuchen();
        }}
      />
    </div>
  );
}
