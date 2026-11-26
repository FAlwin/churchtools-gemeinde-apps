import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { LiedZugriffKontext } from '@ui/lied/liedZugriff';
import { dienstplanerLiedZugriff, liedAbfragen } from './liedZugriff';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import {
  eigeneDienste,
  eigeneDienstgruppen,
  ladeStart,
  planbareDienstgruppen,
  vorlageBearbeitbar,
  type Start,
} from './start';
import { vorlagenZugriff } from './vorlagenZugriff';
import { Startseite } from './Startseite';
import { Abwesenheiten } from './Abwesenheiten';
import { Planen } from './Planen';
import { katalogAus } from './planEntwuerfe';
import { ladeTerminVorlagen } from './ladeBeiwerk';
import { ladePersonen } from './ladePersonen';
import { ladeAntworten } from './ladeAntworten';
import { ERINNERN } from './ladeErinnern';
import { ladeAbfragen, speichereAbfragen } from './ladeAbfragen';
import { ladeRegeln, nurAbwesendAus } from './useAbfrageRegeln';
import { antwortenAblageStand, richteAntwortenEin } from './ladeVerfuegbarkeit';
import { ctAutomatikAnschluss, ctEinrichtenAnschluss } from './einrichtenAbfragen';
import { gruppenIdsDerDienste } from '@shared/dienstplan/abfrageAutomatik';
import { Termine, type TermineZustand } from './Termine';
import { ladeTermine, ladeZeitraum, MAX_WOCHEN, WOCHEN_JE_SCHRITT } from './ladeTermine';
import {
  ADRESSE_EINSTELLUNGEN,
  ADRESSE_VORLAGEN,
  adresseFuer,
  adresseFuerTermin,
  adresseFuerVorlage,
  abwesenheitenAbfrageAusAdresse,
  ALLE_REITER,
  planenGruppeAusAdresse,
  reiterAusAdresse,
  sichtbareReiter,
  terminAusAdresse,
  liveAusAdresse,
  adresseFuerLive,
  istEinstellungenAdresse,
  vorlagenAusAdresse,
  type ReiterId,
} from './reiter';
import { VorlagenBereich } from '@ui/ablauf/VorlagenBereich';
import { infoGruppen, siehtAlleDienstgruppen } from '@shared/ct/dienstRechte';
import { TerminAnsicht } from './TerminAnsicht';
import { useAntworten } from './useAntworten';
import { useTausch } from './useTausch';
import { useVertretung } from './useVertretung';
import { mitAntworten } from '@shared/dienstplan/antworten';
import type { TerminZeile } from '@shared/dienstplan/termine';
import { leseAuswahl, merkeAuswahl } from './auswahl';
import { gemeindeZeitzone, heuteImKalender } from '@shared/ct/zeit';
import { entwurfAnschluss } from './ladeEntwuerfe';
import type { AbfrageAnschluss } from './AbfrageFenster';
import { EinstellungenSeite } from './EinstellungenSeite';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { MeineAnzeigeAnschluss } from './MeineAnzeigeAnschluss';

/** Solange keine Termine da sind – ein fester Wert, damit `useVertretung` nicht bei jedem Zeichnen neu rechnet. */
const KEINE_ZEILEN: TerminZeile[] = [];

