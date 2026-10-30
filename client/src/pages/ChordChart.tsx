import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { BlattKopf, type BlattKopfAngaben } from '../components/BlattKopf';
import type { LeistenLied } from '../components/AblaufLeiste';
import { leistenTipp } from '../utils/werkzeuge';
import { ChartFooter } from '../components/ChartFooter';
import { ChartOverlays } from '../components/ChartOverlays';
import { useChartOverlay } from '../hooks/useChartOverlay';
import { useTempoSteuerung } from '../hooks/useTempoSteuerung';
import { useLokaleUmzuege } from '../hooks/useLokaleUmzuege';
import { useWerkzeugSteuerung } from '../hooks/useWerkzeugSteuerung';
import { TempoMenu } from '../components/TempoMenu';
import { ImportPreviewBar, ViewingBanner } from '../components/ChartTeamNotesBars';
import { Icon } from '@ui/icons/icons';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { PageDeck } from '../components/PageDeck';
import { ScrollDeck } from '../components/ScrollDeck';
import { SCROLL_START, type ScrollPosition } from '../utils/scrollPosition';
import { getLiedansicht } from '../utils/devicePrefs';
import type { PedalRichtung } from '../utils/pedalTasten';
import { useSongSettings } from '../hooks/useSongSettings';
import { useLandscape } from '../hooks/useLandscape';
import { useAppVollbild } from '../hooks/useAppVollbild';
import { Coachmarks } from '../components/Coachmarks';
import {
  chartSchritte,
  HINT_VOLLBILD,
  TOUR_CHART,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import { VIEW_NS } from '../services/teamNotes';
import {
  anmerkungsquelleFuer,
  drawKeyForPage,
  pageLabelFor,
  viewKeyForPage,
  zoomKeyBaseForPage,
} from '../utils/chartPageKeys';
import { SharersSheet } from '../components/SharersSheet';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { deriveActiveSongView } from '../utils/activeSongView';
import { chartHead } from '../utils/chordPdf';
import { pdfOptionsForSong } from '../utils/chartPdfOptions';
import { ablaufPdfBauen } from '../utils/ablaufPdf';
import { eigeneEbene } from '../utils/anmerkungsEbene';
import { dokumentSeiten } from '../utils/dokumentSeiten';
import { ladeDokument } from '../services/fileDownload';
import { TeilenFenster, type GebautesPdf } from '../components/TeilenFenster';
import { DEFAULT_SETTINGS } from '../utils/chartSettings';
import { useTeamNotesImport } from '../hooks/useTeamNotesImport';
import { useChartNavigation } from '../hooks/useChartNavigation';
import { useChartEditor } from '../hooks/useChartEditor';
import { useAppLogo } from '../hooks/useAppLogo';
import { useChartStream } from '../hooks/useChartStream';
import { useChartSync, useResyncAfterEditor } from '../hooks/useChartSync';
import {
  useArrangementUeberschreibung,
  useArrangementVorladen,
} from '../hooks/useArrangementUeberschreibung';
import { setArrangementTempo } from '../services/churchtoolsApi';
import { ArrangementFilesSheet } from '../components/ArrangementFilesSheet';
import { EditSongSheet } from '../components/EditSongSheet';
import { useArrangementDateien } from '../hooks/useArrangementDateien';
import { loeschFrage } from '../utils/dateiVerwaltung';
import { useSetlistPages } from '../hooks/useSetlistPages';
import { useCapabilities, useSongArrangements, useSongUsage } from '../hooks/useServices';
import { useLiedinfoQuelle } from '../hooks/useLiedinfoQuelle';
import type { DrawTool } from '../types/index';
import { beschreibeEbene, type NamenQuelle } from '../utils/annotationLevelLabel';
import styles from './ChordChart.module.scss';

/**
 * Vier Anmerkungsfarben (ECG-Palette): Rot, Blau, Grün (Türkis), Orange.
 * Modul-Konstante, damit die Liste nicht bei jedem Render neu entsteht – sie geht als Prop an
 * `PageDeck` weiter und würde dort sonst bei jedem Render als „geändert" gelten.
 */
const DRAW_COLORS = ['#bb2946', '#0062ac', '#1bb0a2', '#fb8f00'];

interface ChordChartProps {
  songs: SetlistSong[];
  startIndex: number;
  /** Titel und Zurück-Ziel der Kopfkarte – aus dem Ablauf der Termin, aus der Liederliste das Lied (Scheibe B1). */
  kopf: BlattKopfAngaben;
  onBack: () => void;
  onReload?: () => void;
  /** Darf der Nutzer den ChordPro-Text bearbeiten? (blendet Editor-Funktionen aus) */
  canEditSong?: boolean;
  /**
   * Darf das Tempo in ChurchTools speichern? Eigenes Recht (`canEditTempo`): In der ChurchTools-
   * Extension geht das schon, während die Liedverwaltung noch fehlt (#335).
   */
  canEditTempo?: boolean;
  /** Darf Team-Notizen nutzen (eigene teilen + geteilte anderer ansehen)? */
  canUseGlobalNotes?: boolean;
  /** Hat die Gemeinde CCLI SongSelect? (#322) Ohne das erscheint der Einstieg gar nicht. */
  canUseCcli?: boolean;
}

/**
 * Lied-Anzeige als durchgehender PDF-Seitenstrom über den ganzen Ablauf.
 * Hochformat: 1 Seite. Querformat: 2 Seiten nebeneinander (auch über Liedgrenzen).
 * Die angetippte Hälfte ist „aktiv" und bestimmt, worauf Kopfzeile/Menüs wirken.
 */
export function ChordChart({
  songs: songsAusAblauf,
  startIndex,
  kopf,
  onBack,
  onReload,
  canEditSong = false,
  canEditTempo = false,
  canUseGlobalNotes = false,
  canUseCcli = false,
}: ChordChartProps) {
  // Anzeige-Einstellungen aller Lieder – Halten und Speichern liegt in useSongSettings (#198).
  const { settings, updateSetting, selectVersion, reloadSettings } =
    useSongSettings(songsAusAblauf);

  /**
   * Ein selbst gewähltes Arrangement einsetzen (#320).
   *
   * Ab hier heißt die Liste wieder `songs` – alles darunter arbeitet unverändert mit dem, was
   * WIRKLICH gilt, und muss nichts von der Überschreibung wissen. Während des Ladens (und bei einem
   * Fehlschlag) bleibt es beim Eintrag aus dem Ablauf, damit die Seiten nicht verschwinden.
   */
  const { songs, laedt: arrangementLaedt } = useArrangementUeberschreibung(
    songsAusAblauf,
    settings,
  );

  // Versions- und Arrangement-Umzug der lokalen Schlüssel – vor dem Zeichnen (`useLokaleUmzuege`).
  useLokaleUmzuege(songsAusAblauf, songs, reloadSettings);
  // Signatur über den INHALT aller Versionen → der Strom wird neu erzeugt, sobald sich ein Lied-Text
  // ändert (z. B. nach dem Bearbeiten/Anlegen einer Version), nicht nur bei geänderter Lied-Liste.
  const songsSig = songs
    .map(
      (s) =>
        `${s.id}:${s.chordpro?.length ?? 0}:${s.versions.map((v) => v.key + v.text.length).join('|')}`,
    )
    .join(',');

  const [drawMode, setDrawMode] = useState(false);
  /** Rückfrage vor dem Holen aus SongSelect (#322) – es ersetzt ein vorhandenes Notenblatt. */
  const [songSelectFrage, setSongSelectFrage] = useState(false);
  /**
   * Auffrischen im Hintergrund (Erst-Sync, 30-s-/60-s-Takt, Rückkehr zur App) – in `useChartSync`.
   *
   * Die Liste der Teilenden gehört zum Erst-Sync, `refreshSharers` entsteht aber erst weiter unten
   * in `useTeamNotesImport`, das seinerseits `setSyncTick` von hier braucht. Der Rückruf zeigt
   * deshalb über eine Ref auf die dann vorhandene Funktion; gelesen wird sie erst im Effekt, also
   * lange nach dem Render.
   */
  const teamNotizenNachlauf = useRef<(() => void) | null>(null);
  const { syncTick, setSyncTick, bumpSync } = useChartSync({
    songs,
    songsSig,
    drawMode,
    onReload,
    reloadSettings,
    onAfterInitialPull: () => teamNotizenNachlauf.current?.(),
  });

  // Alle Fenster als EIN Zustand (#283) samt der abgeleiteten Werte – in `useChartOverlay`.
  const { overlay, setOverlay, toggleOverlay, chartOverlay, offenesWerkzeug, liedFensterOffen } =
    useChartOverlay();

  const { toast, showToast } = useToast();
  // ── Team-Notizen (#124, PCO-Modell): „Notizen von …" ansehen + übernehmen ──
  // Ganzer Ansehen-/Import-Zustand samt abgeleiteter effSettings gekapselt in useTeamNotesImport.
  // Import-Vorschau: das Chart zeigt LIVE das Ergebnis (merge = eigene + fremde Ebene übereinander,
  // replace = nur die fremde); unten schwebt die Vorschau-Leiste mit Umschalter + Übernehmen.
  const {
    viewing,
    pickerPerson,
    setPickerPerson,
    sharers,
    showSharers,
    setShowSharers,
    viewMode,
    setViewMode,
    effSettings,
    refreshSharers,
    openPersonLevels,
    viewLevel,
    stopViewing,
    mirrorGroups,
    groupKeyOf,
    importFrom,
    openSharers,
    openLevels,
  } = useTeamNotesImport({
    songs,
    settings,
    reloadSettings,
    setSyncTick,
    setDrawMode,
    showToast,
  });
  // Erst jetzt steht `refreshSharers` – der Erst-Sync greift über die Ref darauf zu (siehe oben).
  teamNotizenNachlauf.current = canUseGlobalNotes ? refreshSharers : null;

  // Geführte Einführung Chart-Ansicht (#Onboarding, Gruppe 2): startet beim ersten Öffnen, sobald
  // die Seiten gerendert sind (dann existieren die hervorzuhebenden Elemente).
  const [chartTour, setChartTour] = useState(false);
  // Anmerkungs-Farben: feste ECG-Palette (unten `DRAW_COLORS`), plus der freie Farbwähler in der
  // Leiste. Kein Weiß und kein Dunkelmodus-Wechsel – gezeichnet wird immer auf weißen PDF-Seiten.
  const [drawColor, setDrawColor] = useState('#0062ac'); // Standard-Anmerkungsfarbe: Blau
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [streamZoomed, setStreamZoomed] = useState(false); // eine sichtbare Seite (Strom oder Dokument) ist reingezoomt
  /**
   * Vollbild: Kopf- und Fußzeile ausgeblendet (#319). Ein Tipp in die Mitte schaltet um.
   *
   * Bewusst NICHT gemerkt – wie der Tempo-Puls ein Werkzeug für den Moment. Wer das Liederheft neu
   * öffnet, findet die Leisten wieder vor; sonst stünde man beim nächsten Mal vor einem Blatt ohne
   * jede Bedienung und wüsste nicht, warum.
   */
  const [leistenAus, setLeistenAus] = useState(false);
  // Vollbild der ganzen App (nur Erweiterung) – ein Werkzeug im Kopf, getrennt vom Tipp in die Mitte.
  const [vollbildAn, vollbildUmschalten] = useAppVollbild();
  // Erhöhen → die verfügbare Fläche hat sich geändert (Leisten umgeschaltet, #319). PageDeck baut
  // daraufhin die Zoom-Ebene neu auf, damit sie die neue Höhe vermisst, und passt eine vergrößerte
  // Seite ein – ohne den gespeicherten Zoom zu vergessen.

  // ── Durchgehender Seitenstrom: alle Lieder zu EINER PDF (mit Seiten-Besitzer) ──
  // Aufbau in `useChartStream` – bewusst NACH dem Zeichnen, mit stehenbleibendem
  // altem Ergebnis (#197).
  const logo = useAppLogo();
  // Scroll-Modus (#551) – Erklärung unten bei der Navigation. Hier schon gebraucht: Im Scroll-Modus ist
  // jedes Lied EINE lange Seite (#607).
  const [scrollModus] = useState(() => getLiedansicht() === 'scrollen');
  const stream = useChartStream({
    songs,
    songsSig,
    settings: effSettings,
    logo,
    rolle: scrollModus,
  });

  // Durchgehender Strom: Akkord- UND Dokument-Seiten in Setlist-Reihenfolge zu EINER Seiten-Liste
  // (jedes Lied steuert je nach viewSource seine Akkorde ODER sein hochgeladenes Dokument bei).
  const {
    pages,
    owners,
    publishedSettings,
    loading: pagesLoading,
    error: pagesError,
  } = useSetlistPages({
    chordPdfData: stream?.data ?? null,
    chordOwners: stream?.owners ?? [],
    songs,
    settings: effSettings,
    // Ein gewähltes Dokument, das nicht geladen werden konnte, fällt auf die Akkorde zurück – das
    // soll der Nutzer erfahren, statt sich zu fragen, warum sein PDF nicht kommt (#251).
    onDocError: (titel) =>
      showToast(
        titel.length === 1
          ? `Das Dokument zu „${titel[0]}" konnte nicht geladen werden – es werden die Akkorde gezeigt.`
          : `${titel.length} Dokumente konnten nicht geladen werden – es werden die Akkorde gezeigt.`,
      ),
  });

  // Akkord-Datei nicht ladbar (#274): Vorher blieb das Blatt einfach leer. Der Server sagt jetzt, ob
  // der Fehlschlag vorübergehend war (ein echtes 404 zählt nicht) – dann bekommt der Nutzer eine
  // Meldung statt einer leeren Seite. Je Lied nur EINMAL, sonst poppt es bei jedem Blättern wieder.
  const gemeldeteLadefehler = useRef(new Set<number>());
  useEffect(() => {
    const offen = songs.filter((s) => s.chordproFailed && !gemeldeteLadefehler.current.has(s.id));
    if (offen.length === 0) return;
    for (const s of offen) gemeldeteLadefehler.current.add(s.id);
    showToast(
      offen.length === 1
        ? `Die Akkorde zu „${offen[0].title}" konnten nicht geladen werden. Bitte später erneut versuchen.`
        : `${offen.length} Lieder konnten nicht geladen werden. Bitte später erneut versuchen.`,
    );
  }, [songs, showToast]);

  // Einführung Chart-Ansicht beim ersten Mal starten – erst wenn die Seiten fertig gerendert sind.
  useEffect(() => {
    if (!pagesLoading && pages.length > 0 && !isTourDone(TOUR_CHART)) setChartTour(true);
  }, [pagesLoading, pages.length]);

  // Blättern/Ausrichtung/Tastatur. Tastatur-Navigation pausiert, solange Editor oder Zeichenmodus
  // offen sind (per Ref übergeben, weil `showEditor` erst unten aus dem Editor-Hook kommt).
  const navBlockedRef = useRef(false);
  /**
   * Scroll-Modus (#551): Seiten untereinander statt blättern – eine Vorliebe dieses Geräts (Mehr →
   * Liedansicht). Beim Öffnen gelesen; geändert wird sie nur unter „Mehr", also nie bei offenem Lied.
   * Das Pedal scrollt dann einen Schritt (`schrittRef`, von `ScrollDeck` abgelegt), statt zu blättern.
   * Seit #607 ist jedes Lied eine lange Seite; die Anmerkungen sind die der A4-Seiten (#614), gemalt
   * wird direkt darauf (#608, `ScrollDeck` → `RollenMalen`). `scrollPos` hält die Stelle über einen
   * Neuaufbau der Seiten hinweg.
   */
  const schrittRef = useRef<((richtung: PedalRichtung) => void) | null>(null);
  const scrollPos = useRef<ScrollPosition>(SCROLL_START);
  const { pageIdx, activeIdx, atStart, atEnd, next, prev, goToSong, setPage, setActivePage } =
    useChartNavigation({
      owners,
      startIndex,
      blockedRef: navBlockedRef,
      pedal: scrollModus ? (r) => schrittRef.current?.(r) : undefined,
    });

  const activeSongIdx = owners[activeIdx]?.songIdx ?? 0;
  const song = songs[activeSongIdx] ?? songs[songs.length - 1];

  /**
   * Die Arrangements des AKTIVEN Lieds – nur geladen, wenn es überhaupt mehrere hat (#320).
   *
   * Nicht für alle Lieder des Ablaufs auf einmal: Das wären bei einem Gottesdienst mit acht Liedern
   * acht Abrufe für ein Menü, das man vielleicht nie öffnet. Die Zahl steht schon im Lied
   * (`arrangementCount`), die Namen holt erst der Bedarf.
   */
  const arrangements = useSongArrangements(song.arrangementCount > 1 ? song.id : null);
  // „Zuletzt gesungen“ oben im Lied-Menü (Alwin, 30.10.2026) – dieselbe Statistik und dasselbe Recht wie in den
  // Liederlisten. `undefined` = nicht verfügbar (kein Recht, lädt, Fehler) → keine Zeile; `null` = noch nie gesungen.
  const rechte = useCapabilities(true);
  const nutzung = useSongUsage(rechte.data?.canViewSongStatistics ?? false);
  const zuletztGesungen = nutzung.data ? (nutzung.data[song.id]?.dates[0] ?? null) : undefined;

  /**
   * Welches Arrangement steht im ABLAUF? Die Wahl darauf wird als „keine eigene Wahl" gespeichert –
   * ändert das Team den Ablauf später, folgt die App wieder, statt an einer Nummer festzuhalten,
   * die einmal die richtige war.
   */
  const ablaufArrangement = songsAusAblauf[activeSongIdx]?.arrangementId ?? song.arrangementId;

  /**
   * Dateiverwaltung des aktiven Arrangements (#321) – Abruf und Aktionen in `useArrangementDateien`.
   *
   * `aktiv` erst beim Öffnen des Blattes: Es ist ein zusätzlicher Abruf gegen ChurchTools, und im
   * Gottesdienst braucht ihn niemand. Genau an vermeidbaren Abrufen ist die App einmal in ein
   * Rate-Limit gelaufen (#300).
   */
  const datei = useArrangementDateien({
    songId: song.id,
    arrangementId: song.arrangementId,
    aktiv: overlay === 'files',
    showToast,
    onReload,
  });

  /**
   * Die anderen Arrangements vorladen, sobald das Lied-Menü offen ist (#320).
   *
   * Gemeldet als „dauert super lange, bis das neue ChordPro-Dokument erscheint". Gemessen liegt die
   * Zeit NICHT im Neuaufbau der Seiten (357 ms gegen den Test-Server, davon 6 ms Abruf), sondern im
   * Abruf gegen echtes ChurchTools: Der Server holt dort das Lied UND lädt die Datei herunter. Steht
   * das Blatt schon im Zwischenspeicher, ist der Wechsel sofort da.
   */
  useArrangementVorladen(
    song.id,
    (arrangements.data ?? []).map((a) => a.arrangementId).filter((id) => id !== song.arrangementId),
    overlay === 'menu',
  );
  const set = effSettings[song.id] ?? DEFAULT_SETTINGS;
  // Ansehen gilt pro Lied: Blättert man zu einem anderen Lied, endet es automatisch.
  useEffect(() => {
    if (viewing && song.id !== viewing.songId) stopViewing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);
  // Darstellung/Version/Quelle DESSELBEN Lieds gewechselt → Anmerkungsmodus beenden: Die Notiz-
  // Ebene wechselt mit, ein noch aktiver Stift würde sonst im Umbau-Moment in die falsche Ebene
  // schreiben. (Liedwechsel beim Blättern lässt den Modus bewusst an.)
  const lastViewSig = useRef<{ songId: number; sig: string } | null>(null);
  useEffect(() => {
    const sig = `${set.versionKey}|${set.lyricsOnly ? 1 : 0}|${set.viewSource}`;
    const prev = lastViewSig.current;
    if (prev && prev.songId === song.id && prev.sig !== sig) setDrawMode(false);
    lastViewSig.current = { songId: song.id, sig };
  }, [song.id, set.versionKey, set.lyricsOnly, set.viewSource]);
  // Personen, die Anmerkungen ZUM AKTIVEN Lied teilen (für den Wähler).
  const songSharers = sharers.filter((p) => p.songs.includes(song.id));

  // Aktuell SICHTBARE Lieder (fürs Fußzeilen-Punkte-Highlight): im Querformat 2 Seiten → bis zu
  // 2 Lieder nebeneinander, beide markieren. matchMedia('orientation') ist beim Wechsel stabil.
  const landscape = useLandscape();
  // Zwei Seiten nebeneinander gibt es nur beim Blättern im Querformat – im Scroll-Modus steht eine
  // Seite in voller Breite (#551), und die sichtbare ist die aktive (`pageIdx` ist dort im Querformat
  // auf die vorletzte Seite begrenzt und taugt nicht).
  const nebeneinander = landscape && !scrollModus;
  const sichtSeite = scrollModus ? activeIdx : pageIdx;
  const visibleSongIdx = new Set<number>();
  if (owners[sichtSeite]) visibleSongIdx.add(owners[sichtSeite].songIdx);
  if (nebeneinander && owners[pageIdx + 1]) visibleSongIdx.add(owners[pageIdx + 1].songIdx);
  if (visibleSongIdx.size === 0) visibleSongIdx.add(activeSongIdx);

  // ── abgeleitete Werte des AKTIVEN Lieds ──
  // Rein und getestet in `utils/activeSongView` (#314): Tonart, Kapo-Griffe, Versionen, gewähltes
  // Dokument, Editor-Vorlage und die Info-Zeile im Kopf.
  const {
    curKey,
    shapeKey,
    versions,
    currentVersion,
    isOriginal,
    hasVersions,
    displayedChordpro,
    notierteTonart,
    sections,
    editorTemplate,
    activeDoc,
    headInfo,
  } = deriveActiveSongView(song, set);

  // Was die Werkzeug-Knöpfe tun – in `useWerkzeugSteuerung`.
  const werkzeug = useWerkzeugSteuerung({
    setOverlay,
    setDrawMode,
    viewing: viewing !== null,
    openSharers,
    stopViewing,
    vollbildUmschalten,
  });

  /**
   * **Die Lieder der Ablauf-Leiste** (Scheibe B2) – jedes mit DEMSELBEN Titel wie auf seinem Blatt: über `chartHead`
   * aus dem angezeigten Text (auch einer Version), nicht über `song.title`. Bis zum 13.08.2026 gab es zwei Wege zur
   * Überschrift, und bei einem Lied mit App-Version standen zwei verschiedene übereinander (Alwin, überzählige
   * Klammer aus dem CCLI-Original). Die Leiste ist der dritte Ort – gleiche Regel.
   */
  const leistenLieder: LeistenLied[] = useMemo(
    () =>
      songs.map((s, idx) => ({
        idx,
        titel: chartHead({
          title: s.title,
          author: s.author,
          chordpro: deriveActiveSongView(s, effSettings[s.id] ?? DEFAULT_SETTINGS)
            .displayedChordpro,
        }).title,
      })),
    [songs, effSettings],
  );

  /** Ein Tipp in der Leiste: gewähltes → Lied-Menü, anderes sichtbares → wählen, sonst → hinspringen (B2). */
  const liedTipp = (idx: number) => {
    const was = leistenTipp(idx, {
      gewaehlt: activeSongIdx,
      sichtbar: visibleSongIdx,
      ansehen: viewing !== null,
    });
    if (was === 'nichts') return;
    if (was === 'menue') {
      toggleOverlay('menu');
      return;
    }
    setOverlay(null);
    if (was === 'waehlen') {
      const slot = owners[pageIdx]?.songIdx === idx ? 0 : 1;
      setActivePage(pageIdx + slot);
    } else {
      goToSong(idx);
    }
  };

  /**
   * Wie eine Anmerkungs-Ebene benannt wird – EINE Quelle für den Streifen oben UND die Auswahl
   * „Notizen von …". Vorher formulierte jede Stelle es selbst, mit anderen Worten und ohne das
   * Arrangement; von Alwin gemeldet als „ich weiß nicht, was was ist".
   */
  const ebenenNamen: NamenQuelle = {
    versionName: (key) => versions.find((v) => v.key === key)?.name ?? key,
    // Das Arrangement nur bei mehreren – bei einem unterscheidet der Name nichts.
    arrangementName: (id) => {
      if (song.arrangementCount <= 1) return null;
      /**
       * Das Arrangement des angezeigten Lieds trägt seinen Namen selbst mit – dafür braucht es die
       * Arrangement-Liste nicht. Beim Durchklicken aufgefallen (11.08.2026): Solange die Liste noch
       * lädt (oder wie in der Vorführung gar nicht kommt), stand hier „Nr. 999001". Der häufigste
       * Fall ist genau dieser, und für ihn ist die Antwort schon da.
       */
      if (id === song.arrangementId) return song.arrangementName;
      /**
       * Notizen ohne Arrangement-Segment heißen **„Standard"** – so von Alwin gewünscht
       * (11.08.2026). Es sind Anmerkungen aus der Zeit vor #320, als es je Lied nur ein Arrangement
       * gab; „Standard" trifft, wo sie herkommen, und ist für Musiker verständlicher als der
       * technisch genauere Hinweis, dass ihnen die Angabe fehlt.
       */
      if (id === null) return 'Standard';
      return (
        (arrangements.data ?? []).find((a) => a.arrangementId === id)?.arrangementName ??
        `Nr. ${id}`
      );
    },
  };

  // Tempo, Puls und Klick samt gemeinsamem Takt-Raster (#145) – in `useTempoSteuerung`.
  const {
    bpmPulse,
    setBpmPulse,
    klickModus,
    setKlickModus,
    tempoWert,
    setTempoWert,
    wirksamesTempo,
    klickTempo,
    schlaegeProTakt,
    taktStart,
    tempoAktiv,
  } = useTempoSteuerung(song, set);

  // Anmerkungs-/Zoom-Schlüssel je Strom-Seite. Die Regeln – welche Darstellungsart gilt, wann es
  // KEINEN Schlüssel gibt – stehen rein und getestet in `utils/chartPageKeys` (#314); hier nur die
  // Verdrahtung an die aktuellen Daten.
  const drawKeyFor = (page: number): string | null =>
    drawKeyForPage(page, owners, publishedSettings, effSettings);
  const zoomKeyBaseFor = (page: number): string =>
    zoomKeyBaseForPage(page, owners, publishedSettings, effSettings);
  const pageLabel = (activePg: number, pageIdx: number): string | null =>
    pageLabelFor(activePg, pageIdx, owners);
  // „Notizen von …": stabile Identität für die PageDeck-Effekte, deshalb `useCallback`.
  // `viewingId` gehört bewusst in die Abhängigkeiten, obwohl er im Schlüssel nicht vorkommt: Beim
  // Wechsel auf eine andere Person mit derselben Ebene bliebe die Funktion sonst identisch, und
  // PageDeck bekäme kein Signal, den Ansichts-Spiegel neu zu lesen.
  const viewingId = viewing?.id ?? null;
  const viewingSongId = viewing?.songId ?? null;
  const viewingLyr = viewing?.lyr ?? false;
  // SEIN Arrangement (#320, 3c) – gesucht wird unter dem Schlüssel des Kollegen, nicht dem eigenen.
  const viewingArr = viewing?.arrangementId ?? null;
  const viewKeyFor = useCallback(
    (page: number): string | null =>
      viewKeyForPage(
        page,
        owners,
        viewingId == null || viewingSongId == null
          ? null
          : { songId: viewingSongId, lyr: viewingLyr, arrangementId: viewingArr },
        VIEW_NS,
      ),
    [owners, viewingId, viewingSongId, viewingLyr, viewingArr],
  );
  /** Scroll-Modus: welche Anmerkungen eine Seite zeigt – bei der Rolle die aller A4-Seiten des Lieds (#614). */
  const anmerkungFuer = (page: number) =>
    anmerkungsquelleFuer(
      page,
      owners,
      publishedSettings,
      effSettings,
      viewingId == null || viewingSongId == null
        ? null
        : { songId: viewingSongId, lyr: viewingLyr, arrangementId: viewingArr },
      VIEW_NS,
      viewMode === 'merge',
    );

  /**
   * „Als PDF teilen" – das aktive Lied als einzelne PDF, über das Teilen-Fenster (Anmerkungen ja/nein,
   * 07.10.2026) und denselben Baustein wie der Ablauf (`ablaufPdfBauen`): Akkorde oder das angezeigte
   * Dokument, auf Wunsch mit den eigenen Anmerkungen.
   *
   * Die Akkord-Optionen kommen aus `pdfOptionsForSong`, derselben Funktion, die auch den Seitenstrom
   * der Anzeige baut. Vorher baute diese Stelle die Optionen selbst und übergab `totalOffset` – also
   * OHNE den Kapo-Abzug. Bei gesetztem Kapo war das geteilte PDF dadurch anders transponiert als der
   * Bildschirm (#239). Es darf hier keine zweite Fassung dieser Rechnung geben.
   */
  const [teilenOffen, setTeilenOffen] = useState(false);
  const liedPdf = async (mitAnmerkungen: boolean): Promise<GebautesPdf> => {
    const lied = { ...song, chordpro: displayedChordpro };
    const opts = pdfOptionsForSong(song, set, logo);
    const dokument =
      set.viewSource === 'chords'
        ? null
        : (song.documents.find((d) => d.fileId === set.viewSource) ?? null);
    const { doc, ersetzt, fehlend } = await ablaufPdfBauen(
      [
        {
          song: lied,
          versionKey: set.versionKey,
          quelle: dokument ? { art: 'dokument', dokument } : { art: 'akkorde', opts },
        },
      ],
      {
        ladeSeiten: async (s, d) => dokumentSeiten(await ladeDokument(s.id, d.fileId), d.type),
        akkordOpts: () => opts,
        ebene: mitAnmerkungen ? eigeneEbene : undefined,
      },
    );
    const hinweis =
      ersetzt.length > 0
        ? 'Das Dokument ließ sich nicht laden – im PDF stehen die Akkorde'
        : fehlend.length > 0
          ? 'Das Dokument ließ sich nicht laden'
          : '';
    return { doc, hinweis };
  };

  // ChordPro-Versionen anlegen/bearbeiten/löschen (Zustand + ChurchTools-Aufrufe im Hook gebündelt).
  const {
    showEditor,
    setShowEditor,
    editorSaving,
    editorError,
    editor,
    confirmDelEdited,
    setConfirmDelEdited,
    openEditCurrent,
    openNewVersion,
    handleEditorSave,
    handleDeleteVersion,
  } = useChartEditor({
    song,
    versionKey: set.versionKey,
    isOriginal,
    currentVersionName: currentVersion.name,
    displayedChordpro,
    editorTemplate,
    notierteTonart,
    curKey,
    onReload,
    selectVersion,
    uebernimmTonart: (id, key) => updateSetting(id, { key }),
  });
  // Tastatur-Navigation aussetzen, solange Editor oder Zeichenmodus offen sind.
  navBlockedRef.current = showEditor || drawMode;
  // Liedinfo für den Editor (L4) – erst laden, wenn er offen ist.
  const liedinfo = useLiedinfoQuelle(
    showEditor && song ? song.id : null,
    song?.arrangementId ?? null,
    canEditSong,
  );

  // Beim SCHLIESSEN des Editors die Anzeige neu ausrichten (Begründung im Hook).
  useResyncAfterEditor(showEditor, bumpSync);

  /**
   * Tipp in die Mitte: Leisten aus-/einblenden (#319).
   *
   * Beim ERSTEN Ausblenden ein einmaliger Hinweis – mit ausgeblendeten Leisten ist auch der
   * Zurück-Knopf weg, und dass ein weiterer Tipp sie zurückholt, sieht man dem Blatt nicht an.
   *
   * **Der Zoom bleibt dabei, wie er ist.** Ursprünglich passte ein Umschalten die Seite auch gleich
   * neu ein – das war meine Auslegung von „Text wird verdeckt" und ging an der Absicht vorbei:
   * „Was ich eigentlich erwarte ist, dass der Vollbildmodus den Zoom einfach beibehält und nur die
   * Leisten aus- und die Seite bildschirmfüllend anzeigt."
   *
   * Dass die Seite ihren Rahmen nicht mehr überragt – der eigentliche gemeldete Fehler – erledigt
   * der Pixel-Deckel in `PageDeck`, nicht das Einpassen. Das war die zweite, unnötige Hälfte.
   */
  const leistenUmschalten = () => {
    const wirdAusgeblendet = !leistenAus;
    setLeistenAus(wirdAusgeblendet);
    // Der Hinweis steht BEWUSST außerhalb der `setLeistenAus`-Aktualisierung. Solche Funktionen
    // müssen frei von Nebenwirkungen sein – React ruft sie unter Umständen mehrfach auf und darf
    // Ergebnisse verwerfen. Als Merker und Toast noch darin standen, **erschien der Hinweis nie**
    // (empirisch beim Durchklicken festgestellt; welcher der beiden Mechanismen genau griff, wurde
    // nicht weiter untersucht – die Regel gilt so oder so).
    if (wirdAusgeblendet && !isTourDone(HINT_VOLLBILD)) {
      markTourDone(HINT_VOLLBILD);
      showToast(
        scrollModus
          ? 'Leisten ausgeblendet – nochmal aufs Blatt tippen holt sie zurück.'
          : 'Leisten ausgeblendet – nochmal in die Mitte tippen holt sie zurück.',
      );
    }
  };

  const nextSong = activeSongIdx < songs.length - 1 ? songs[activeSongIdx + 1] : null;

  return (
    <Screen className={styles.chartScreen}>
      <>
        {!leistenAus && (
          <BlattKopf
            kopf={kopf}
            lieder={leistenLieder}
            // Nummern nur im Ablauf – ein einzelnes Lied aus der Liederliste steht ohne.
            mitNummer={songs.length > 1}
            sichtbar={visibleSongIdx}
            gewaehlt={activeSongIdx}
            onLiedTipp={liedTipp}
            offenesWerkzeug={offenesWerkzeug}
            headInfo={headInfo}
            menuOpen={overlay === 'menu'}
            liedFensterOffen={liedFensterOffen}
            viewing={viewing !== null}
            showsDocument={activeDoc !== null}
            canUseGlobalNotes={canUseGlobalNotes}
            drawMode={drawMode}
            // Im Scroll-Modus gibt es keinen Zoom; ein Stand aus der Mal-Ansicht darf nicht stehen bleiben.
            zoomed={streamZoomed && !scrollModus}
            bpmPulse={bpmPulse}
            pulsBpm={wirksamesTempo}
            klickBpm={klickTempo}
            taktStartMs={taktStart}
            schlaegeProTakt={schlaegeProTakt}
            tempoAktiv={tempoAktiv}
            onBack={onBack}
            /*
             * JEDER Knopf setzt das Zustandsfeld genau einmal – auf das nächste Fenster oder auf `null`. Ein
             * zusätzliches Schließen danach würde das gerade geöffnete Fenster sofort wieder zumachen (ein Feld für
             * alle Overlays, Lehre vom 05.08.2026: Zusammengelegter Zustand macht die Reihenfolge der Setter bedeutsam).
             */
            onAppearance={werkzeug.onAppearance}
            onTempo={werkzeug.onTempo}
            onResetZoom={werkzeug.onResetZoom}
            onToggleTeamNotes={werkzeug.onToggleTeamNotes}
            onToggleDraw={werkzeug.onToggleDraw}
            vollbildAn={vollbildAn}
            onVollbild={werkzeug.onVollbild}
          />
        )}

        {/* Sichtbare Rückmeldung beim Arrangement-Wechsel (#320).
            Das alte Blatt bleibt ABSICHTLICH stehen, bis das neue da ist – im Gottesdienst ist ein
            leeres Blatt das Letzte, was man braucht. Ohne Hinweis sieht genau das aber wie ein
            Aussetzer aus: Man tippt, und scheinbar passiert nichts. Gemeldet als „dauert super
            lange"; die Zeit steckt im Abruf gegen ChurchTools, nicht im Zeichnen. */}
        {arrangementLaedt && (
          <div className={styles.viewBar} role="status">
            <Icon name="cloud-download" size={15} stroke={2} />
            <span className={styles.viewBarText}>Arrangement wird geladen …</span>
          </div>
        )}

        {viewing && (
          <ViewingBanner
            personName={viewing.name}
            levelText={beschreibeEbene(viewing, ebenenNamen).einzeilig}
            otherVersion={(settings[song.id]?.versionKey ?? 'original') !== viewing.versionKey}
          />
        )}

        {overlay === 'tempo' && (
          <TempoMenu
            liedTempo={song.bpm}
            wert={tempoWert}
            onWert={setTempoWert}
            timeSig={song.timeSig}
            zaehlweise={set.zaehlweise}
            onZaehlweise={(z) => updateSetting(song.id, { zaehlweise: z })}
            puls={bpmPulse}
            onPuls={setBpmPulse}
            klick={klickModus}
            onKlick={setKlickModus}
            darfSpeichern={canEditTempo}
            onSpeichern={async (tempo) => {
              await setArrangementTempo(song.id, song.arrangementId, tempo);
              // Der Ablauf wird neu geladen, damit das neue Tempo überall steht. Danach ist das
              // eingestellte Tempo KEINE Abweichung mehr – der Merker gehört zurück auf „wie im
              // Lied", sonst bliebe der Speichern-Knopf aktiv und böte dasselbe nochmal an.
              onReload?.();
              setTempoWert(null);
              showToast(`Tempo ${tempo} in ChurchTools gespeichert.`);
            }}
            onClose={() => setOverlay(null)}
          />
        )}

        <ChartOverlays
          arrangements={arrangements.data ?? []}
          ablaufArrangementId={ablaufArrangement}
          // Tempo-Menü, Dateiverwaltung und Werkzeuge-Menü sind bewusst KEINE `ChartOverlay`: Sie
          // teilen sich zwar die Regel „höchstens eines offen", haben aber eine ganz andere
          // Bedienung. `useChartOverlay` filtert sie heraus, statt den Typ dort aufzuweichen.
          overlay={chartOverlay}
          /* Eigener Pfeil statt `setOverlay`: Der Zustand kennt mehr Werte als `ChartOverlay`. */
          onOverlay={(o) => setOverlay(o)}
          song={song}
          set={set}
          curKey={curKey}
          shapeKey={shapeKey}
          sections={sections}
          versions={versions}
          currentVersion={currentVersion}
          isOriginal={isOriginal}
          hasVersions={hasVersions}
          canEditSong={canEditSong}
          zuletztGesungen={zuletztGesungen}
          onSetting={(patch) => updateSetting(song.id, patch)}
          onSelectVersion={(versionKey) => selectVersion(song.id, versionKey)}
          onSharePdf={() => setTeilenOffen(true)}
          onOpenFiles={() => setOverlay('files')}
          onEditSong={() => setOverlay('stammdaten')}
          onEditCurrent={openEditCurrent}
          onNewVersion={openNewVersion}
          onDeleteVersion={() => setConfirmDelEdited(true)}
          ohneSpalten={scrollModus}
        />

        {/* Anzeige-Bereich: EIN durchgehender Strom (Akkorde + Dokumente gemischt) */}
        <div
          className={`${styles.chartArea}${leistenAus ? ' ' + styles.chartAreaVollbild : ''}`}
          data-tour="chart-blaettern"
        >
          {songs.length > 0 && scrollModus ? (
            <ScrollDeck
              pages={pages}
              loading={pagesLoading}
              error={pagesError}
              loadingLabel="Lieder werden vorbereitet…"
              anmerkungFuer={anmerkungFuer}
              seite={activeIdx}
              onSeite={setPage}
              positionRef={scrollPos}
              onTipp={leistenUmschalten}
              syncTick={syncTick}
              schrittRef={schrittRef}
              malen={
                drawMode
                  ? {
                      drawTool,
                      setDrawTool,
                      drawColor,
                      setDrawColor,
                      drawColors: DRAW_COLORS,
                    }
                  : undefined
              }
            />
          ) : songs.length > 0 ? (
            <PageDeck
              pages={pages}
              loading={pagesLoading}
              error={pagesError}
              loadingLabel="Lieder werden vorbereitet…"
              drawKeyFor={drawKeyFor}
              viewKeyFor={viewKeyFor}
              previewOwn={viewMode === 'merge'}
              zoomKeyBaseFor={zoomKeyBaseFor}
              pageLabel={pageLabel}
              pageIndex={pageIdx}
              onPageIndex={setPage}
              activePage={activeIdx}
              onActivePage={setActivePage}
              drawMode={drawMode}
              drawColor={drawColor}
              setDrawColor={setDrawColor}
              drawTool={drawTool}
              setDrawTool={setDrawTool}
              drawColors={DRAW_COLORS}
              syncTick={syncTick}
              onMiddleTap={leistenUmschalten}
              onZoomedChange={setStreamZoomed}
              resetZoomSignal={werkzeug.resetZoomSignal}
            />
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <Icon name="music" size={36} stroke={1.6} />
              </div>
              <div>Für dieses Lied ist keine Akkord-Datei in ChurchTools hinterlegt.</div>
              {canEditSong && (
                <button className={styles.createBtn} onClick={openNewVersion}>
                  Akkord-Datei erstellen
                </button>
              )}
            </div>
          )}
        </div>

        {showEditor && (
          <ChordEditor
            songTitle={song.title}
            initialText={editor.text}
            initialName={editor.name}
            isNew={editor.mode === 'new'}
            saving={editorSaving}
            error={editorError}
            onSave={handleEditorSave}
            onDelete={editor.mode === 'edit' ? () => setConfirmDelEdited(true) : undefined}
            onClose={() => setShowEditor(false)}
            tonart={curKey}
            kapo={set.capo}
            liedinfo={liedinfo}
          />
        )}

        {confirmDelEdited && (
          <ConfirmDialog
            title="Version löschen?"
            message={`Die Version „${currentVersion.name}" von „${song.title}" wird aus ChurchTools entfernt. Das Original bleibt erhalten.`}
            confirmLabel={editorSaving ? 'Löschen…' : 'Löschen'}
            onConfirm={() => void handleDeleteVersion()}
            onCancel={() => setConfirmDelEdited(false)}
          />
        )}

        {!leistenAus && (
          <ChartFooter
            songCount={songs.length}
            nextSongTitle={nextSong?.title ?? null}
            // Im Scroll-Modus tun die Pfeile dasselbe wie das Pedal (ein Schritt). Ob oben/unten
            // Schluss ist, weiß nur die Scroll-Fläche – am Rand tut ein Schritt einfach nichts.
            atStart={scrollModus ? false : atStart}
            atEnd={scrollModus ? false : atEnd}
            onPrev={scrollModus ? () => schrittRef.current?.(-1) : prev}
            onNext={scrollModus ? () => schrittRef.current?.(1) : next}
          />
        )}

        {viewing && (
          <ImportPreviewBar
            mode={viewMode}
            onMode={setViewMode}
            onImport={(m) => void importFrom(m)}
            onPickOther={openSharers}
            onPickLevel={openLevels}
            onStop={stopViewing}
          />
        )}

        {/* „Notizen von …": Stufe 1 = Person wählen, Stufe 2 = ihre Ebene (Version + Darstellung). */}
        {showSharers && (
          <SharersSheet
            songTitle={song.title}
            sharers={songSharers}
            pickerPerson={pickerPerson}
            levels={mirrorGroups()}
            versionName={ebenenNamen.versionName}
            arrangementName={ebenenNamen.arrangementName}
            levelKey={groupKeyOf}
            onPickPerson={(p) => void openPersonLevels(p, song.id)}
            onPickLevel={(g) => viewLevel(song.id, g.versionKey, g.lyr, g.arrangementId)}
            onBackToPersons={() => setPickerPerson(null)}
            onClose={() => setShowSharers(false)}
          />
        )}

        {/**
         * Stammdaten ändern (#322, Schritt 11).
         *
         * **Nach dem Löschen wird die Chart-Ansicht verlassen** (`onBack`): Ein Blatt zu einem Lied,
         * das es nicht mehr gibt, wäre eine Sackgasse – der nächste Abruf endete im Fehler.
         */}
        {overlay === 'stammdaten' && (
          <EditSongSheet
            songId={song.id}
            arrangementId={song.arrangementId}
            tonart={song.targetKey || song.originalKey}
            songName={song.title}
            onSaved={showToast}
            onDeleted={(meldung) => {
              showToast(meldung);
              onBack();
            }}
            onClose={() => setOverlay(null)}
          />
        )}

        {/* Dateien des Arrangements (#321). Hochladen/Löschen folgt in Schritt 4. */}
        {overlay === 'files' && (
          <ArrangementFilesSheet
            arrangementName={ebenenNamen.arrangementName(song.arrangementId)}
            files={datei.dateien.data ?? []}
            laedt={datei.dateien.isPending}
            // `paused` heißt: React Query wartet auf den Server, statt weiter zu versuchen.
            angehalten={datei.dateien.fetchStatus === 'paused'}
            fehler={
              datei.dateien.error
                ? 'Die Dateien konnten nicht geladen werden. Bitte erneut versuchen.'
                : null
            }
            laedtHoch={datei.laedtHoch}
            /**
             * Aus SongSelect holen nur, wenn beides da ist: das Recht der Gemeinde (`canUseCcli`)
             * UND eine CCLI-Nummer am Lied. Ohne die Nummer wüsste CCLI nicht, welches Lied gemeint
             * ist; ohne das Recht scheitert der Aufruf immer.
             */
            songSelect={
              canUseCcli && song.ccli
                ? { songNumber: Number(song.ccli), laeuft: datei.holtChordPro }
                : null
            }
            onDownload={(f) => void datei.herunterladen(f)}
            onUpload={datei.dateiGewaehlt}
            onDelete={datei.setLoeschDatei}
            onSongSelect={() => setSongSelectFrage(true)}
            onClose={() => setOverlay(null)}
          />
        )}

        {/* Die Rückfrage nennt die FOLGE: Ein vorhandenes Notenblatt wird ersetzt, und die Tonart
            kommt aus dem Arrangement (CCLI transponiert beim Herunterladen). */}
        {songSelectFrage && song.ccli && (
          <ConfirmDialog
            title="Notenblatt aus SongSelect holen?"
            message={`Für „${song.title}" (CCLI-Nummer ${song.ccli}) wird das Notenblatt bei SongSelect geholt und in „${song.arrangementName}" abgelegt – in der Tonart des Arrangements. Ein vorhandenes Notenblatt dieses Arrangements wird dabei ERSETZT; deine eigenen Versionen bleiben.`}
            confirmLabel="Holen"
            onConfirm={() => {
              setSongSelectFrage(false);
              void datei.chordProHolen(Number(song.ccli));
            }}
            onCancel={() => setSongSelectFrage(false)}
          />
        )}

        {/* Rückfrage vor dem Löschen. Bei einer flachen Liste ist dieser Text die einzige Bremse –
            deshalb nennt er die FOLGE und nicht nur „wirklich?". */}
        {datei.loeschDatei && (
          <ConfirmDialog
            title="Datei löschen?"
            message={loeschFrage(datei.loeschDatei)}
            confirmLabel="Löschen"
            onConfirm={() => void datei.loeschenBestaetigen()}
            onCancel={() => datei.setLoeschDatei(null)}
          />
        )}

        {/* Gleicher Name: ChurchTools ersetzt nicht, es läge zweimal da. Was die richtige Datei ist,
            weiß nur der Nutzer – also Auskunft geben und ihn entscheiden lassen. */}
        {datei.uploadWarnung && (
          <ConfirmDialog
            title="Datei gibt es schon"
            message={datei.uploadWarnung.text}
            confirmLabel="Trotzdem hochladen"
            onConfirm={datei.warnungBestaetigen}
            onCancel={() => datei.setUploadWarnung(null)}
          />
        )}

        <Toast message={toast} />

        {teilenOffen && (
          <TeilenFenster
            titel="Lied teilen"
            dateiname={song.title}
            bauen={liedPdf}
            onClose={() => setTeilenOffen(false)}
          />
        )}

        {chartTour && (
          <Coachmarks
            steps={chartSchritte(scrollModus)}
            onClose={() => {
              markTourDone(TOUR_CHART);
              setChartTour(false);
            }}
          />
        )}
      </>
    </Screen>
  );
}
