import { useCallback, useEffect, useRef } from 'react';
import type { PunktStand } from '@shared/ct/ablaufZeile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type AblaufQuelle, type AgendaItem, type ArrangementAuftrag } from '@shared/types/index';
import { plusTage } from '@shared/ct/datum';
import { ohneMarkierungen } from '../utils/ablaufAenderungen';
import type { GeloeschterPunkt } from '@shared/ct/schreibKern';
import type { AblaufStand } from '@shared/ct/ablaufNeu';
import * as api from '../services/churchtoolsApi';
import { ApiError } from '../services/api';
import { agendaAbfrage, liedblattAbfrage, schluessel } from './abfrageSchluessel';
import { heuteImKalender } from '@shared/ct/zeit';
import { arrangementListenErneuern } from '@ui/lied/liedDaten';
import { useLiedZugriff } from '@ui/lied/liedZugriff';

/**
 * Die Abfragen der Liedwahl liegen seit LW1a (06.11.2026) in `ui/lied/liedDaten.ts` – hier nur weitergereicht, damit
 * die Musik-App sie an gewohnter Stelle findet. Sie lesen über den Liedzugriff (`musikLiedZugriff`, in `main.tsx` gegeben).
 */
export {
  useLiedtextSuche,
  useLiedtextVorschau,
  useSongLibrary,
  useSongSelectLiedtext,
  useSongSelectSuche,
  useSongUsage,
  // Seit LW1b-2 (06.11.2026): „Neues Lied", Stammdaten und Arrangements.
  useArrangementAendern,
  useArrangements,
  useLiedAendern,
  useLiedAnlegen,
  useSongCategories,
  useSongSelectSong,
  useSongStammdaten,
} from '@ui/lied/liedDaten';
export { SONGSELECT_MIN_ZEICHEN } from '@ui/lied/suchRegeln';

// Kurze Frische für die aktuellen (aktiven) Daten: So erscheinen ChurchTools-Änderungen
// (verschobene Punkte, geänderte Setlist) zeitnah – die Query gilt schon nach 30 s als veraltet
// und wird beim nächsten App-Fokus / Wiederverbinden neu geladen (#159). Vorher waren es 5 min,
// wodurch Änderungen sehr lange unsichtbar blieben. Die Offline-Reserve hängt an `gcTime`
// (7 Tage, queryClient.ts) und bleibt davon unberührt.
const ACTIVE_STALE_MS = 1000 * 30;

/** Lädt die Gottesdienste mit Setlist (Standardfenster: ~1 Woche zurück bis 6 Wochen voraus). */
export function useServices(enabled: boolean, poll = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: schluessel.termine(),
    queryFn: () => api.getServices(),
    enabled,
    staleTime: ACTIVE_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    /**
     * Sanftes Polling, damit der „Ablauf geändert"-Punkt auch auf einem unberührt daliegenden Gerät
     * von selbst erscheint (#143).
     *
     * **`poll` steuert es seit #306.** Der frühere Kommentar behauptete „solange die Liste sichtbar
     * ist" – das stimmte nicht: Pausiert wurde nur, wenn der ganze Browser-Tab in den Hintergrund
     * ging. Im Liederheft lief der 60-Sekunden-Takt weiter, obwohl die Terminliste gar nicht zu sehen
     * war. Und **jede Runde kostet rund `1 + 2 × Termine` ChurchTools-Anfragen** (~17 im
     * Standardfenster) – bei fünf Geräten im Gottesdienst die größte Dauerlast der App.
     *
     * Die Abfrage bleibt aktiviert (`enabled`), nur der Takt entfällt: `useAppNav` und die
     * Offline-Vorbereitung brauchen die Daten weiterhin.
     */
    refetchInterval: poll ? 60_000 : false,
  });

  /**
   * Wird der Takt wieder eingeschaltet, EINMAL sofort nachladen – und zwar hier, direkt neben dem
   * Takt selbst.
   *
   * Ohne das wäre #306 ein Rückschritt: React Query startet beim Wiedereinschalten nur den Timer neu
   * und holt **nicht** von sich aus. Nach zehn Minuten im Liederheft sähe man also eine zehn Minuten
   * alte Terminliste, und das noch bis zu 60 Sekunden lang. Vorher lief der Takt durch – die Liste war
   * nie älter als eine Minute. (Empirisch nachgestellt: verborgen → zurück ergab 0 zusätzliche
   * Aufrufe.)
   *
   * Die Zeile steht bewusst im Hook und nicht beim Aufrufer: „Takt pausiert" und „beim Zurückkommen
   * frisch" sind zwei Hälften EINER Regel. Getrennt abgelegt, vergisst sie der nächste Aufrufer.
   *
   * ⚠️ Bewusst über den QueryClient statt über `query.refetch`: React Query merkt sich, welche Felder
   * des Ergebnisses während des Renderns gelesen werden, und benachrichtigt danach NUR noch bei deren
   * Änderung. Würde hier `refetch` herausgezogen, gälte allein `refetch` als beobachtet – neue Daten
   * lösten dann in Komponenten, die sonst nichts lesen, kein Rendern mehr aus. Ein Test hat genau das
   * gezeigt (Abfrage blieb ewig `pending`).
   */
  const taktLiefVorher = useRef(poll);
  useEffect(() => {
    if (poll && !taktLiefVorher.current && enabled) {
      void qc.refetchQueries({ queryKey: schluessel.termine(), exact: true });
    }
    taktLiefVorher.current = poll;
  }, [poll, enabled, qc]);

  return query;
}

