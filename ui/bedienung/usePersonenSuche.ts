import { useCallback, useEffect, useRef, useState } from 'react';
import { fehlerMeldung } from '../ct/fehlerMeldung';
import { personenSuchen, type Gefunden } from '../ct/personen';

/** Kürzer sucht ChurchTools nicht sinnvoll – der Knopf bleibt bis dahin gesperrt. */
export const SUCHE_MIN = 2;

/** „Beim Tippen“: so lange nach dem letzten Zeichen wartet die Suche, bevor sie ChurchTools fragt. */
export const SUCHE_VERZOEGERUNG_MS = 300;

/**
 * **Zustand einer Personensuche**: Suchtext, Treffer, „sucht gerade“ und die Fehlermeldung. Die eine Logik hinter
 * `PersonenSuche`; einzeln nutzbar, wo die Oberfläche ganz anders aussieht.
 *
 * Zwei Bedienarten: **mit Knopf** (Standard – `suchen()` ruft die Oberfläche) und **`beimTippen`**: ab `SUCHE_MIN`
 * Zeichen sucht der Hook selbst, `SUCHE_VERZOEGERUNG_MS` nach dem letzten Zeichen. In beiden gilt: **nur die jüngste
 * Antwort zählt** – eine späte Antwort auf „Al“ überschreibt nie die Treffer für „Alwin“.
 */
export function usePersonenSuche({ beimTippen = false }: { beimTippen?: boolean } = {}) {
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Gefunden[] | null>(null);
  const [sucht, setSucht] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Zählt die Suchläufe: Nur die Antwort des jüngsten Laufs darf Treffer, Fehler und „sucht“ setzen.
  const lauf = useRef(0);
  const suchenNach = useCallback(async (text: string) => {
    const nr = ++lauf.current;
    setSucht(true);
    setFehler(null);
    try {
      const gefunden = await personenSuchen(text);
      if (nr === lauf.current) setTreffer(gefunden);
    } catch (e) {
      if (nr === lauf.current) setFehler(fehlerMeldung(e).text);
    } finally {
      if (nr === lauf.current) setSucht(false);
    }
  }, []);
  const suchen = () => suchenNach(suche);
  useEffect(() => {
    if (!beimTippen) return;
    if (suche.trim().length < SUCHE_MIN) {
      // Zu kurz: laufende Suchen verwerfen und die alten Treffer wegnehmen.
      lauf.current++;
      setTreffer(null);
      setSucht(false);
      setFehler(null);
      return;
    }
    const uhr = setTimeout(() => void suchenNach(suche), SUCHE_VERZOEGERUNG_MS);
    return () => clearTimeout(uhr);
  }, [suche, beimTippen, suchenNach]);
  return {
    suche,
    setSuche,
    treffer,
    sucht,
    fehler,
    suchen,
    kannSuchen: !sucht && suche.trim().length >= SUCHE_MIN,
  };
}

/** Was `usePersonenSuche` liefert – zum Weiterreichen an `PersonenSuche`. */
export type PersonenSucheZustand = ReturnType<typeof usePersonenSuche>;
