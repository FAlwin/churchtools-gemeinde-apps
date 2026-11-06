import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { fehlerMeldung, type Fehlermeldung } from './fehlerMeldung';

/**
 * Was eine Abfrage gerade zeigt. `aus` = es gibt nichts zu laden (die Funktion gab `null`). `neuFehler` (nur mit
 * `behalten`): Das letzte Neuladen ist gescheitert – die Daten sind die bisherigen.
 */
export type Ladestand<T> =
  | { art: 'aus' }
  | { art: 'laedt' }
  | { art: 'fertig'; daten: T; neuFehler?: Fehlermeldung }
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
 *   (vorübergehend ist nicht ungültig); dann steht der Fehler als `neuFehler` daneben, wer will, zeigt ihn (Planen:
 *   der Fehlerkasten über der Tabelle wie bei „ab heute“, Alwin 06.11.2026). Auch `neu()` lädt dann leise. Als
 *   Funktion entscheidet `behalten(alt)` an den gehaltenen Daten, ob sie zum neuen Laden noch passen (Planen: derselbe
 *   Bereich oder der durch ＋ erweiterte – ein ganz anderer Zeitraum zeigt „lädt“). Nur, wo die alten Daten zu den
 *   neuen `deps` noch passen dürfen: derselbe Inhalt, frisch nachgefragt. Sonst sprängen Inhalt oder Bild bei jedem Nachfragen kurz weg (Gebetsabend: der
 *   Player würde neu aufgebaut).
 * - `setze(daten)`: Was gerade geschrieben wurde und dessen Antwort den neuen Stand schon enthält, gilt sofort – ohne
 *   noch einmal zu fragen (Protokolle: Anwesenheit nach einem Tipp). Nur, wenn nicht gerade geladen wird; sonst
 *   gewinnt die Antwort, die danach kommt. `setze((alt) => neu)` ändert die geladenen Daten – auch mehrmals kurz
 *   hintereinander, ohne dass eine Änderung die andere überschreibt; ist nichts geladen, bleibt alles, wie es ist
 *   (Dienstplaner: einen Entwurf übernehmen, ohne alles neu zu laden).
 */
export function useLaden<T>(
  laden: () => Promise<T> | null,
  deps: DependencyList,
  { behalten = false }: { behalten?: boolean | ((alt: T) => boolean) } = {},
): { stand: Ladestand<T>; neu: () => void; setze: (daten: T | ((alt: T) => T)) => void } {
  const [stand, setStand] = useState<Ladestand<T>>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);

  useEffect(() => {
    let aktuell = true;
    /** Mit `behalten` bleiben fertige Daten stehen – ein Fehler steht dann als `neuFehler` daneben. */
    const setze = (neu: Ladestand<T>) =>
      setStand((alt) => {
        if (alt.art !== 'fertig') return neu;
        if (!(typeof behalten === 'function' ? behalten(alt.daten) : behalten)) return neu;
        return neu.art === 'fehler' ? { ...alt, neuFehler: neu.fehler } : alt;
      });
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
  const setze = useCallback(
    (daten: T | ((alt: T) => T)) =>
      setStand((alt) => {
        if (typeof daten !== 'function') return { art: 'fertig', daten };
        return alt.art === 'fertig'
          ? { art: 'fertig', daten: (daten as (a: T) => T)(alt.daten) }
          : alt;
      }),
    [],
  );
  return { stand, neu, setze };
}
