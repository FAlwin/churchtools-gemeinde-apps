import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { knotenNachId, type Knoten } from '@shared/organigramm/gruppen';
import { ladeStart, type Start } from './start';
import { fehlendeNachladen, ladeMitglieder, type MitgliederDaten } from './ladeMitglieder';
import { Organigramm } from './Organigramm';
import { GruppenFenster } from './GruppenFenster';

/**
 * Das Organigramm in ChurchTools (Bauplan O2): erst Gruppen und Baum (schnell), dann die Mitglieder aller
 * Gruppen (gedrosselt) – der Baum steht schon, während sie laden. Scheitert der Start vorübergehend, gibt es
 * „Erneut versuchen“ statt eines halben Baums; scheitern einzelne Gruppen, sagt der Baum das dort.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [mitglieder, setMitglieder] = useState<MitgliederDaten | null>(null);
  const [offen, setOffen] = useState<number | null>(null);

  const mitgliederLaden = useCallback((s: Start) => {
    setMitglieder(null);
    ladeMitglieder(s.gruppen.map((g) => g.id)).then(setMitglieder, (e: unknown) =>
      setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, []);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart().then(
      (s) => {
        setStart(s);
        setZustand({ art: 'fertig', vorname: s.vorname, gemeinde: s.gemeinde });
        mitgliederLaden(s);
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [mitgliederLaden]);

  useEffect(laden, [laden]);

  const nachladen = useCallback(() => {
    if (!mitglieder) return;
    fehlendeNachladen(mitglieder).then(setMitglieder, (e: unknown) =>
      setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [mitglieder]);

  const knoten = useMemo(
    () => (start ? knotenNachId(start.baum) : new Map<number, Knoten>()),
    [start],
  );
  const offenerKnoten = offen === null ? undefined : knoten.get(offen);

  return (
    <ErweiterungsSeite app="Organigramm" zustand={zustand} onNochmal={laden}>
      {start && (
        <Organigramm
          start={start}
          mitglieder={mitglieder}
          onNachladen={nachladen}
          onGruppe={setOffen}
        />
      )}
      {start && offenerKnoten && (
        <GruppenFenster
          start={start}
          knoten={offenerKnoten}
          mitglieder={mitglieder}
          onGruppe={setOffen}
          onNachladen={nachladen}
          onSchliessen={() => setOffen(null)}
        />
      )}
    </ErweiterungsSeite>
  );
}
