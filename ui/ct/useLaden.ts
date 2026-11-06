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
 * - `behalten`: Beim **Neuladen** bleiben die alten Daten stehen, bis neue da sind – auch wenn das Neuladen scheitert
 *   (vorübergehend ist nicht ungültig). Nur, wo die alten Daten zu den neuen `deps` noch passen dürfen: derselbe
 *   Inhalt, frisch nachgefragt. Sonst sprängen Inhalt oder Bild bei jedem Nachfragen kurz weg (Gebetsabend: der
 *   Player würde neu aufgebaut).
 * - `setze(daten)`: Was gerade geschrieben wurde und dessen Antwort den neuen Stand schon enthält, gilt sofort – ohne
 *   noch einmal zu fragen (Protokolle: Anwesenheit nach einem Tipp). Nur, wenn nicht gerade geladen wird; sonst
 *   gewinnt die Antwort, die danach kommt.
 */
export function useLaden<T>(
  laden: () => Promise<T> | null,
  deps: DependencyList,
  { behalten = false }: { behalten?: boolean } = {},
): { stand: Ladestand<T>; neu: () => void; setze: (daten: T) => void } {
  const [stand, setStand] = useState<Ladestand<T>>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);

  useEffect(() => {
    let aktuell = true;
    /** Mit `behalten` bleiben fertige Daten stehen; sonst gilt der neue Stand. */
    const setze = (neu: Ladestand<T>) =>
      setStand((alt) => (behalten && alt.art === 'fertig' ? alt : neu));
    let abfrage: Promise<T> | null;
    try {
      abfrage = laden();
    } catch (e) {
      // Ein Fehler schon beim Aufrufen (nicht erst im Versprechen) ist derselbe Fehler.
      setze({ art: 'fehler', fehler: fehlerMeldung(e) });
      return;
    }
    if (!abfrage) {
      setStand({ art: 'aus' });
      return;
    }
    setze({ art: 'laedt' });
    abfrage.then(
      (daten) => aktuell && setStand({ art: 'fertig', daten }),
      (e: unknown) => aktuell && setze({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktuell = false;
    };
    // `laden` ist bei jedem Zeichnen neu – geladen wird nach den `deps` des Aufrufers (geprüft wie bei `useEffect`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versuch]);

  const neu = useCallback(() => setVersuch((v) => v + 1), []);
  const setze = useCallback((daten: T) => setStand({ art: 'fertig', daten }), []);
  return { stand, neu, setze };
}
