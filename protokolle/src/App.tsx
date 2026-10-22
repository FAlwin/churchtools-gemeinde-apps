import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ReiterLeiste } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { adresseFuer, reiterAusAdresse } from '@ui/bedienung/reiterAdresse';
import { ladeStart, type Start } from './start';
import { Startseite } from './Startseite';
import { Verwaltung } from './Verwaltung';
import { sichtbareReiter, type ReiterId } from './reiter';

/**
 * Die Protokolle in ChurchTools (Bauplan S1/S2-2): Start und – nur für Admins – Verwaltung. Am Computer stehen die
 * Reiter oben neben dem Namen, am Handy unten (wie im Dienstplaner); wer nur „Start“ hat, sieht keine Reiter.
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

  const reiter = sichtbareReiter(start?.darfVerwalten ?? false);
  const aktiv = reiterAusAdresse<ReiterId>(hash, reiter, 'start');
  const wechseln = (id: ReiterId) => {
    window.location.hash = adresseFuer(id, 'start');
  };

  // Reiter erst zeigen, wenn klar ist, wer was darf – und nur, wenn es mehr als einen gibt.
  const mitReitern = zustand.art === 'fertig' && reiter.length > 1;
  const oben =
    mitReitern && !handy ? (
      <Segment
        value={aktiv}
        options={reiter.map((r) => ({ value: r.id, label: r.label }))}
        onChange={wechseln}
        ariaLabel="Bereiche"
        verbunden
      />
    ) : undefined;
  const unten =
    mitReitern && handy ? (
      <ReiterLeiste reiter={reiter} aktiv={aktiv} onWechsel={wechseln} />
    ) : undefined;

  return (
    <ErweiterungsSeite
      app="Protokolle"
      zustand={zustand}
      reiter={oben}
      unten={unten}
      gruss={aktiv === 'start'}
      onNochmal={laden}
    >
      {start && aktiv === 'start' && <Startseite gruppen={start.gruppen} />}
      {start && aktiv === 'verwaltung' && <Verwaltung modul={start.modul} />}
    </ErweiterungsSeite>
  );
}
