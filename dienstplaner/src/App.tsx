import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ReiterLeiste } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { darfDienstgruppePlanen } from '@shared/ct/dienstRechte';
import { ladeStart, type Start } from './start';
import { Startseite } from './Startseite';
import { Demnaechst } from './Demnaechst';
import { adresseFuer, reiterAusAdresse, sichtbareReiter, type ReiterId } from './reiter';

/**
 * Der Dienstplaner in ChurchTools (Bauplan E2/E3): Start · Termine · Planen · Abwesenheiten. Am Computer
 * stehen die Reiter oben neben dem Namen, am Handy unten wie in der Musik-App (Entwurf v17).
 * Scheitert das Laden vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [hash, setHash] = useState(() => window.location.hash);
  const handy = useMedienAbfrage('(max-width: 759px)');

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

  useEffect(() => {
    const folgen = () => setHash(window.location.hash);
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);

  const darfPlanen =
    !!start && start.dienstgruppen.some((g) => darfDienstgruppePlanen(start.rechte, g.id));
  const reiter = sichtbareReiter(darfPlanen);
  const aktiv = reiterAusAdresse(hash, reiter);
  const wechseln = (id: ReiterId) => {
    window.location.hash = adresseFuer(id);
  };

  // Die Reiter erst zeigen, wenn klar ist, wer was darf – sonst taucht „Planen“ nachträglich auf.
  const fertig = zustand.art === 'fertig';
  const oben =
    fertig && !handy ? (
      <Segment
        value={aktiv}
        options={reiter.map((r) => ({ value: r.id, label: r.label }))}
        onChange={wechseln}
        ariaLabel="Bereiche"
      />
    ) : undefined;
  const unten =
    fertig && handy ? (
      <ReiterLeiste reiter={reiter} aktiv={aktiv} onWechsel={wechseln} />
    ) : undefined;

  return (
    <ErweiterungsSeite
      app="Dienstplaner"
      zustand={zustand}
      reiter={oben}
      unten={unten}
      gruss={aktiv === 'start'}
      onNochmal={laden}
    >
      {start && aktiv === 'start' && <Startseite start={start} />}
      {aktiv !== 'start' && <Demnaechst reiter={aktiv} />}
    </ErweiterungsSeite>
  );
}
