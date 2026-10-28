import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ReiterLeiste } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { ladeStart, planbareDienstgruppen, type Start } from './start';
import { Startseite } from './Startseite';
import { Demnaechst } from './Demnaechst';
import { Planen } from './Planen';
import { Termine, type TermineZustand } from './Termine';
import { ladeTermine, ladeZeitraum, MAX_WOCHEN, WOCHEN_JE_SCHRITT } from './ladeTermine';
import {
  adresseFuer,
  adresseFuerTermin,
  ALLE_REITER,
  reiterAusAdresse,
  sichtbareReiter,
  terminAusAdresse,
  type ReiterId,
} from './reiter';
import { TerminAnsicht } from './TerminAnsicht';
import { leseAuswahl, merkeAuswahl } from './auswahl';
import { tagAusIso } from '@shared/ct/zeit';
import { entwurfAnschluss } from './ladeEntwuerfe';

/**
 * Der Dienstplaner in ChurchTools (Bauplan E2/E3): Start · Termine · Planen · Abwesenheiten. Am Computer
 * stehen die Reiter oben neben dem Namen, am Handy unten wie in der Musik-App (Entwurf v17).
 * Scheitert das Laden vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [hash, setHash] = useState(() => window.location.hash);
  const handy = useMedienAbfrage(HANDY_BREITE);
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

  // Global, als Leitung der Gruppe eines Dienstes – dieselbe Regel wie in der Matrix (`planbar`).
  const darfPlanen = !!start && planbareDienstgruppen(start).length > 0;
  // Eintragen als Entwurf (E4-3) – je Start einmal; die Schubladen gehören zu den planbaren Gruppen.
  const entwuerfe = useMemo(
    () => (start ? entwurfAnschluss(start, () => planbareDienstgruppen(start)) : undefined),
    [start],
  );
  const reiter = sichtbareReiter(darfPlanen);
  // Termin-Ansicht (E6-1b): eigene Adresse; hervorgehoben bleibt der Reiter, von dem man kam – dorthin führt „zurück“.
  const terminId = terminAusAdresse(hash);
  const herkunft = useRef<ReiterId>('start');
  if (terminId === null) herkunft.current = reiterAusAdresse(hash, reiter);
  const aktiv = terminId === null ? reiterAusAdresse(hash, reiter) : herkunft.current;

  const termineLaden = useCallback(
    (s: Start, w: number, still = false) => {
      // Still: beim Nachladen weiterer Wochen bleibt das Bisherige stehen, bis das Neue da ist.
      if (!still) setTermine({ art: 'laedt' });
      ladeTermine(s, w, zeitzone).then(
        (d) => setTermine({ art: 'fertig', zeilen: d.zeilen, plan: d.plan, wochen: w }),
        (e: unknown) =>
          setTermine((alt) =>
            still && alt?.art === 'fertig'
              ? { ...alt, nachladeFehler: fehlerMeldung(e) }
              : { art: 'fehler', fehler: fehlerMeldung(e) },
          ),
      );
    },
    [zeitzone],
  );
  // Ein gewählter Zeitraum der Matrix (Monat, von–bis) – eigene Abfrage, Start und Termine bleiben.
  const zeitraumLaden = useCallback(
    (von: string, bis: string) =>
      start ? ladeZeitraum(start, von, bis, zeitzone) : Promise.reject(new Error('kein Start')),
    [start, zeitzone],
  );

  // Start, Termine und Planen zeigen dieselben Termine – geladen wird einmal, wenn einer davon offen ist.
  useEffect(() => {
    if (aktiv !== 'abwesenheiten' && start && termine === null) {
      termineLaden(start, wochen);
    }
  }, [aktiv, start, termine, wochen, termineLaden]);
  // Was wirklich geladen ist – nach einem gescheiterten Nachladen steht `wochen` schon einen Schritt weiter.
  const geladen = termine?.art === 'fertig' ? termine.wochen : wochen;
  // „Weitere Termine laden“ – in Termine und Planen derselbe Schritt. Gezählt wird ab dem Geladenen: Schlägt
  // es fehl, bleibt `nachladeFehler` am alten Stand, und „Erneut versuchen“ lädt wieder genau einen Schritt.
  const mehrLaden = () => {
    if (!start) return;
    const w = geladen + WOCHEN_JE_SCHRITT;
    setWochen(w);
    termineLaden(start, w, true);
  };

  const wechseln = (id: ReiterId) => {
    window.location.hash = adresseFuer(id);
  };
  const terminZeigen = (id: number) => {
    window.location.hash = adresseFuerTermin(id);
  };
  // ‹ › in der Termin-Ansicht: die geladenen Termine in ihrer Reihenfolge (wie in Liste und Matrix).
  const reihe = termine?.art === 'fertig' ? termine.plan.spalten.map((sp) => sp.id) : [];
  const stelle = terminId === null ? -1 : reihe.indexOf(terminId);

  // Die Reiter erst zeigen, wenn klar ist, wer was darf – sonst taucht „Planen“ nachträglich auf.
  const fertig = zustand.art === 'fertig';
  const oben =
    fertig && !handy ? (
      <Segment
        value={aktiv}
        options={reiter.map((r) => ({ value: r.id, label: r.label }))}
        onChange={wechseln}
        ariaLabel="Bereiche"
        verbunden
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
      gruss={terminId === null && aktiv === 'start'}
      onNochmal={laden}
    >
      {start && terminId !== null && (
        <TerminAnsicht
          key={terminId}
          start={start}
          terminId={terminId}
          zeitzone={zeitzone}
          vorher={stelle > 0 ? reihe[stelle - 1] : null}
          nachher={stelle >= 0 && stelle < reihe.length - 1 ? reihe[stelle + 1] : null}
          zurueck={ALLE_REITER.find((r) => r.id === aktiv)?.label ?? 'Start'}
          onTermin={terminZeigen}
          onZurueck={() => wechseln(aktiv)}
        />
      )}
      {start && terminId === null && aktiv === 'start' && (
        <Startseite
          start={start}
          termine={termine}
          heute={tagAusIso(new Date().toISOString(), zeitzone)}
          onNochmal={() => termineLaden(start, wochen)}
          onTermin={terminZeigen}
          onMeineTermine={() => {
            merkeAuswahl({ ...leseAuswahl(), nurMeine: true });
            wechseln('termine');
          }}
        />
      )}
      {terminId === null && aktiv === 'termine' && termine && start && (
        <Termine
          onTermin={terminZeigen}
          zustand={termine}
          planer={darfPlanen}
          onNochmal={() => termineLaden(start, wochen)}
          onMehr={mehrLaden}
        />
      )}
      {terminId === null && aktiv === 'planen' && termine && start && (
        <Planen
          onTermin={terminZeigen}
          zustand={termine}
          handy={handy}
          onNochmal={() => termineLaden(start, wochen)}
          onMehr={mehrLaden}
          onAktualisieren={() => termineLaden(start, geladen, true)}
          mehrMoeglich={geladen < MAX_WOCHEN}
          ladeZeitraum={zeitraumLaden}
          heute={tagAusIso(new Date().toISOString(), zeitzone)}
          entwuerfe={entwuerfe}
        />
      )}
      {terminId === null && aktiv === 'abwesenheiten' && <Demnaechst reiter={aktiv} />}
    </ErweiterungsSeite>
  );
}
