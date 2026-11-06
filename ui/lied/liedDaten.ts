/**
 * **Die Daten der Liedwahl** – die Abfragen samt Zwischenspeicher-Regeln (TanStack Query), einmal für alle Apps.
 *
 * Bis zum 06.11.2026 in `client/src/hooks/useServices.ts`; mit der Liedwahl nach `ui/lied` umgezogen (Dienstplaner-
 * Bauplan E9, Wunsch 4 „LW1a"). **Wortgleich übernommen** – dieselben Schlüssel, Haltezeiten und Wiederholregeln –,
 * nur dass die Daten jetzt über den `LiedZugriff` der jeweiligen App kommen. Die Musik-App erneuert ihre Liederliste
 * weiter über `schluessel.liederliste()`; der zeigt auf `liedSchluessel` hier, damit es den Schlüssel nur einmal gibt.
 */
import { useQuery } from '@tanstack/react-query';
import type { SongSelectSuchergebnis, SongTextTreffer } from '@shared/types/index';
import { LIEDTEXT_SUCHE_MIN_ZEICHEN } from '@shared/types/index';
import { useLiedZugriff } from './liedZugriff';
import { SONGSELECT_MIN_ZEICHEN, sucheArt } from './suchRegeln';

/** Die Schlüssel, die auch außerhalb der Liedwahl gebraucht werden (Erneuern nach Anlegen/Ändern eines Lieds). */
export const liedSchluessel = {
  liedNutzung: () => ['song-usage'] as const,
  liederliste: () => ['song-library'] as const,
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
