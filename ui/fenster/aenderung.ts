import { useState } from 'react';
import { fehlerMeldung } from '../ct/fehlerMeldung';
import styles from './Rueckgaengig.module.scss';

/**
 * **Was zuletzt geändert wurde – mit „Rückgängig“** (Alwin, 13.10.2026: „immer mit Warnungen und Rückgängig-Knöpfen“).
 * Aus den Anmeldungen (A3/A7) hierher gezogen, als das Organigramm (O5) dasselbe brauchte – EINE Umsetzung für alle
 * Erweiterungen. `rueckgaengig: null` = nicht umkehrbar (endgültig gelöscht).
 *
 * Nicht zu verwechseln mit `ui/bedienung/useRueckgaengig` (Ablauf): Das ist ein Angebot, das nach Sekunden
 * verschwindet; dieses hier bleibt stehen, solange das Fenster offen ist.
 */
export interface Aenderung {
  text: string;
  rueckgaengig: (() => Promise<void>) | null;
}

/** Der Ablauf von „Rückgängig“ – EINE Stelle für die Zeile im Fenster und die Leiste der Anmeldungen. */
export function useAenderungZurueck(aenderung: Aenderung, onRueckgaengig: () => void) {
  const [stand, setStand] = useState<'bereit' | 'arbeitet' | 'erledigt'>('bereit');
  const [fehler, setFehler] = useState<string | null>(null);

  async function zurueck() {
    if (!aenderung.rueckgaengig) return;
    setStand('arbeitet');
    setFehler(null);
    try {
      await aenderung.rueckgaengig();
      setStand('erledigt');
      onRueckgaengig();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setStand('bereit');
    }
  }
  return { stand, fehler, zurueck };
}

/** Knopf und Fehlerfarbe – auch für die Leiste der Anmeldungen. */
export const rueckgaengigStile = { knopf: styles.knopf, fehler: styles.fehler };