/**
 * Der Dienstplaner in ChurchTools (Bauplan E2/E3): Start · Termine · Planen · Verfügbarkeit Am Computer
 * stehen die Reiter oben neben dem Namen, am Handy unten wie in der Musik-App (Entwurf v17).
 * Scheitert das Laden vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  // „Einstellungen“ (V-6): der letzte Reiter öffnet die Seite `#/einstellungen`. Hat sie Ungespeichertes (die Seite meldet
  // es), fragen Reiterklick und „Zurück“ nach: `ziel` ist die Adresse, zu der es dann ginge.
  const einstellungenGeaendert = useRef(false);
  const [ziel, setZiel] = useState<string | null>(null);
  // Der Platz der Lupe im Seitenkopf (R7) – Planen hängt „Person hervorheben“ dort ein.
  const [lupeOrt, setLupeOrt] = useState<HTMLElement | null>(null);
  const [hash, setHash] = useState(() => window.location.hash);
  const handy = useMedienAbfrage(HANDY_BREITE);
  // Termine erst laden, wenn jemand den Reiter öffnet; beim Wechseln bleiben sie erhalten.
  const [termine, setTermine] = useState<TermineZustand | null>(null);
  const [wochen, setWochen] = useState(WOCHEN_JE_SCHRITT);
  const zeitzone = gemeindeZeitzone();
  // Die Liedauswahl im Punkt-Fenster (LW2b) – mit den Lied-Rechten aus dem Start.
  // Die eigenen Dienstgruppen – dorthin gehören Ja/Vielleicht in „Verfügbarkeit“. Eine feste Liste je Start.
  const eigeneGruppen = useMemo(() => (start ? eigeneDienstgruppen(start) : []), [start]);
  // Die eigenen Dienste – daraus wählt man in „Verfügbarkeit“ bei der Notiz „nur bestimmte Dienste“ (E5c-2).
  const meineDienste = useMemo(
    () => (start ? eigeneDienste(start).map((d) => ({ id: d.id, name: d.name })) : []),
    [start],
  );
  const liedZugriff = useMemo(() => dienstplanerLiedZugriff(start?.lieder?.rechte), [start]);

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

  // Die zuletzt angenommene Adresse – `hashchange` kennt die alte nicht mehr.
  const angenommen = useRef(window.location.hash);
  useEffect(() => {
    const folgen = () => {
      const neu = window.location.hash;
      // „Zurück“ (oder eine andere Adresse) weg von `#/einstellungen` mit Ungespeichertem: Adresse zurücksetzen und fragen.
      // Das Zurücksetzen löst selbst ein `hashchange` aus – das zeigt wieder auf `#/einstellungen`, ist also kein
      // „Weg von“ und fragt nicht noch einmal (keine Schleife). `angenommen` bleibt dabei auf der Einstellungen-Seite.
      if (
        istEinstellungenAdresse(angenommen.current) &&
        !istEinstellungenAdresse(neu) &&
        einstellungenGeaendert.current
      ) {
        window.location.hash = angenommen.current;
        setZiel(neu);
        return;
      }
      angenommen.current = neu;
      setHash(neu);
    };
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);
  const einstellungenMelden = useCallback((g: boolean) => {
    einstellungenGeaendert.current = g;
  }, []);

  // Der Anschluss zu den Abfragen – einmal gebaut für Startseite, Planen und Einstellungen (R-2 bis R-4); gebraucht wird er
  // nur mit `start`, davor stehen die Platzhalter nirgends in der Oberfläche.
  const abfrageAnschluss: AbfrageAnschluss = useMemo(
    () => ({
      lesen: ladeAbfragen,
      speichern: speichereAbfragen,
      ablageStand: antwortenAblageStand,
      automatik: ctAutomatikAnschluss(),
      ich: {
        personId: start?.ichId ?? 0,
        name: start ? [start.vorname, start.nachname].filter(Boolean).join(' ') : '',
      },
    }),
    [start],
  );
  // Der Anschluss zum Einrichten der Erinnerungen in ChurchTools (R-5a) – derselbe Speicher der Abfragen.
  const ctEinrichten = useMemo(
    () =>
      ctEinrichtenAnschluss(abfrageAnschluss, {
        stand: antwortenAblageStand,
        anlegen: (g) => richteAntwortenEin([g]),
      }),
    [abfrageAnschluss],
  );
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
  // Planen mit einer Gruppe von der Startseite (Wunsch 7) – nur für diesen Besuch.
  const fokusGruppe = planenGruppeAusAdresse(hash);
  // „Verfügbarkeit“ mit einer Abfrage (R-3): `#/abwesenheiten?abfrage=<Dienstgruppe>`.
  const abfrageGruppe = abwesenheitenAbfrageAusAdresse(hash);
  // Die Seite „Ablaufvorlagen“ (E10-V3a): eine Unterseite von „Planen“, nur für den, der „Planen“ sieht. Ohne das Recht
  // gilt die Adresse als unbekannt und führt zum Start.
  const vorlagenAdresse = darfPlanen && terminId === null ? vorlagenAusAdresse(hash) : null;
  // Die Einstellungen-Seite (V-6): `reiterAusAdresse` kennt die Adresse nicht und liefert „Start“ – darum hier zuerst
  // fragen. Auf der Seite feuert KEIN Zweig der Startseite (nicht zeigen, keine Termine laden, kein „Hallo“, keine Vertretung).
  const einstellungenSeite = terminId === null && istEinstellungenAdresse(hash);
  const hauptSicht = terminId === null && vorlagenAdresse === null && !einstellungenSeite;
  const herkunft = useRef<ReiterId>('start');
  // Die genaue Adresse, von der man kam – „zurück“ aus der Termin-Ansicht führt in Planen mit einer Gruppe (Wunsch 7)
  // wieder dorthin, nicht in die gewohnte Ansicht.
  const herkunftAdresse = useRef('');
  if (terminId === null) {
    herkunft.current = reiterAusAdresse(hash, reiter);
    herkunftAdresse.current = fokusGruppe !== null ? hash : adresseFuer(herkunft.current);
  }
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
  // Ein gewählter Zeitraum der Matrix (Monat, von–bis) – eigene Abfrage, Start und Dienste (Reiter `termine`) bleiben.
  const zeitraumLaden = useCallback(
    (von: string, bis: string) =>
      start ? ladeZeitraum(start, von, bis, zeitzone) : Promise.reject(new Error('kein Start')),
    [start, zeitzone],
  );

  // Mitglieder und Abwesenheiten für die Ansicht „Personen“ – stabil, solange der Start gleich bleibt (die Ansicht lädt
  // nach Gruppen und Zeitraum, nicht bei jedem Zeichnen).
  const personenLaden = useCallback(
    (gruppen: readonly number[], von: string, bis: string) =>
      start
        ? ladePersonen(gruppen, { von, bis, abwesenheitenAller: start.rechte.abwesenheitenAller })
        : Promise.reject(new Error('kein Start')),
    [start],
  );

  // Die Antworten aus „Verfügbarkeit“ für „Personen“ (E5c-3) – nur die Dienstgruppen, die man planen darf: Fremde Antworten
  // zeigt die App sonst nur Planern. Mitglieder lesen nur die Markierungen „Vertretung gesucht“ ihrer eigenen Dienstgruppen
  // (E5c-6, `useVertretung`). Stabil, solange der Start gleich bleibt.
  // Mit den Antworten kommt je Dienstgruppe die Art der Abfrage (V-5): Bei „Nur abwesend“ zeigt Planen keine Ja/Vielleicht.
  const antwortenLaden = useCallback(
    async (ids: readonly number[]) => {
      if (!start) throw new Error('kein Start');
      const gruppen = planbareDienstgruppen(start).filter((g) => ids.includes(g.id));
      const [antworten, regeln] = await Promise.all([
        ladeAntworten(gruppen),
        ladeRegeln(
          ladeAbfragen,
          gruppen.map((g) => g.id),
          heuteImKalender(),
        ),
      ]);
      return { ...antworten, nurAbwesend: nurAbwesendAus(regeln) };
    },
    [start],
  );

  // Start, Termine und Planen zeigen dieselben Termine – geladen wird einmal, wenn einer davon offen ist.
  useEffect(() => {
    if (aktiv !== 'abwesenheiten' && !einstellungenSeite && start && termine === null) {
      termineLaden(start, wochen);
    }
  }, [aktiv, einstellungenSeite, start, termine, wochen, termineLaden]);
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

  // Weg von der Einstellungen-Seite mit Ungespeichertem: erst fragen. Sonst direkt.
  const gehen = (adresse: string) => {
    if (istEinstellungenAdresse(window.location.hash) && einstellungenGeaendert.current) {
      setZiel(adresse);
    } else {
      window.location.hash = adresse;
    }
  };
  const wechseln = (id: ReiterId) => gehen(adresseFuer(id));
  // „Verwerfen und wechseln“: die Seite verliert ihren Stand mit dem Gehen – erst dann gilt sie als ungeändert.
  const verwerfenUndGehen = () => {
    const adresse = ziel;
    setZiel(null);
    einstellungenGeaendert.current = false;
    if (adresse !== null) window.location.hash = adresse;
  };
  const terminZeigen = (id: number) => {
    window.location.hash = adresseFuerTermin(id);
  };
  // „Live-Ansicht“ auf der Startseite: dieselbe Termin-Ansicht, die Live-Ansicht gleich offen – kein zweiter Weg.
  const liveZeigen = (id: number) => {
    window.location.hash = adresseFuerLive(id);
  };
  // Anfragen beantworten (E7-1): Startseite und „Dienste“ teilen einen Zustand; nach jeder Antwort leise neu laden.
  // Dienste tauschen (E7-3): nach einem Tausch die Termine neu; nach jeder Antwort auch den Tausch-Stand – die
  // Einteilung hat dann eine neue ID, und ein Ausgang hängt an ihr.
  const tausch = useTausch(start?.ichId ?? 0, zeitzone, () => {
    if (start) termineLaden(start, geladen, true);
  });
  const antworten = useAntworten(start?.ichId ?? 0, () => {
    if (start) termineLaden(start, geladen, true);
    tausch.neuLaden();
  });
  // Die Termine mit den eben gegebenen Antworten – zehn Minuten lang mit „Rückgängig“ (`mitAntworten`).
  // Nur neu bauen, wenn sich etwas ändert – „Dienste“ erkennt ein laufendes Nachladen am selben Zustand (Objekt).
  const termineSicht: TermineZustand | null = useMemo(() => {
    if (termine?.art !== 'fertig') return termine;
    return { ...termine, zeilen: mitAntworten(termine.zeilen, antworten.karte, antworten.jetzt) };
  }, [termine, antworten.karte, antworten.jetzt]);

  // Vertretung suchen (E5c-6): „Für dich offen“ lädt die Antworten der eigenen Dienstgruppen, solange die Startseite offen ist;
  // nach einer Suche oder einem Übernehmen die Termine leise neu.
  const vertretung = useVertretung({
    start,
    zeilen: termineSicht?.art === 'fertig' ? termineSicht.zeilen : KEINE_ZEILEN,
    heute: heuteImKalender(),
    aktiv: aktiv === 'start' && terminId === null && !einstellungenSeite,
    onGeaendert: () => {
      if (start) termineLaden(start, geladen, true);
    },
  });

  // ‹ › in der Termin-Ansicht: die geladenen Termine in ihrer Reihenfolge (wie in Liste und Matrix).
  const reihe = termine?.art === 'fertig' ? termine.plan.spalten.map((sp) => sp.id) : [];
  const stelle = terminId === null ? -1 : reihe.indexOf(terminId);

  // Die Reiter erst zeigen, wenn klar ist, wer was darf – sonst taucht „Planen“ nachträglich auf.
  const fertig = zustand.art === 'fertig';
  const bereiche = fertig ? { reiter, aktiv, onWechsel: wechseln } : undefined;

  return (
    <QueryClientProvider client={liedAbfragen}>
      <LiedZugriffKontext.Provider value={liedZugriff}>
        <ErweiterungsSeite
          app="Dienstplaner"
          zustand={zustand}
          bereiche={bereiche}
          handy={handy}
          // „Einstellungen“ ist der letzte Reiter (R13) – alle sehen ihn, ändern dürfen Planer (die Seite prüft es).
          einstellungen={
            start
              ? {
                  onOeffnen: () => {
                    window.location.hash = ADRESSE_EINSTELLUNGEN;
                  },
                  offen: einstellungenSeite,
                }
              : undefined
          }
          // Die Lupe „Person hervorheben“ (R7/E5) sitzt rechts neben den Reitern – nur in Planen. Planen hängt sie in diesen
          // Platz (`createPortal`); `display: contents`, damit der Platz selbst keine Fläche einnimmt.
          lupe={
            !handy && aktiv === 'planen' && terminId === null && vorlagenAdresse === null ? (
              <span ref={setLupeOrt} style={{ display: 'contents' }} />
            ) : undefined
          }
          // „Hallo …“ nur auf Start – das entscheidet der Rahmen (erster Reiter aktiv); in der Termin-Ansicht und auf der
          // Einstellungen-Seite nie (dort ist `aktiv` „Start“, weil die Adresse unbekannt ist).
          gruss={terminId === null && !einstellungenSeite}
          onNochmal={laden}
        >
          {start && (
            <MeineAnzeigeAnschluss person={start.ichId}>
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
                  onZurueck={() => {
                    window.location.hash = herkunftAdresse.current;
                  }}
                  // Infos oder Dateien geändert: Start, Termine und Planen zeigen dieselben Termine – leise neu, sonst stünde
                  // in der Matrix bis zum Neuladen der Seite noch der alte Stand (Test-Instanz T2b, 03.11.2026).
                  onGeaendert={() => termineLaden(start, geladen, true)}
                  tausch={tausch}
                  vertretung={vertretung}
                  entwuerfe={entwuerfe}
                  ladeAntworten={antwortenLaden}
                  heute={heuteImKalender()}
                  handy={handy}
                  liveStart={liveAusAdresse(hash)}
                />
              )}
              {start && vorlagenAdresse !== null && (
                <VorlagenBereich
                  zugriff={vorlagenZugriff}
                  darfIn={(kalenderId) => vorlageBearbeitbar(start, kalenderId)}
                  dienste={[...start.dienste.values()].map((d) => ({ id: d.id, name: d.name }))}
                  // Infos je Dienstgruppe wie in `TerminAblauf`; die Spalten-Wahl gehört der Vorlagen-Seite allein.
                  infoGruppen={infoGruppen(start.rechte, start.dienstgruppen)}
                  gruppenVerborgen={!siehtAlleDienstgruppen(start.rechte, start.dienstgruppen)}
                  infoSpaltenSchluessel="dienstplaner.vorlage.infoSpalten"
                  offeneId={vorlagenAdresse.id}
                  onOeffnen={(id) => {
                    window.location.hash = id === null ? ADRESSE_VORLAGEN : adresseFuerVorlage(id);
                  }}
                  zurueck={{ label: 'Planen', onClick: () => wechseln('planen') }}
                />
              )}
              {start && hauptSicht && aktiv === 'start' && (
                <Startseite
                  start={start}
                  termine={termineSicht}
                  antworten={antworten}
                  tausch={tausch}
                  vertretung={vertretung}
                  zeitzone={zeitzone}
                  heute={heuteImKalender()}
                  onNochmal={() => termineLaden(start, wochen)}
                  onTermin={terminZeigen}
                  onLive={liveZeigen}
                  abfrage={{
                    anschluss: abfrageAnschluss,
                    ladeZeitraum: zeitraumLaden,
                    ladePersonen: personenLaden,
                    ladeAntworten: antwortenLaden,
                  }}
                  onMeineTermine={() => {
                    merkeAuswahl({ ...leseAuswahl(), nurMeine: true });
                    wechseln('termine');
                  }}
                />
              )}
              {hauptSicht && aktiv === 'termine' && termine && start && (
                <Termine
                  onTermin={terminZeigen}
                  zustand={termineSicht ?? termine}
                  antworten={antworten}
                  tausch={tausch}
                  vertretung={vertretung}
                  zeitzone={zeitzone}
                  ich={{
                    id: start.ichId,
                    name: [start.vorname, start.nachname].filter(Boolean).join(' '),
                    gemeinde: start.gemeinde,
                  }}
                  planer={darfPlanen}
                  handy={handy}
                  onNochmal={() => termineLaden(start, wochen)}
                  onMehr={mehrLaden}
                />
              )}
              {hauptSicht && aktiv === 'planen' && termine && start && (
                <Planen
                  // Neu aufbauen, wenn der Besuch beginnt oder endet – sonst bliebe sein Zeitraum stehen.
                  key={fokusGruppe ?? 'gewohnt'}
                  fokusGruppe={fokusGruppe}
                  onFokusEnde={() => wechseln('planen')}
                  onTermin={terminZeigen}
                  zustand={termine}
                  handy={handy}
                  onNochmal={() => termineLaden(start, wochen)}
                  onMehr={mehrLaden}
                  onAktualisieren={() => termineLaden(start, geladen, true)}
                  mehrMoeglich={geladen < MAX_WOCHEN}
                  ladeZeitraum={zeitraumLaden}
                  heute={heuteImKalender()}
                  entwuerfe={entwuerfe}
                  ablauf={{ start, zeitzone }}
                  katalog={katalogAus(start)}
                  ladeVorlagen={ladeTerminVorlagen}
                  ladePersonen={personenLaden}
                  ladeAntworten={antwortenLaden}
                  ladeMarkierungen={antwortenLaden}
                  erinnern={ERINNERN}
                  abfragen={abfrageAnschluss}
                  onVorlagen={() => {
                    window.location.hash = ADRESSE_VORLAGEN;
                  }}
                  lupeOrt={lupeOrt}
                />
              )}
              {hauptSicht && aktiv === 'abwesenheiten' && start && (
                <Abwesenheiten
                  ichId={start.ichId}
                  zeitzone={zeitzone}
                  heute={heuteImKalender()}
                  dienstgruppen={eigeneGruppen}
                  eigeneDienste={meineDienste}
                  start={start}
                  abfrageGruppe={abfrageGruppe}
                />
              )}
              {start && einstellungenSeite && (
                <EinstellungenSeite
                  darfAendern={darfPlanen}
                  ich={{ personId: start.ichId, name: start.vorname }}
                  abfragen={{
                    anschluss: abfrageAnschluss,
                    gruppen: planbareDienstgruppen(start),
                    heute: heuteImKalender(),
                    einrichten: {
                      darf: start.verwalten === true,
                      anschluss: ctEinrichten,
                      gruppenIds: (id) => gruppenIdsDerDienste(start.dienste.values(), id),
                    },
                  }}
                  onGeaendert={einstellungenMelden}
                />
              )}
              {ziel !== null && (
                <ConfirmDialog
                  title="Änderungen verwerfen?"
                  message="Die Einstellungen sind noch nicht gespeichert. Beim Wechsel gehen die Änderungen verloren."
                  confirmLabel="Verwerfen und wechseln"
                  onConfirm={verwerfenUndGehen}
                  onCancel={() => setZiel(null)}
                />
              )}
            </MeineAnzeigeAnschluss>
          )}
        </ErweiterungsSeite>
      </LiedZugriffKontext.Provider>
    </QueryClientProvider>
  );
}