/**
 * Merkt den aktuellen Setlist-Stand eines Termins als „gesehen" (#143). MUSS bei JEDEM Öffnen
 * laufen – auch (gerade!) beim ersten Mal, denn erst dieser gemerkte Stand ist die Basislinie,
 * gegen die spätere Änderungen das Badge auslösen. `refresh` steuert nur, ob danach die (teure)
 * Terminliste neu geladen wird: nötig, wenn gerade ein Badge quittiert wurde, damit es
 * verschwindet – beim reinen Basislinie-Setzen unnötig. Fehler werden geschluckt (Komfort-Hinweis).
 */
export function useMarkSetlistSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { eventId: number; refresh: boolean }) => api.markSetlistSeen(v.eventId),
    onSuccess: (_data, v) => {
      if (v.refresh) void qc.invalidateQueries({ queryKey: schluessel.termine() });
      // Gesehen ist gesehen – auch im gespeicherten Ablauf (12.10.2026). Sonst brachte ein Neuladen
      // binnen 30 s (Erweiterung: kurz eine andere ChurchTools-Seite) denselben Hinweis noch einmal.
      qc.setQueryData<AgendaItem[]>(
        schluessel.agenda(v.eventId),
        (alt) => alt && ohneMarkierungen(alt),
      );
    },
  });
}

/**
 * Takt des Live-Abgleichs (#557, Alwin 22.10.2026: 30 s statt 8 s). Er war der größte Posten der Grundlast
 * auf ChurchTools (~7,5 Anfragen je Minute und Gerät); eine Ablaufänderung kommt jetzt nach höchstens 30 s an.
 */
export const ABLAUF_ABGLEICH_MS = 30_000;

/**
 * Live-Abgleich für einen geöffneten Ablauf: pollt alle `ABLAUF_ABGLEICH_MS` den billigen
 * Ablauf-Fingerabdruck (kein ChordPro-Download; der Server bündelt Abfragen mehrerer Geräte desselben
 * Kontos in einem Kurz-Memo). Die Auswertung (Ablauf neu laden / Hinweis im Liederheft) übernimmt App.tsx.
 */
export function useSetlistVersion(eventId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['setlist-version', eventId],
    queryFn: () => api.getSetlistVersion(eventId as number),
    enabled: enabled && eventId !== null,
    refetchInterval: ABLAUF_ABGLEICH_MS,
    staleTime: 0,
    // Kein Retry-Getrommel: schlägt ein Poll fehl (Netz-Aussetzer), kommt im nächsten Takt der nächste.
    retry: false,
  });
}

/** Datum vor `monthsBack` Monaten als ISO-Datum (YYYY-MM-DD) – lokal, wie `heuteImKalender`. */
function monthsAgoIso(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return heuteImKalender(d);
}

/** Lädt vergangene Gottesdienste der letzten `monthsBack` Monate (lazy, nur wenn enabled). */
export function usePastServices(monthsBack: number, enabled: boolean) {
  return useQuery({
    queryKey: schluessel.termineVergangen(monthsBack),
    queryFn: () =>
      api.getServices({
        from: monthsAgoIso(monthsBack),
        to: heuteImKalender(),
      }),
    enabled,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev, // beim „Mehr laden" alte Liste behalten (kein Flackern)
  });
}

/**
 * **Die Termine eines Tages** (E6-O O4) – für einen Direktlink aus dem Dienstplaner auf einen Termin außerhalb der
 * geladenen Wochen (vergangen oder weiter als sechs Wochen voraus). `to` zählt bei ChurchTools nicht mit (am
 * 28.10.2026 gemessen: `from=to=2026-10-18` ist leer), also bis zum Folgetag.
 */
