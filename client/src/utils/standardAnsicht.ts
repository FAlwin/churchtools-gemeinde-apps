/**
 * **Was ein Lied beim ersten Öffnen zeigt** – Akkorde oder sein Dokument (PDF/Bild).
 *
 * Anlass (07.10.2026): Eine Gemeinde ohne SongSelect Premium hat keine ChordPro-Dateien, nur PDFs. Die
 * App öffnete trotzdem jedes Lied in der (leeren) Akkord-Ansicht, und jeder musste bei jedem Lied auf
 * das PDF umstellen. Alwin entschied „beides":
 *  - **automatisch:** Ein Lied ohne ChordPro zeigt sein Dokument,
 *  - **Gemeinde-Einstellung** `SiteConfig.standardAnsicht`: „PDF zuerst" für alle Lieder mit Dokument.
 *
 * Eine eigene Wahl am Lied (Menü → Akkorde/Dokument) geht immer vor – das regelt `loadSettings`.
 *
 * **Dazu die persönliche Wahl „Lieder öffnen mit: Nur Text“** (Alwin, 30.10.2026: „Für Sänger würde es Sinn machen,
 * dass man voreinstellen kann, dass immer Nur Text als erstes gewählt ist“). Sie gilt für das ganze Konto und damit auf
 * jedem Gerät (`worship_start_0`, siehe `KONTO_ID`) und geht der Gemeinde-Einstellung „PDF zuerst“ vor: Eine Sängerin,
 * die Nur Text gewählt hat, soll nicht doch die Noten sehen. Ein Lied ohne Text zeigt weiter sein Dokument.
 */
import type { SetlistSong, StandardAnsicht } from '@shared/types/index';
import { KONTO_ID } from '@shared/keys/index';
import { getGemeindeAnsicht, setGemeindeAnsicht } from './devicePrefs';
import { lsSong, setLsSong } from './songVersions';

/** Womit ein Lied öffnet, an dem man selbst noch nichts gewählt hat – persönlich, für das ganze Konto. */
export type LiedStart = 'akkorde' | 'text';

export function liedStart(): LiedStart {
  return lsSong('start', KONTO_ID) === 'text' ? 'text' : 'akkorde';
}

/** „Akkorde & Text“ ist die Vorgabe und wird nicht gespeichert – so bleibt ein Konto ohne Wahl ohne Eintrag. */
export function setLiedStart(start: LiedStart): void {
  setLsSong('start', KONTO_ID, start === 'text' ? 'text' : null);
}

/**
 * Die Ansicht der Gemeinde, wie sie das Gerät zuletzt geladen hat (`devicePrefs`).
 *
 * **Warum gemerkt statt nur aus der geladenen Einstellung:** `loadSettings` läuft auch, bevor die
 * Gemeinde-Einstellung da ist – und offline im Saal kommt sie gar nicht. Ohne Merken fiele die App
 * dann still auf „Akkorde" zurück, genau in dem Moment, in dem es zählt.
 */
export const gemeindeAnsicht = getGemeindeAnsicht;

/** Merkt die Ansicht aus einer **geladenen** Gemeinde-Einstellung (nicht aus den Vorgaben). */
export function merkeGemeindeAnsicht(ansicht: StandardAnsicht | undefined): void {
  setGemeindeAnsicht(ansicht ?? 'akkorde');
}

/** Das Dokument, das ein Lied zeigt, wenn es eins zeigt: das erste PDF, sonst das erste Bild. */
export function standardDokument(song: SetlistSong): number | null {
  const doc = song.documents.find((d) => d.type === 'pdf') ?? song.documents[0];
  return doc ? doc.fileId : null;
}

/**
 * Die Anzeigequelle, wenn am Lied nichts gewählt ist.
 *
 * „Ohne ChordPro" heißt: kein Original-Text und keine Versionen. Ein Lied, dessen Datei nur gerade
 * **nicht geladen werden konnte** (`chordproFailed`), zählt nicht dazu – es bleibt bei den Akkorden,
 * wo der Fehler angezeigt wird. Vorübergehend ist nicht ungültig: Ein Aussetzer darf die Ansicht nicht
 * still umstellen.
 */
export function standardQuelle(
  song: SetlistSong,
  ansicht: StandardAnsicht,
  start: LiedStart = 'akkorde',
): 'chords' | number {
  const doc = standardDokument(song);
  if (doc === null) return 'chords';
  const ohneChordpro = !song.chordpro && !song.chordproFailed && song.versions.length === 0;
  if (ohneChordpro) return doc;
  // Persönlich „Nur Text“ schlägt die Gemeinde-Einstellung „PDF zuerst“: Text gibt es ja.
  if (start === 'text') return 'chords';
  return ansicht === 'dokument' ? doc : 'chords';
}
