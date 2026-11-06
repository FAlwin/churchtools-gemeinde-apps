import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { fehlerMeldung, type Fehlermeldung } from './fehlerMeldung';

/** Was eine Abfrage gerade zeigt. `aus` = es gibt nichts zu laden (die Funktion gab `null`). */
export type Ladestand<T> =
  | { art: 'aus' }
  | { art: 'laedt' }
  | { art: 'fertig'; daten: T }
  | { art: 'fehler'; fehler: Fehlermeldung };

/**
 * **Laden in den Erweiterungen** (#845) – EINE Regel statt eines handgeschriebenen `useEffect` mit `let aktuell = true`
 * je Stelle:
 *
 * - Geladen wird beim Öffnen und neu, sobald sich `deps` ändern – wie bei `useEffect`; die Prüfregel
 *   `react-hooks/exhaustive-deps` sieht `useLaden` mit an (`eslint.config.mjs`).
 * - Eine **späte Antwort** (die Abfrage zu alten `deps`, oder nach dem Schließen) zählt nicht mehr.
 * - Ein Fehler wird über `fehlerMeldung` beschrieben – dieselben Zweige wie überall (vorübergehend ≠ abgelehnt).
 * - `neu()` ist „Erneut versuchen“: zeigt wieder „lädt“ und fragt noch einmal.
 * - Gibt `laden` `null` zurück, gibt es nichts zu laden (`aus`) – etwa solange eine Auswahl fehlt.
 */
export function useLaden<T>(
  laden: () => Promise<T> | null,
  deps: DependencyList,
): { stand: Ladestand<T>; neu: () => void } {
  const [stand, setStand] = useState<Ladestand<T>>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);

  useEffect(() => {
    let aktuell = true;
    let abfrage: Promise<T> | null;
    try {
      abfrage = laden();
    } catch (e) {
      // Ein Fehler schon beim Aufrufen (nicht erst im Versprechen) ist derselbe Fehler.
      setStand({ art: 'fehler', fehler: fehlerMeldung(e) });
      return;
    }
    if (!abfrage) {
      setStand({ art: 'aus' });
      return;
    }
    setStand({ art: 'laedt' });
    abfrage.then(
      (daten) => aktuell && setStand({ art: 'fertig', daten }),
      (e: unknown) => aktuell && setStand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktuell = false;
    };
    // `laden` ist bei jedem Zeichnen neu – geladen wird nach den `deps` des Aufrufers (geprüft wie bei `useEffect`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versuch]);

  const neu = useCallback(() => setVersuch((v) => v + 1), []);
  return { stand, neu };
}