export function useTermineAm(tag: string | null, enabled: boolean) {
  return useQuery({
    queryKey: schluessel.termineAm(tag),
    queryFn: () =>
      tag ? api.getServices({ from: tag, to: plusTage(tag, 1) }) : Promise.resolve([]),
    enabled: enabled && tag !== null,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Veranstaltungen ohne Ablauf aus den Kalendern, die im Filter „auch ohne Ablauf“ haben (13.10.2026, seit 05.11.2026
 * je Person). Ohne solche Kalender wird nicht gefragt – jede Abfrage wäre eine leere Antwort.
 */
export function useServicesOhneAblauf(kalenderIds: readonly number[], enabled: boolean) {
  return useQuery({
    queryKey: schluessel.termineOhneAblauf(kalenderIds),
    queryFn: () => api.getServicesOhneAblauf(kalenderIds),
    enabled: enabled && kalenderIds.length > 0,
    staleTime: ACTIVE_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** Die Ablauf-Vorlagen aus ChurchTools – fürs Fenster „Ablauf anlegen". */
export function useAblaufVorlagen(enabled: boolean) {
  return useQuery({
    queryKey: schluessel.ablaufVorlagen(),
    queryFn: () => api.getAblaufVorlagen(),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Einen Ablauf anlegen. Danach – auch nach einem Fehler, etwa „gibt es schon" – beide Terminlisten
 * neu: Der Termin wandert von „ohne Ablauf" in die normale Liste.
 */
export function useAblaufAnlegen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { eventId: number; kalenderId: number; quelle: AblaufQuelle }) =>
      api.ablaufAnlegen(v.eventId, v.kalenderId, v.quelle),
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: schluessel.termine() });
      void qc.invalidateQueries({ queryKey: schluessel.agenda(v.eventId) });
      void qc.invalidateQueries({ queryKey: schluessel.liedNutzung() });
    },
  });
}

/**
 * „Neu aufsetzen“ (E6-5b): Lesen und Schreiben **ohne** Zwischenspeicher – der Kern vergleicht vor dem Schreiben genau
 * den Stand, den die Nachfrage gezeigt hat. `neuLaden` holt danach Ablauf, Termine (Liedzahl) und Liedstatistik neu;
 * `NeuAufsetzen` ruft es nach jedem Versuch, auch einem gescheiterten.
 */
export function useAblaufNeuAufsetzen(eventId: number) {
  const qc = useQueryClient();
  const bestandLesen = useCallback(() => api.ablaufBestand(eventId), [eventId]);
  return {
    bestandLesen,
    neuAufsetzen: async (
      kalenderId: number | null,
      quelle: AblaufQuelle,
      gesehen: AblaufStand,
      nurDieser: boolean,
    ): Promise<void> => {
      await api.ablaufNeuAufsetzen(eventId, kalenderId, quelle, gesehen, nurDieser);
    },
    neuLaden: () => {
      void qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) });
      void qc.invalidateQueries({ queryKey: schluessel.termine() });
      void qc.invalidateQueries({ queryKey: schluessel.liedNutzung() });
    },
  };
}

/** Lädt alle Ablaufpunkte eines Gottesdienstes (Lieder inkl. ChordPro). */
export function useAgenda(eventId: number | null) {
  return useQuery({
    ...agendaAbfrage(eventId),
    // Kurze Frische (#159): verschobene/geänderte Ablaufpunkte erscheinen zeitnah beim
    // nächsten Fokus/Wiederverbinden statt erst nach 5 min.
    staleTime: ACTIVE_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** Speichert eine neue Ablauf-Reihenfolge und lädt den Ablauf danach neu. */
export function useReorderAgenda(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { order: number[]; gesehen?: number[] }) =>
      api.reorderAgenda(eventId as number, v.order, v.gesehen),
    onSuccess: () => qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) }),
  });
}

/** Löscht einen Ablaufpunkt und lädt Ablauf + Übersicht (Song-Anzahl) neu. */
export function useDeleteAgendaItem(eventId: number | null) {
  return useAgendaItemMutation(eventId, (itemId: number) =>
    api.deleteAgendaItem(eventId as number, itemId),
  );
}

/** „Rückgängig" nach dem Löschen – lädt danach dasselbe neu wie das Löschen selbst. */
export function useRestoreAgendaItem(eventId: number | null) {
  return useAgendaItemMutation(eventId, (g: GeloeschterPunkt) =>
    api.restoreAgendaItem(eventId as number, g),
  );
}

