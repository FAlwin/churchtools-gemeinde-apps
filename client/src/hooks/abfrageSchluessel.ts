/**
 * **Die Schlüssel des Abfrage-Zwischenspeichers (TanStack Query) – an EINER Stelle** (#492).
 *
 * Vorher standen rund 70 Schlüssel von Hand im Code. Ein Tippfehler beim Erneuern
 * (`invalidateQueries`) täte nichts und bliebe still. Und ein Baustein half nur halb: `chartQueryKey`
 * war angelegt, „damit Abruf und Vorladen sich den Zwischenspeicher wirklich teilen", aber
 * `useSongChart` baute seinen Schlüssel trotzdem selbst.
 *
 * **Regel:** Ein Schlüssel, der an mehr als einer Stelle gebraucht wird (Abruf UND Erneuern, oder
 * mehrere Abrufe), kommt hierher. Die engeren Schlüssel bauen auf den weiteren auf
 * (`agenda(id)` beginnt mit `agendaAlle()`) – so trifft ein Erneuern über den weiteren Schlüssel
 * die engeren sicher mit.
 *
 * **Die Namen sind Teil des gespeicherten Zwischenspeichers** (IndexedDB, `queryClient.ts`). Wer einen
 * umbenennt, verliert den Offline-Vorrat bis zum nächsten Laden – nur zusammen mit einem neuen
 * App-Stand (`buster`) ändern.
 */
import { queryOptions } from '@tanstack/react-query';
import * as api from '../services/churchtoolsApi';

export const schluessel = {
  ich: () => ['me'] as const,
  gemeindeKonfiguration: () => ['site-config'] as const,

  /** Alle Terminlisten – die aktuelle UND die vergangenen Monate. */
  termine: () => ['services'] as const,
  termineVergangen: (monateZurueck: number) =>
    [...schluessel.termine(), 'past', monateZurueck] as const,

  /** Alle Abläufe – zum Erneuern, wenn sich ein Lied ändert, das in vielen stehen kann. */
  agendaAlle: () => ['agenda'] as const,
  agenda: (eventId: number | null) => [...schluessel.agendaAlle(), eventId] as const,

  liedNutzung: () => ['song-usage'] as const,
  liederliste: () => ['song-library'] as const,
  liedStammdaten: (songId: number | null) => ['song-stammdaten', songId] as const,

  /** Alle Liedblätter eines Lieds, gleich welches Arrangement. */
  liedblaetter: (songId: number) => ['song-chart', songId] as const,
  /** Ohne `arrangementId` das Standard-Arrangement des Lieds. */
  liedblatt: (songId: number, arrangementId?: number) =>
    [...schluessel.liedblaetter(songId), arrangementId] as const,

  arrangements: (songId: number | null) => ['arrangements', songId] as const,
  liedArrangements: (songId: number | null) => ['song-arrangements', songId] as const,
  arrangementDateien: (songId: number, arrangementId: number) =>
    ['arrangement-files', songId, arrangementId] as const,
};

/**
 * Der Ablauf eines Termins – für `useAgenda`, das Vorladen in den Offline-Vorrat und den
 * Speichern-Knopf der Terminliste.
 *
 * Bewusst ohne Frische-Zeit: `fetchQuery` (Offline-Vorrat) soll wie bisher frisch holen; die 30 s
 * gibt `useAgenda` dazu.
 */
export function agendaAbfrage(eventId: number | null) {
  return queryOptions({
    queryKey: schluessel.agenda(eventId),
    queryFn: () => api.getAgenda(eventId as number),
    enabled: eventId !== null,
  });
}

/**
 * Ein Liedblatt (ChordPro + Metadaten) – für `useSongChart`, das Vorladen anderer Arrangements und die
 * Arrangement-Überschreibung im Ablauf (#320). Alle drei teilen sich damit den Zwischenspeicher.
 */
export function liedblattAbfrage(songId: number, arrangementId?: number) {
  return queryOptions({
    queryKey: schluessel.liedblatt(songId, arrangementId),
    queryFn: () => api.getSongChart(songId, arrangementId),
    staleTime: 1000 * 60 * 5,
  });
}
