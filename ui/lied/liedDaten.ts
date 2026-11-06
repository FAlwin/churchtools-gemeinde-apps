/**
 * **Die Daten der Liedwahl** – die Abfragen samt Zwischenspeicher-Regeln (TanStack Query), einmal für alle Apps.
 *
 * Bis zum 06.11.2026 in `client/src/hooks/useServices.ts`; mit der Liedwahl nach `ui/lied` umgezogen (Dienstplaner-
 * Bauplan E9, Wunsch 4 „LW1a"). **Wortgleich übernommen** – dieselben Schlüssel, Haltezeiten und Wiederholregeln –,
 * nur dass die Daten jetzt über den `LiedZugriff` der jeweiligen App kommen. Die Musik-App erneuert ihre Liederliste
 * weiter über `schluessel.liederliste()`; der zeigt auf `liedSchluessel` hier, damit es den Schlüssel nur einmal gibt.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  ArrangementAuftrag,
  LiedAnlegenAuftrag,
  LiedStammdaten,
  SongSelectSuchergebnis,
  SongTextTreffer,
} from '@shared/types/index';
import { LIEDTEXT_SUCHE_MIN_ZEICHEN } from '@shared/types/index';
import { useLiedZugriff, type LiedZugriff } from './liedZugriff';
import { SONGSELECT_MIN_ZEICHEN, sucheArt } from './suchRegeln';

/** Die Schlüssel, die auch außerhalb der Liedwahl gebraucht werden (Erneuern nach Anlegen/Ändern eines Lieds). */
export const liedSchluessel = {
  liedNutzung: () => ['song-usage'] as const,
  liederliste: () => ['song-library'] as const,
  // Seit LW1b-2 (06.11.2026) hier, vorher in `client/src/hooks/abfrageSchluessel.ts` bzw. als Literal in `useServices`.
  kategorien: () => ['song-categories'] as const,
  liedStammdaten: (songId: number | null) => ['song-stammdaten', songId] as const,
  arrangements: (songId: number | null) => ['arrangements', songId] as const,
};

/** Lädt alle Lieder (für die „Alle Lieder"-Ansicht). */
export function useSongLibrary(enabled: boolean) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: liedSchluessel.liederliste(),
    queryFn: () => quelle.liederliste(),
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Sucht im **Liedtext** des eigenen Bestands (#322).
 *
 * **Erst auf Verlangen**, nicht automatisch: Der erste Aufruf lässt den Server einen Index bauen (ein
 * Datei-Download je Lied). Das ist zu teuer, um es bei jedem Tippen im Liederheft mitlaufen zu lassen –
 * die Titelsuche filtert ohnehin schon lokal und deckt den Normalfall ab. Das Verlangen ist der Tipp auf
 * das Angebot „Auch in den Liedtexten nach … suchen" (`SucheAngebot`, #378) – im Liederheft wie im
 * Einfüge-Dialog; die Schwelle bleibt.
 *
 * Danach ist es billig: Der Index hält eine Stunde, weitere Suchen antworten aus dem Speicher.
 */
export function useLiedtextSuche(begriff: string, enabled: boolean) {
  const quelle = useLiedZugriff();
  const q = begriff.trim();
  return useQuery({
    queryKey: ['song-text-search', q],
    // Ohne Liedtext-Suche (Erweiterung) bleibt die Abfrage aus – die Oberfläche bietet sie dann gar nicht an.
    queryFn: () => (quelle.liedtextSuche as (q: string) => Promise<SongTextTreffer[]>)(q),
    enabled: enabled && !!quelle.liedtextSuche && q.length >= LIEDTEXT_SUCHE_MIN_ZEICHEN,
    staleTime: 1000 * 60 * 10,
    // Kein automatischer zweiter Versuch: Ist ChurchTools gedrosselt (503), hilft Wiederholen nicht –
    // die Meldung ist die nützlichere Antwort.
    retry: false,
  });
}

/**
 * Der Textanfang **eines** Liedes für die Vorschau (#379) – **nur auf Verlangen.**
 *
 * `enabled` steuert der Aufrufer: Erst wenn jemand „Text zeigen" antippt, geht die Anfrage los. Eine
 * Vorschau je Listenzeile wäre eine Anfrage je Zeile – für eine Liste, die man nur durchsieht.
 *
 * **`staleTime: Infinity`**, weil Liedtexte sich praktisch nie ändern: Wer zwei gleichnamige Lieder
 * vergleicht, klappt sie mehrfach auf und zu – das darf nicht jedes Mal fragen. Und **kein Retry**: Ein
 * Lied ohne Notenblatt bleibt eines, da hilft Wiederholen nicht.
 */
export function useLiedtextVorschau(songId: number, enabled: boolean) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: ['liedtext-vorschau', songId],
    queryFn: () => quelle.liedtextVorschau(songId),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Der Liedtext eines **SongSelect**-Liedes für die Vorschau (#379).
 *
 * **`staleTime: Infinity` und `gcTime` lang – das ist hier keine Feinheit, sondern die Vorkehrung.** Aufs
 * Kontingent zählt ein Textabruf laut CCLI nicht, ob er in der Nutzungs-Historie erscheint, ist offen;
 * deshalb darf Auf- und Zuklappen desselben Liedes **nicht** erneut fragen. Ein Abruf je Nummer und Sitzung.
 *
 * `enabled` steuert der Aufrufer: erst wenn ein Treffer wirklich geöffnet wird.
 */
export function useSongSelectLiedtext(songNumber: number | null, enabled: boolean) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: ['songselect-liedtext', songNumber],
    queryFn: () => quelle.songSelectLiedtext(songNumber as number),
    enabled: enabled && songNumber !== null,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
  });
}