/** Löschen und Wiederherstellen ändern die Lieder des Termins: Ablauf, Übersicht und Statistik neu. */
function useAgendaItemMutation<V, R>(eventId: number | null, mutationFn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) });
      void qc.invalidateQueries({ queryKey: schluessel.termine() });
      void qc.invalidateQueries({ queryKey: schluessel.liedNutzung() });
    },
  });
}

/**
 * Schreibt geänderte Felder eines Ablaufpunkts gesammelt (EIN PUT) und lädt den Ablauf EINMAL
 * neu – statt Request + Refetch pro Feld. Ändert sich die Lied-Verknüpfung, werden zusätzlich
 * Terminliste (Lied-Anzahl) und Statistik aktualisiert.
 */
export function useUpdateAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; fields: api.AgendaItemUpdate; gesehen?: PunktStand }) =>
      api.updateAgendaItem(eventId as number, v.itemId, v.fields, v.gesehen),
    onSuccess: (_data, v) => {
      void qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) });
      if (v.fields.arrangementId !== undefined || v.fields.unlink) {
        void qc.invalidateQueries({ queryKey: schluessel.termine() });
        void qc.invalidateQueries({ queryKey: schluessel.liedNutzung() });
      }
    },
  });
}

/** Legt den Vorlauf vor dem Beginn fest (#423) und lädt den Ablauf neu – die Uhrzeiten verschieben sich. */
export function useSetAgendaItemVorBeginn(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; vorBeginn: boolean }) =>
      api.setAgendaItemVorBeginn(eventId as number, v.itemId, v.vorBeginn),
    onSuccess: () => qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) }),
  });
}

/** Einen Punkt an diesem Termin weglassen oder wieder zeigen (E6-3b) – die Uhrzeiten verschieben sich. */
export function useSetAgendaItemWeggelassen(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; weggelassen: boolean }) =>
      api.setAgendaItemWeggelassen(eventId as number, v.itemId, v.weggelassen),
    onSuccess: () => qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) }),
  });
}

/**
 * Den Ablauf abschließen oder öffnen (09.10.2026). Danach Terminliste und Ablauf neu: Der Zustand
 * steht am Termin (`ablaufAbgeschlossen`), und wer bearbeitet, soll sofort sehen, ob er wieder darf.
 */
export function useAblaufAbschliessen(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (abgeschlossen: boolean) =>
      api.setAblaufAbgeschlossen(eventId as number, abgeschlossen),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: schluessel.termine() });
      void qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) });
    },
  });
}

/** Lädt die ChurchTools-Dienste (für die Verantwortlich-Chips). */
export function useAgendaServices(enabled: boolean) {
  return useQuery({
    queryKey: ['agenda-services'],
    queryFn: () => api.getAgendaServices(),
    enabled,
    staleTime: 1000 * 60 * 30,
  });
}

/** Lädt die Rechte des angemeldeten Nutzers. Dieser Aufruf ist das „Tor" zur App – schlägt er
 *  wegen eines ChurchTools-Aussetzers (z. B. leere Rechte-Antwort → 502) fehl, versuchen wir es
 *  mehrfach automatisch mit wachsender Pause, statt gleich das „keine Berechtigung"-Schloss bzw.
 *  den Fehlerschirm zu zeigen. */
export function useCapabilities(enabled: boolean) {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.getCapabilities(),
    enabled,
    // Persistierter Stand wird sofort angezeigt (kein Flackern), aber bei jedem App-Start neu
    // geholt: So greifen vom Admin geänderte Rechte (z. B. Team-Notizen freigeben) schon beim
    // nächsten Neuladen – ohne Ab-/Neuanmelden. Kurzer staleTime bremst Navigations-Refetches.
    staleTime: 1000 * 60,
    refetchOnMount: 'always',
    // Eine abgelaufene/ungültige ChurchTools-Sitzung (401) lässt sich nicht „wegwiederholen" –
    // sofort aufgeben (App.tsx führt dann zum Login). Nur echte Aussetzer (502) 3× erneut versuchen.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 401 ? false : failureCount < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

/**
 * Löscht ein Lied (#322, Schritt 11).
 *
 * Räumt danach auch die **Anmerkungs-Abfragen** nicht weg – die liegen pro Konto und verweisen auf eine
 * songId, die es nicht mehr gibt; sie laufen ins Leere, richten aber keinen Schaden an. Was hier zählt:
 * Bibliothek und Abläufe müssen neu geladen werden, sonst zeigt die App ein Lied, das nicht mehr da ist.
 */
export function useLiedLoeschen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (songId: number) => api.loescheLied(songId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schluessel.liederliste() });
      void qc.invalidateQueries({ queryKey: schluessel.agendaAlle() });
      void qc.invalidateQueries({ queryKey: schluessel.termine() });
    },
  });
}

