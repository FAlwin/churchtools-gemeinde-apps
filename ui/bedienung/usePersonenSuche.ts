import { useState } from 'react';
import { fehlerMeldung } from '../ct/fehlerMeldung';
import { personenSuchen, type Gefunden } from '../ct/personen';

/** Kürzer sucht ChurchTools nicht sinnvoll – der Knopf bleibt bis dahin gesperrt. */
export const SUCHE_MIN = 2;

/**
 * **Zustand einer Personensuche**: Suchtext, Treffer, „sucht gerade“ und die Fehlermeldung. Die eine Logik hinter
 * `PersonenSuche`; einzeln nutzbar, wo die Oberfläche ganz anders aussieht.
 */
export function usePersonenSuche() {
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Gefunden[] | null>(null);
  const [sucht, setSucht] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const suchen = async () => {
    setSucht(true);
    setFehler(null);
    try {
      setTreffer(await personenSuchen(suche));
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    } finally {
      setSucht(false);
    }
  };
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
