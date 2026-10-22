import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import type { SitzungsGruppe } from '@shared/sitzungen/gruppen';
import { ladeStart } from './start';
import { Startseite } from './Startseite';

/**
 * Die Sitzungen in ChurchTools (Bauplan S1): vorerst der Kopf mit „Hallo …“ und „Deine Gruppen“. Scheitert das
 * Laden vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [gruppen, setGruppen] = useState<SitzungsGruppe[]>([]);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart().then(
      (s) => {
        setGruppen(s.gruppen);
        setZustand({ art: 'fertig', vorname: s.vorname, gemeinde: s.gemeinde });
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, []);

  useEffect(laden, [laden]);

  return (
    <ErweiterungsSeite app="Sitzungen" zustand={zustand} onNochmal={laden}>
      <Startseite gruppen={gruppen} />
    </ErweiterungsSeite>
  );
}
