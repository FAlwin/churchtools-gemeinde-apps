import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { KEINE_SCHRIFT, schriftspeicher, type Schriftspeicher } from './schriftLader';

/**
 * **Die Schriften, die die Vorschau gerade braucht** (`dateien` = die Dateien der gewählten Schriften,
 * `schriftDateien` in `@shared/website/schriften`). Lädt sie über den Zwischenspeicher (nur diese, nie alle) und liefert die
 * `schriftAdresse` für den Renderer – bis eine Datei da ist `data:,` (Ersatzschrift). Ändert sich, was geladen ist, bekommt der
 * Aufrufer eine neue Funktion und zeichnet neu.
 *
 * `fehler`: Eine der gebrauchten Schriften ließ sich nicht laden – leiser Hinweis; `nochmal()` versucht es erneut. Der
 * Versuch wiederholt sich auch von selbst, sobald sich die Wahl ändert oder die Vorschau neu erscheint.
 */
export function useSchriften(
  dateien: readonly string[],
  speicher: Schriftspeicher = schriftspeicher,
) {
  const schluessel = dateien.join('|');
  const [versuch, setVersuch] = useState(0);
  const stand = useSyncExternalStore(speicher.abonnieren, speicher.schnappschuss);

  useEffect(() => {
    speicher.anfordern(schluessel === '' ? [] : schluessel.split('|'));
  }, [speicher, schluessel, versuch]);

  const adresse = useCallback(
    (datei: string) => speicher.adresse(datei) ?? KEINE_SCHRIFT,
    // `stand` ändert sich, wenn etwas geladen ist – dann muss die Vorschau eine neue Funktion sehen.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gewollt: neue Funktion bei neuem Stand
    [speicher, stand],
  );
  const fehler = dateien.some((d) => speicher.gescheitertFuer(d));
  const nochmal = useCallback(() => setVersuch((v) => v + 1), []);
  return { adresse, fehler, nochmal };
}
