import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ladeStart, type Start } from './start';
import { Startseite } from './Startseite';

/**
 * Der Dienstplaner in ChurchTools (Bauplan E2): wer angemeldet ist, seine Gruppen und welche
 * Dienstgruppen er plant. Scheitert das Laden vorübergehend, gibt es „Erneut versuchen“ statt einer
 * halben Seite (`fehlerMeldung`).
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
    <ErweiterungsSeite app="Dienstplaner" zustand={zustand} onNochmal={laden}>
      {start && <Startseite start={start} />}
    </ErweiterungsSeite>
  );
}
