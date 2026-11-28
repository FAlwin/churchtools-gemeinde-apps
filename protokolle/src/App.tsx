import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { SuchLupe } from '@ui/bedienung/SuchLupe';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { adresseFuer, reiterAusAdresse } from '@ui/bedienung/reiterAdresse';
import { ladeStart, type Start } from './start';
import { Startseite } from './Startseite';
import { ToDos } from './ToDos';
import { Verwaltung } from './Verwaltung';
import { Sitzungen, type SitzungsAuswahl } from './Sitzungen';
import { Suche } from './Suche';
import { Reihen } from './Reihen';
import { Termine } from './Termine';
import { protokollSchluessel } from '@shared/protokolle/sitzungen';
import { reiterMitZaehler, sichtbareReiter, sitzungAusAdresse, type ReiterId } from './reiter';
import { useFaellige } from './useFaellige';
import { ReiheBasis } from './themenreiheKontext';

/**
 * Die Protokolle in ChurchTools (Bauplan S1/S2-2/S3-2/S7-1): Start, Sitzungen, To-Dos, Reihen, Termine (W14) und – nur für Admins – Einstellungen. Am
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
    const folgen = () => {
      // Direktlink auf eine Sitzung (S6-2, „Protokoll öffnen“ im Beitrag): einmal lesen, die Sitzung öffnen, die Adresse
      // auf den Reiter zurücksetzen – sonst öffnete Neuladen später wieder diese Sitzung. Mit Pfad: ChurchTools setzt
      // `<base href>` auf die Instanz, ein nacktes `#/…` führte dorthin.
      const ziel = sitzungAusAdresse(window.location.hash);
      if (ziel) {
        setSuche({ offen: false, begriff: '' });
        setAuswahl({ gruppe: ziel.gruppe, sitzung: protokollSchluessel(ziel.sitzung) });
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${window.location.search}${adresseFuer<ReiterId>('sitzungen', 'start')}`,
        );
      }
      setHash(window.location.hash);
    };
    folgen();
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);

  const reiter = sichtbareReiter(start?.darfVerwalten ?? false);
  const aktiv = reiterAusAdresse<ReiterId>(hash, reiter, 'start');
  // Hinweis auf fällige To-Dos: Zähler am Reiter „To-Dos“ und Band auf der Startseite (Einstellung: Reiter „Einstellungen“).
  const faellig = useFaellige({
    modul: start?.modul ?? null,
    person: start?.id ?? null,
    gruppen: start?.gruppen ?? [],
    seiteLiefert: aktiv === 'start' || aktiv === 'todos' || aktiv === 'termine',
  });
  const mitZaehler = reiterMitZaehler(reiter, faellig.zahl);
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
      <SuchLupe
        platzhalter="Beschlüsse, To-Dos, Protokolle …"
        offen={suche.offen}
        begriff={suche.begriff}
        onOeffnen={() => setSuche({ offen: true, begriff: '' })}
        onBegriff={(begriff) => setSuche({ offen: true, begriff })}
        onSchliessen={zu}
      />
    ) : undefined;
  // Was der Baustein „Reihe“ aus dem Start braucht (`ReiheAnbieter`) – einmal hier, nicht an jedem Bildschirm durchgereicht.
  const reiheBasis = useMemo(
    () =>
      start
        ? {
            modul: start.modul,
            gruppen: start.gruppen,
            schreibbar: start.schreibbar,
            ich: { person: start.id, name: start.vorname },
            eventKalender: start.eventsAendern,
          }
        : null,
    [start],
  );
  const bereiche = mitReitern ? { reiter: mitZaehler, aktiv, onWechsel: wechseln } : undefined;

  return (
    <ReiheBasis.Provider value={reiheBasis}>
      <ErweiterungsSeite
        app="Protokolle"
        zustand={zustand}
        bereiche={bereiche}
        handy={handy}
        lupe={lupe}
        // „Hallo …“ nur auf Start – das entscheidet der Rahmen (erster Reiter aktiv); in der Suche nie.
        gruss={!suche.offen}
        onNochmal={laden}
      >
        {start && suche.offen && (
          <Suche
            modul={start.modul}
            gruppen={start.gruppen}
            begriff={suche.begriff}
            ich={start.id}
            schreibbar={start.schreibbar}
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
            faellige={faellig.faellige}
            vorlauf={faellig.vorlauf}
            onAufgaben={faellig.melden}
          />
        )}
        {start && !suche.offen && aktiv === 'todos' && (
          <ToDos
            modul={start.modul}
            ich={{ person: start.id, name: start.vorname }}
            gruppen={start.gruppen}
            schreibbar={start.schreibbar}
            onSitzung={(gruppe, sitzung) => zuSitzungen({ gruppe, sitzung })}
            onAufgaben={faellig.melden}
          />
        )}
        {start && !suche.offen && aktiv === 'reihen' && (
          <Reihen
            modul={start.modul}
            ich={{ person: start.id, name: start.vorname }}
            gruppen={start.gruppen}
            schreibbar={start.schreibbar}
            eventKalender={start.eventsAendern}
          />
        )}
        {start && !suche.offen && aktiv === 'termine' && (
          <Termine
            modul={start.modul}
            ich={{ person: start.id, name: start.vorname }}
            gruppen={start.gruppen}
            kalenderSchreiben={start.kalenderSchreiben}
            vorlagenSchreiben={start.vorlagenSchreiben}
            tagsVerwalten={start.tagsVerwalten}
            ressourcenBuchen={start.ressourcenBuchen}
            ressourcenVerwalten={start.ressourcenVerwalten}
            eventsAnlegen={start.eventsAnlegen}
            gruppentypenAnlegen={start.gruppentypenAnlegen}
            onZeigen={(gruppe, sitzung, punkt) => zuSitzungen({ gruppe, sitzung, punkt })}
            onAufgaben={faellig.melden}
          />
        )}
        {start && !suche.offen && aktiv === 'sitzungen' && (
          <Sitzungen
            key={
              auswahl
                ? `${auswahl.gruppe}:${auswahl.sitzung ?? ''}:${auswahl.punkt ?? ''}`
                : 'reiter'
            }
            modul={start.modul}
            gruppen={start.gruppen}
            ich={{ person: start.id, name: start.vorname }}
            vollerName={`${start.vorname} ${start.nachname}`.trim()}
            gemeinde={start.gemeinde}
            schreibbar={start.schreibbar}
            auswahl={auswahl}
          />
        )}
        {start && !suche.offen && aktiv === 'verwaltung' && (
          <Verwaltung modul={start.modul} onVorlauf={faellig.vorlaufSetzen} />
        )}
      </ErweiterungsSeite>
    </ReiheBasis.Provider>
  );
}
