import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ladeStart, type Start } from './start';
import { Uebersicht } from './Uebersicht';

/**
 * Das Organigramm in ChurchTools (Bauplan O1): vorerst nur die Übersicht der Bereiche. Scheitert das Laden
 * vorübergehend, gibt es „Erneut versuchen“ statt eines halben Baums.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart().then(
      (s) => {
        setStart(s);
        setZustand({ art: 'fertig', vorname: s.vorname, gemeinde: s.gemeinde });
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, []);

  useEffect(laden, [laden]);

  return (
    <ErweiterungsSeite app="Organigramm" zustand={zustand} onNochmal={laden}>
      {start && <Uebersicht start={start} />}
    </ErweiterungsSeite>
  );
}
