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
import { Termine, type TermineZustand } from './Termine';
import { ladeTermine, WOCHEN_JE_SCHRITT } from './ladeTermine';
import { adresseFuer, reiterAusAdresse, sichtbareReiter, type ReiterId } from './reiter';
import { leseAuswahl, merkeAuswahl } from './auswahl';
import { tagAusIso } from '@shared/ct/zeit';

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
  // Termine erst laden, wenn jemand den Reiter öffnet; beim Wechseln bleiben sie erhalten.
  const [termine, setTermine] = useState<TermineZustand | null>(null);
  const [wochen, setWochen] = useState(WOCHEN_JE_SCHRITT);
  const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  const termineLaden = useCallback(
    (s: Start, w: number) => {
      setTermine({ art: 'laedt' });
      ladeTermine(s, w, zeitzone).then(
        (zeilen) => setTermine({ art: 'fertig', zeilen, wochen: w }),
        (e: unknown) => setTermine({ art: 'fehler', fehler: fehlerMeldung(e) }),
      );
    },
    [zeitzone],
  );

  // Start und Termine zeigen dieselbe Liste – geladen wird einmal, wenn einer der beiden offen ist.
  useEffect(() => {
    if ((aktiv === 'start' || aktiv === 'termine') && start && termine === null) {
      termineLaden(start, wochen);
    }
  }, [aktiv, start, termine, wochen, termineLaden]);
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
      {start && aktiv === 'start' && (
        <Startseite
          start={start}
          termine={termine}
          heute={tagAusIso(new Date().toISOString(), zeitzone)}
          onNochmal={() => termineLaden(start, wochen)}
          onMeineTermine={() => {
            merkeAuswahl({ ...leseAuswahl(), nurMeine: true });
            wechseln('termine');
          }}
        />
      )}
      {aktiv === 'termine' && termine && start && (
        <Termine
          zustand={termine}
          planer={darfPlanen}
          onNochmal={() => termineLaden(start, wochen)}
          onMehr={() => {
            const w = wochen + WOCHEN_JE_SCHRITT;
            setWochen(w);
            termineLaden(start, w);
          }}
        />
      )}
      {(aktiv === 'planen' || aktiv === 'abwesenheiten') && <Demnaechst reiter={aktiv} />}
    </ErweiterungsSeite>
  );
}