/**
 * Sucht bei CCLI SongSelect nach einem Titel (#322).
 *
 * **Jede Suche geht über ChurchTools an CCLI** – deshalb wird sie nicht bei jedem Tastendruck
 * ausgelöst: Der Aufrufer gibt den Suchbegriff entprellt herein, und unter drei Zeichen läuft gar
 * nichts. **Kein automatischer zweiter Versuch:** Ein Fehler von CCLI (keine Lizenz, Aussetzer)
 * wiederholt sich meist, und die Meldung ist hier die nützlichere Antwort als ein stiller Retry.
 */
export function useSongSelectSuche(eingabe: string, enabled: boolean) {
  const quelle = useLiedZugriff();
  const begriff = eingabe.trim();
  const art = sucheArt(begriff);
  return useQuery({
    // Die Art gehört in den Schlüssel: „5841527" und ein gleichnamiger Titel sind zwei Abfragen.
    queryKey: ['songselect-search', art.art, begriff],
    queryFn: async (): Promise<SongSelectSuchergebnis> => {
      if (art.art === 'titel') return quelle.songSelectSuche(art.titel);
      /**
       * **Eine CCLI-Nummer ist keine Suche, sondern eine Abfrage** – sie liefert genau ein Lied.
       * Das Ergebnis wird in dieselbe Form gebracht, damit die Trefferliste nicht zwei Fälle kennen
       * muss: ein Treffer, vollständig.
       */
      const lied = await quelle.songSelectLied(art.nummer);
      return { treffer: [lied], gesamt: 1, vollstaendig: true };
    },
    enabled: enabled && begriff.length >= SONGSELECT_MIN_ZEICHEN,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

/** Lädt die Song-Nutzungsdaten (Häufigkeit/zuletzt) im Hintergrund. */
export function useSongUsage(enabled: boolean) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: liedSchluessel.liedNutzung(),
    queryFn: () => quelle.nutzung(),
    enabled,
    staleTime: 1000 * 60 * 30,
  });
}

/* ------------------------------------------------------------------------------------------------------------------
 * „Neues Lied", Stammdaten und Arrangements (LW1b-2, 06.11.2026) – bis dahin in `client/src/hooks/useServices.ts`,
 * wortgleich übernommen. Was nur EINE App neu laden muss (Musik-App: Liedblätter, Abläufe, Arrangement-Auswahl), meldet
 * sie über `nachAenderung` ihres Liedzugriffs; was alle haben (Liederliste, Stammdaten, Arrangements), steht hier.
 * ---------------------------------------------------------------------------------------------------------------- */

/**
 * Lädt die Lied-Kategorien, in denen der Nutzer anlegen/ändern darf (#322).
 *
 * **Kurze Vorhaltezeit (5 min) mit Absicht.** Kategorien ändern sich fast nie, aber die Liste hängt an
 * einem **Recht** – wird es in ChurchTools entzogen, soll die Auswahl nicht stundenlang eine Kategorie
 * anbieten, die es für diesen Nutzer nicht mehr gibt. Die Liedliste darf 10 Minuten alt sein, eine
 * Berechtigung eher nicht.
 */
export function useSongCategories(enabled: boolean) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: liedSchluessel.kategorien(),
    queryFn: () => quelle.kategorien(),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Lädt die Stammdaten eines Liedes für das Änderungsformular (#322, Schritt 11).
 *
 * **`staleTime: 0` mit Absicht.** Diese Abfrage füllt ein Formular, aus dem heraus geschrieben wird –
 * ein alter Stand wäre hier gefährlicher als eine zusätzliche Anfrage. Der Server liest beim Speichern
 * ohnehin noch einmal frisch (`liedAendern`), aber der Nutzer soll auch SEHEN, was gerade gilt.
 */
export function useSongStammdaten(songId: number | null) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: liedSchluessel.liedStammdaten(songId),
    queryFn: () => quelle.stammdaten(songId as number),
    enabled: songId !== null,
    staleTime: 0,
  });
}

/**
 * Ändert die Stammdaten eines Liedes (#322, Schritt 11).
 *
 * Danach ist **alles ungültig, wo ein Liedname steht**: Bibliothek, Chart und – falls das Lied im
 * Ablauf vorkommt – die Abläufe. Bewusst NICHT die Statistik (`song-usage`): Ein umbenanntes Lied wurde
 * nicht öfter oder seltener gespielt – ihre Zahlen ändern sich dadurch nicht.
 */
