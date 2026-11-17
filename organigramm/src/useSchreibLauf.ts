import { useCallback, useEffect, useRef, useState } from 'react';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { einrichtenAusfuehren } from './ladeSchreibLage';
import type { Eingabe, Lauf, SchrittErgebnis } from './einrichtenSchreiben';

/** Was die Fenster im Schritt „Fertig“ zeigen: es läuft (mit dem Stand der Schritte bis jetzt) – oder es ist vorbei. */
export type LaufStand =
  | { art: 'laeuft'; ergebnisse: readonly SchrittErgebnis[] }
  | { art: 'vorbei'; lauf: Lauf };

/**
 * **Ein Schreiben anstoßen und seinen Stand halten** (O9-5d) – für das Fenster „Einrichten / Stufen ändern“ und die
 * kurzen Fenster „Wechseltage nachtragen“ und „Rechte setzen“.
 *
 * - `starten()` ist auch „Nochmal versuchen“: Der Lauf liest alles neu und schreibt nur, was fehlt.
 * - **`ausgang`** wird nach jedem Lauf nachgeführt: Hat er die Einrichtung gespeichert, erwartet der nächste Versuch genau
 *   diese – nicht die, aus der das Fenster einmal geöffnet wurde (sonst sähe der eigene erste Versuch wie die Änderung
 *   eines anderen aus).
 * - `geschrieben()`: Hat es mindestens einen Lauf gegeben, der geschrieben haben kann? Dann lädt die Seite beim Schließen neu.
 */
export function useSchreibLauf(basis: Omit<Eingabe, 'ausgang'> & { ausgang: Einrichtung | null }) {
  const [stand, setStand] = useState<LaufStand | null>(null);
  const aktuell = useRef(basis);
  aktuell.current = basis;
  const ausgang = useRef(basis.ausgang);
  const schrieb = useRef(false);
  const lebt = useRef(true);
  useEffect(() => {
    lebt.current = true;
    return () => {
      lebt.current = false;
    };
  }, []);

  const starten = useCallback(async () => {
    setStand({ art: 'laeuft', ergebnisse: [] });
    let lauf: Lauf;
    try {
      lauf = await einrichtenAusfuehren(
        { ...aktuell.current, ausgang: ausgang.current },
        (ergebnisse) => {
          if (lebt.current) setStand({ art: 'laeuft', ergebnisse });
        },
      );
    } catch (e) {
      // Das Schreiben wirft nicht; käme doch etwas, wurde jedenfalls nichts bestätigt.
      lauf = { art: 'gestoppt', grund: fehlerMeldung(e).text, nochmal: true };
    }
    if (lauf.art === 'gelaufen') {
      schrieb.current = true;
      if (lauf.gespeichert) ausgang.current = lauf.gespeichert;
    }
    if (lebt.current) setStand({ art: 'vorbei', lauf });
  }, []);

  return { stand, starten, geschrieben: () => schrieb.current };
}
