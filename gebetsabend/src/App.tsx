import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ladeStart, type Start } from './start';
import { Einrichtung } from './Einrichtung';

/**
 * Der Gebetsabend in ChurchTools (Bauplan Gebetsabend G1): vorerst nur der Stand der Einrichtung. Zuhören (G2) und
 * die Technik (G3) kommen dazu. Scheitert das Laden vorübergehend, gibt es „Erneut versuchen“ statt einer halben
 * Seite.
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
    <ErweiterungsSeite app="Gebetsabend" zustand={zustand} onNochmal={laden}>
      {start && <Einrichtung start={start} onEingerichtet={laden} />}
    </ErweiterungsSeite>
  );
}
