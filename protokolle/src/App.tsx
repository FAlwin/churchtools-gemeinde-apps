import { useCallback, useEffect, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ReiterLeiste } from '@ui/bedienung/ReiterLeiste';
import { Segment } from '@ui/bedienung/Segment';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { adresseFuer, reiterAusAdresse } from '@ui/bedienung/reiterAdresse';
import { ladeStart, type Start } from './start';
import { Startseite } from './Startseite';
import { ToDos } from './ToDos';
import { Verwaltung } from './Verwaltung';
import { Sitzungen, type SitzungsAuswahl } from './Sitzungen';
import { SuchLeiste } from './SuchLeiste';
import { Suche } from './Suche';
import { sichtbareReiter, type ReiterId } from './reiter';

/**
 * Die Protokolle in ChurchTools (Bauplan S1/S2-2/S3-2/S7-1): Start, Sitzungen, To-Dos und – nur für Admins – Verwaltung. Am
 * Computer stehen die Reiter oben neben dem Namen, am Handy unten (wie im Dienstplaner).
 * Scheitert das Laden vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite. Ein Tipp auf der Startseite
 * (S3-3) öffnet den Reiter „Sitzungen“ mit der Gruppe – und, wenn gewählt, gleich der Sitzung. Die Lupe im Kopf
 * (S3-4b) klappt die Suche auf; solange sie offen ist, ersetzen ihre Treffer den Inhalt des Reiters.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [hash, setHash] = useState(() => window.location.hash);
  const [auswahl, setAuswahl] = useState<SitzungsAuswahl | null>(null);
  const [suche, setSuche] = useState<{ offen: boolean; begriff: string }>({
    offen: false,
    begriff: '',
  });
  const handy = useMedienAbfrage(HANDY_BREITE);

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
  const zu = () => setSuche({ offen: false, begriff: '' });
  const wechseln = (id: ReiterId) => {
    setAuswahl(null);
    zu();
    window.location.hash = adresseFuer(id, 'start');
  };
  const zuSitzungen = (a: SitzungsAuswahl) => {
    zu();
    setAuswahl(a);
    window.location.hash = adresseFuer('sitzungen', 'start');
  };

  // Reiter erst zeigen, wenn klar ist, wer was darf – und nur, wenn es mehr als einen gibt.
  const mitReitern = zustand.art === 'fertig' && reiter.length > 1;
  const lupe =
    zustand.art === 'fertig' ? (
      <SuchLeiste
        offen={suche.offen}
        begriff={suche.begriff}
        onOeffnen={() => setSuche({ offen: true, begriff: '' })}
        onBegriff={(begriff) => setSuche({ offen: true, begriff })}
        onSchliessen={zu}
      />
    ) : undefined;
  const oben = (
    <>
      {mitReitern && !handy && (
        <Segment
          value={aktiv}
          options={reiter.map((r) => ({ value: r.id, label: r.label }))}
          onChange={wechseln}
          ariaLabel="Bereiche"
          verbunden
        />
      )}
      {lupe}
    </>
  );
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
      gruss={aktiv === 'start' && !suche.offen}
      onNochmal={laden}
    >
      {start && suche.offen && (
        <Suche
          modul={start.modul}
          gruppen={start.gruppen}
          begriff={suche.begriff}
          onTreffer={(gruppe, sitzung, punkt) => zuSitzungen({ gruppe, sitzung, punkt })}
        />
      )}
      {start && !suche.offen && aktiv === 'start' && (
        <Startseite
          modul={start.modul}
          ich={{ person: start.id, name: start.vorname }}
          gruppen={start.gruppen}
          schreibbar={start.schreibbar}
          onSitzung={(gruppe, sitzung) => zuSitzungen({ gruppe, sitzung })}
          onGruppe={(gruppe) => zuSitzungen({ gruppe })}
          onAlleToDos={() => wechseln('todos')}
        />
      )}
      {start && !suche.offen && aktiv === 'todos' && (
        <ToDos
          modul={start.modul}
          ich={{ person: start.id, name: start.vorname }}
          gruppen={start.gruppen}
          schreibbar={start.schreibbar}
          onSitzung={(gruppe, sitzung) => zuSitzungen({ gruppe, sitzung })}
        />
      )}
      {start && !suche.offen && aktiv === 'sitzungen' && (
        <Sitzungen
          key={
            auswahl ? `${auswahl.gruppe}:${auswahl.sitzung ?? ''}:${auswahl.punkt ?? ''}` : 'reiter'
          }
          modul={start.modul}
          gruppen={start.gruppen}
          ich={{ person: start.id, name: start.vorname }}
          schreibbar={start.schreibbar}
          auswahl={auswahl}
        />
      )}
      {start && !suche.offen && aktiv === 'verwaltung' && <Verwaltung modul={start.modul} />}
    </ErweiterungsSeite>
  );
}