/**
 * Die Liedquellen (Liederbücher) – **wie die Kategorien nur 5 Minuten vorgehalten** (#396).
 *
 * Sie ändern sich fast nie, aber sie werden im Formular zur Auswahl gestellt: Eine Quelle
 * anzubieten, die es in ChurchTools nicht mehr gibt, ist ein Knopf ins Leere – der Server lehnt sie
 * dann ab (gemessen: ChurchTools selbst verwirft eine unbekannte ID stillschweigend).
 */
export function useSongSources(enabled: boolean) {
  return useQuery({
    queryKey: ['song-sources'],
    queryFn: () => api.getSongSources(),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/** Legt ein weiteres Arrangement an (#396). */
export function useArrangementAnlegen(songId: number) {
  const qc = useQueryClient();
  const quelle = useLiedZugriff();
  return useMutation({
    mutationFn: (auftrag: ArrangementAuftrag & { name: string }) =>
      api.legeArrangementAn(songId, auftrag),
    onSuccess: () => arrangementListenErneuern(qc, quelle, songId),
  });
}

/**
 * Macht ein Arrangement zum Standard (#396).
 *
 * Die Antwort ist die ganze Liste – sie wird direkt in den Cache gelegt, damit nicht kurz zwei
 * Einträge als Standard dastehen, während die Abfrage noch läuft.
 */
export function useArrangementStandard(songId: number) {
  const qc = useQueryClient();
  const quelle = useLiedZugriff();
  return useMutation({
    mutationFn: (arrangementId: number) => api.arrangementZumStandard(songId, arrangementId),
    onSuccess: (liste) => {
      qc.setQueryData(schluessel.arrangements(songId), liste);
      arrangementListenErneuern(qc, quelle, songId);
    },
  });
}

/** Löscht ein Arrangement (#396) – samt Notenblättern, Dateien und Versionen. */
export function useArrangementLoeschen(songId: number) {
  const qc = useQueryClient();
  const quelle = useLiedZugriff();
  return useMutation({
    mutationFn: (arrangementId: number) => api.loescheArrangement(songId, arrangementId),
    onSuccess: () => {
      arrangementListenErneuern(qc, quelle, songId);
      // Ein gelöschtes Arrangement kann in einem Ablauf gestanden haben.
      void qc.invalidateQueries({ queryKey: schluessel.agendaAlle() });
    },
  });
}

/** Lädt die Chart-Daten eines einzelnen Lieds. */
export function useSongChart(sel: { songId: number; arrangementId?: number } | null) {
  // Derselbe Schlüssel wie beim Vorladen und in der Arrangement-Überschreibung (#492) – vorher stand er
  // hier von Hand. Ohne Auswahl ist die Abfrage aus; der Schlüssel der Lied-ID 0 wird nie geholt.
  return useQuery({
    ...liedblattAbfrage(sel?.songId ?? 0, sel?.arrangementId),
    enabled: sel !== null,
  });
}

/** Lädt die Arrangements eines bekannten Lieds (für „Zu Ablauf hinzufügen"). */
export function useSongArrangements(songId: number | null) {
  return useQuery({
    queryKey: schluessel.liedArrangements(songId),
    queryFn: () => api.getSongArrangements(songId as number),
    enabled: songId !== null,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fügt ein Lied (per Arrangement) ans Ende des Ablaufs eines beliebigen Termins.
 * Im Gegensatz zu useCreateAgendaItem ist der Termin nicht fest, sondern wird pro Aufruf übergeben.
 */
export function useAddSongToService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { eventId: number; arrangementId: number; title: string }) =>
      api.createAgendaItem(v.eventId, {
        type: 'song',
        title: v.title,
        arrangementId: v.arrangementId,
      }),
    onSuccess: (_data, v) => {
      void qc.invalidateQueries({ queryKey: schluessel.agenda(v.eventId) });
      void qc.invalidateQueries({ queryKey: schluessel.termine() });
      void qc.invalidateQueries({ queryKey: schluessel.liedNutzung() });
    },
  });
}

/** Legt einen neuen Ablaufpunkt an und lädt Ablauf + Übersicht (Song-Anzahl) neu. */
export function useCreateAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: 'header' | 'text' | 'song';
      title?: string;
      arrangementId?: number;
      responsible?: string;
      note?: string;
      durationMin?: number;
    }) => api.createAgendaItem(eventId as number, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schluessel.agenda(eventId) });
      void qc.invalidateQueries({ queryKey: schluessel.termine() });
      void qc.invalidateQueries({ queryKey: schluessel.liedNutzung() });
    },
  });
}