export function useLiedAendern(songId: number) {
  const qc = useQueryClient();
  const quelle = useLiedZugriff();
  return useMutation({
    mutationFn: (aenderung: Partial<LiedStammdaten>) => quelle.liedAendern(songId, aenderung),
    onSuccess: (stand) => {
      // Den frischen Stand direkt in den Cache legen, damit das Formular nicht kurz den alten zeigt.
      qc.setQueryData(liedSchluessel.liedStammdaten(songId), stand);
      void qc.invalidateQueries({ queryKey: liedSchluessel.liederliste() });
      // Liedblätter und Abläufe der App (Musik-App) – dort steht der Liedname auch.
      quelle.nachAenderung(qc, { art: 'lied', songId });
    },
  });
}

/** Die Arrangements eines Liedes mit allen Feldern (#396) – nur im Stammdaten-Blatt. */
export function useArrangements(songId: number | null) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: liedSchluessel.arrangements(songId),
    queryFn: () => quelle.arrangements(songId as number),
    enabled: songId !== null,
    staleTime: 0,
  });
}

/**
 * Was nach einer Arrangement-Änderung neu geladen werden muss (#396) – **einmal, für alle vier.**
 *
 * Anlegen, Ändern, Standard und Löschen betreffen dieselben Listen: die Arrangements selbst, die
 * Bibliothek (sie zeigt Tonart und Arrangement-ID des **Standards**) und das Blatt dieses Liedes.
 * Vier Kopien dieser Aufzählung wären vier Stellen, an denen jemand eine Liste vergisst – und
 * vergessen heißt hier: Die App zeigt einen Stand, den es in ChurchTools nicht mehr gibt.
 *
 * **Die Statistik bewusst nicht** (`song-usage`): Ein geändertes Arrangement wurde nicht öfter
 * gespielt. Einzige Ausnahme: Ein gelöschtes Arrangement nimmt seine Einsätze mit (ChurchTools zählt je
 * Arrangement). Das zeigt die Statistik, sobald der Stand des Servers verfällt (zehn Minuten) – ein
 * Neuladen hier holte vorher nur denselben gemerkten Stand.
 */
export function arrangementListenErneuern(
  qc: QueryClient,
  quelle: LiedZugriff,
  songId: number,
): void {
  void qc.invalidateQueries({ queryKey: liedSchluessel.arrangements(songId) });
  void qc.invalidateQueries({ queryKey: liedSchluessel.liederliste() });
  // Das Blatt dieses Liedes und die Arrangement-Auswahl der App (Musik-App).
  quelle.nachAenderung(qc, { art: 'arrangement', songId });
}

/** Ändert ein Arrangement (#396). */
export function useArrangementAendern(songId: number) {
  const qc = useQueryClient();
  const quelle = useLiedZugriff();
  return useMutation({
    mutationFn: (v: { arrangementId: number; auftrag: ArrangementAuftrag }) =>
      quelle.arrangementAendern(songId, v.arrangementId, v.auftrag),
    onSuccess: () => arrangementListenErneuern(qc, quelle, songId),
  });
}

/**
 * Legt ein Lied an (#322) – Lied + erstes Arrangement.
 *
 * **Nur die Liedliste wird danach ungültig, nicht die Statistik:** An der Nutzung hat sich nichts
 * geändert; sie neu zu holen wären ChurchTools-Anfragen für nichts (#300). In einen Ablauf kommt das
 * Lied erst über „Neuer Eintrag" – und der lädt den Ablauf selbst neu.
 *
 * Was **nicht** hier steht: ein Wiederholversuch. Ein zweiter Durchlauf legte ein zweites Lied an
 * (siehe `songErstellen.ts`) – React Query wiederholt Mutationen von sich aus nicht, und das bleibt so.
 */
export function useLiedAnlegen() {
  const qc = useQueryClient();
  const quelle = useLiedZugriff();
  return useMutation({
    mutationFn: (auftrag: LiedAnlegenAuftrag) => quelle.liedAnlegen(auftrag),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: liedSchluessel.liederliste() });
    },
  });
}

/**
 * Holt zu einer CCLI-Nummer die **Einzelangaben** – vor allem das Copyright (#378).
 *
 * Die Trefferliste von CCLI enthält es nicht; erst diese Abfrage liefert es. Sie lief vorher als `await`
 * im Klick-Handler von `NewSongSheet`. Seit der Treffer von außen kommt (Suche im Einfüge-Dialog, #378), ist es eine
 * Abfrage: **kein Effekt, der nachlädt** – der lief bei einem neu erzeugten Prop-Objekt endlos – und das
 * Ergebnis liegt danach im Cache, wenn dieselbe Nummer nochmal gebraucht wird.
 *
 * **Ein Fehlschlag ist kein Grund, das Anlegen zu verhindern:** Der Aufrufer zeigt das Formular ohne
 * Copyright, statt eine Meldung zu bringen.
 */
export function useSongSelectSong(songNumber: number | null) {
  const quelle = useLiedZugriff();
  return useQuery({
    queryKey: ['songselect-song', songNumber],
    queryFn: () => quelle.songSelectLied(songNumber as number),
    enabled: songNumber !== null,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
