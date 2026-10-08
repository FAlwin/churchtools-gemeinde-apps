/**
 * CCLI SongSelect über ChurchTools (#322) – die App als **Fernbedienung**.
 *
 * **Warum das geht, obwohl SongSelect zertifizierten Partnern vorbehalten ist:** Nicht wir fragen bei
 * CCLI an, sondern ChurchTools. Es ist der zertifizierte Partner, die Gemeinde hat das Abo, und diese
 * Datei löst nur aus, was in der ChurchTools-Oberfläche ohnehin vorhanden ist – mit dem Cookie des
 * Nutzers und seinem CSRF-Token.
 *
 * **Die alte Schnittstelle wird hier nicht selbst angesprochen.** `POST /index.php?q=churchservice/ajax`
 * ist undokumentiert und intern; sie liegt hinter `ctAjax.ts` – der einzigen Stelle, die sie kennt.
 * Bis #322/Schritt 7 stand diese Funktion privat hier, weil SongSelect ihr erster Nutzer war; mit den
 * Lied-Kategorien kam ein zweiter, und eine zweite Fassung daneben ist die Fehlerklasse, die dieses
 * Projekt am häufigsten getroffen hat. Alles andere im Projekt geht über `/api/` – siehe
 * `ctRead`/`ctWrite`.
 *
 * Vollständig gemessen und begründet in `docs/entwicklung/churchtools-songselect.md`.
 *
 * Suche und Abfrage ändern nichts und dürfen beliebig wiederholt werden; `fetchChordProText` holt nur
 * Text und legt selbst keine Datei an.
 */
import { altPortFuer } from './ctAjax.js';
import {
  songSelectChordPro,
  songSelectLied,
  songSelectLiedtext,
  songSelectSuchen,
} from '@shared/ct/songselect';
import type {
  SongSelectLiedtext,
  SongSelectSong,
  SongSelectSuchergebnis,
} from '@shared/types/index';

// Seit Phase 3b-5 (#335) stehen Aufrufe, Auswertung und Meldungen in `@shared/ct/songselect` – die
// Erweiterung spricht SongSelect mit denselben Regeln aus dem Browser an. Hier bleibt nur der Anschluss
// (`altPortFuer`: alte Schnittstelle mit dem Cookie des Nutzers, Fehlerklasse des Servers).

/** Nach Titel suchen (#322) – siehe `songSelectSuchen`. */
export function searchSongSelect(
  cookie: string,
  songTitle: string,
): Promise<SongSelectSuchergebnis> {
  return songSelectSuchen(altPortFuer(cookie), songTitle);
}

/** Ein Lied per CCLI-Nummer (#322) – siehe `songSelectLied`. */
export function getSongSelectSong(cookie: string, songNumber: number): Promise<SongSelectSong> {
  return songSelectLied(altPortFuer(cookie), songNumber);
}

/** Den Liedtext (#379) – siehe `songSelectLiedtext`. */
export function getSongSelectLyrics(
  cookie: string,
  songNumber: number,
): Promise<SongSelectLiedtext> {
  return songSelectLiedtext(altPortFuer(cookie), songNumber);
}

/** Den ChordPro-Text holen, ohne Datei (#322, Schritt 9) – siehe `songSelectChordPro`. */
export function fetchChordProText(
  cookie: string,
  auftrag: { arrangementId: number; songNumber: number; title: string; tonality: string },
): Promise<string> {
  return songSelectChordPro(altPortFuer(cookie), auftrag);
}
