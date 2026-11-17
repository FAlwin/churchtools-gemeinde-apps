import { useCallback, useEffect, useState } from 'react';
import { isTourDone, markTourDone } from '../utils/onboarding';

/** Wie oft und wie lange nach dem Ziel gesucht wird – die Seite lädt ihre Daten erst nach dem Öffnen. */
const ABSTAND_MS = 300;
const VERSUCHE = 40; // zwölf Sekunden

/**
 * **Eine Einführung starten, sobald ihr Ziel auf dem Bildschirm steht** – und nur, wenn sie noch nicht gesehen wurde.
 *
 * Für Seiten, die ihre Ziele erst nach dem Laden zeigen und das nicht nach außen melden (die Seite „Ablaufvorlagen“ ist
 * ein geteilter Baustein aus `ui`, der Zustand liegt dort). Gesucht wird nach `selector` in kurzem Abstand, bis das Ziel
 * da ist oder die Zeit um – kommt es nie (kein Recht, Fehler beim Laden), bleibt die Einführung still und wird nicht als
 * gesehen verbucht; sie kommt beim nächsten Öffnen.
 *
 * `schluessel` wechselt mit der Seite (andere Vorlage, Liste ↔ Vorlage): Dann beginnt die Suche von vorn.
 */
export function useTourSobaldDa(
  tour: string,
  selector: string,
  schluessel?: unknown,
): { aktiv: boolean; schliessen: () => void } {
  const [aktiv, setAktiv] = useState(false);
  useEffect(() => {
    setAktiv(false);
    if (isTourDone(tour)) return;
    let versuche = 0;
    const timer = setInterval(() => {
      versuche++;
      if (document.querySelector(selector)) {
        clearInterval(timer);
        setAktiv(true);
      } else if (versuche >= VERSUCHE) {
        clearInterval(timer);
      }
    }, ABSTAND_MS);
    return () => clearInterval(timer);
  }, [tour, selector, schluessel]);
  const schliessen = useCallback(() => {
    markTourDone(tour);
    setAktiv(false);
  }, [tour]);
  return { aktiv, schliessen };
}
