/**
 * Notenblätter, Versionen und Dateien eines Arrangements – **für beide Auslieferungen** (#335, 3b-2).
 *
 * Lag bis dahin im Server (`setlistBuilder.ts`, Teile von `ctWrite.ts`). Hochgeladen wird über
 * `hochladen` des Aufrufers: `shared` kennt kein `FormData` (nur ES2022), Server und Browser bauen das
 * Formular je selbst. Die Regeln drumherum – welche Datei eine Version ist, wie sie heißt, was ersetzt
 * wird – stehen hier, einmal.
 *
 * **ChurchTools ersetzt eine Datei gleichen Namens NICHT** – sie liegt danach zweimal da. Wer ersetzt,
 * löscht die alte selbst; und zwar **erst, wenn die neue sicher liegt** (Lehre vom 11.08.2026).
 */
import type { ArrangementFileEntry, SongVersion } from '../types/index';
import {
  arrangementFileEntries,
  dateiUrlFinden,
  fileIdFromUrl,
  isOriginalChordpro,
  safeFileName,
  versionFileName,
  versionNameOf,
  versionSlug,
} from './arrangementFiles';
import { metaValue } from './chordproMeta';
import { arrangementAus, type CtSchreiber } from './schreibKern';
import type { CtArrangementFile } from './typen';

/** Eine hochzuladende Datei – Name, Art und Inhalt. Bytes für Binärdateien, Text für ChordPro. */
export interface HochzuladendeDatei {
  filename: string;
  /** MIME-Art, wie ChurchTools sie speichern soll (`text/plain`, `application/pdf`, …). */
  mime: string;
  inhalt: string | Uint8Array;
}

/** Meldungen eines Uploads – die Dateiverwaltung sagt es anders als das Notenblatt. */
export interface UploadMeldungen {
  verweigert: string;
  fehler: string;
}

/** Was Notenblätter und Dateien zusätzlich zum Schreiben brauchen. */
export interface CtNotenSchreiber extends CtSchreiber {
  /** Lädt eine Datei an ein Arrangement (`POST /files/song_arrangement/<id>`). Kein Wiederholversuch. */
  hochladen(
    arrangementId: number,
    datei: HochzuladendeDatei,
    meldungen: UploadMeldungen,
  ): Promise<void>;
  /** Eine Arrangement-Datei als Text (für das Umbenennen einer Version). */
  dateiText(fileUrl: string): Promise<string>;
}

const DATEI_MELDUNGEN: UploadMeldungen = {
  verweigert: 'Keine Berechtigung, Dateien in ChurchTools zu speichern.',
  fehler: 'Hochladen nach ChurchTools fehlgeschlagen',
};
const NOTEN_MELDUNGEN: UploadMeldungen = {
  verweigert: 'Keine Berechtigung, in ChurchTools zu speichern.',
  fehler: 'Speichern in ChurchTools fehlgeschlagen',
};

function chordproHochladen(
  s: CtNotenSchreiber,
  arrangementId: number,
  filename: string,
  text: string,
): Promise<void> {
  return s.hochladen(
    arrangementId,
    { filename, mime: 'text/plain', inhalt: text },
    NOTEN_MELDUNGEN,
  );
}

/** Löscht eine Datei in ChurchTools. „Schon weg" ist kein Fehler. */
export async function dateiLoeschen(s: CtSchreiber, fileId: number): Promise<void> {
  await s.schreibe(`/files/${fileId}`, {
    method: 'DELETE',
    verweigert: 'Keine Berechtigung zum Löschen in ChurchTools.',
    fehler: 'Löschen in ChurchTools fehlgeschlagen',
    okBei404: true,
  });
}

// ── Versionen ────────────────────────────────────────────────────────────────

interface VersionsDatei {
  file: CtArrangementFile;
  name: string;
  key: string;
}

/** Die verwalteten Versionen eines Arrangements (Dateien mit `(App)`-Marker) samt Liedname. */
async function versionenLaden(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
): Promise<{ songName: string; versionen: VersionsDatei[] }> {
  const song = await s.song(songId);
  const arr = arrangementAus(song, arrangementId, (st, m) => s.fehler(st, m));
  const versionen = arr.files
    .map((file) => {
      const name = versionNameOf(file);
      return name ? { file, name, key: versionSlug(name) } : null;
    })
    .filter((v): v is VersionsDatei => v !== null);
  return { songName: song.name, versionen };
}

/** Prüft einen Versionsnamen: nicht leer, nicht „Original" (reserviert). Liefert ihn getrimmt. */
function versionsName(s: CtSchreiber, name: string): string {
  const n = name.trim();
  if (!n) throw s.fehler(400, 'Bitte einen Versionsnamen angeben.');
  if (/^original$/i.test(n)) throw s.fehler(400, '„Original" ist reserviert.');
  return n;
}

export async function versionAnlegen(
  s: CtNotenSchreiber,
  songId: number,
  arrangementId: number,
  name: string,
  text: string,
): Promise<SongVersion> {
  const n = versionsName(s, name);
  const key = versionSlug(n);
  const { songName, versionen } = await versionenLaden(s, songId, arrangementId);
  if (versionen.some((v) => v.key === key)) {
    throw s.fehler(409, `Es gibt bereits eine Version „${n}".`);
  }
  await chordproHochladen(s, arrangementId, versionFileName(songName, n), text);
  return { key, name: n, text, writtenKey: metaValue(text, 'key') };
}

/**
 * Ändert Text und/oder Namen einer Version.
 *
 * **Erst die neue Datei, dann die alte weg** (geändert beim Umzug nach `shared`, 07.10.2026): Bis dahin
 * wurde die alte Datei ZUERST gelöscht. Scheiterte danach das Hochladen (Netz, Drosselung,
 * Zeitüberschreitung), war die Version verloren – genau die Lehre vom 11.08.2026. Jetzt liegen kurz
 * zwei Dateien da; die alte geht über ihre gemerkte ID, also nie die neue.
 */
export async function versionAendern(
  s: CtNotenSchreiber,
  songId: number,
  arrangementId: number,
  versionKey: string,
  aenderung: { text?: string; name?: string },
): Promise<SongVersion> {
  const { songName, versionen } = await versionenLaden(s, songId, arrangementId);
  const aktuell = versionen.find((v) => v.key === versionKey);
  if (!aktuell) throw s.fehler(404, 'Version nicht gefunden.');

  const neuerName = versionsName(s, aenderung.name ?? aktuell.name);
  const neuerKey = versionSlug(neuerName);
  if (neuerKey !== versionKey && versionen.some((v) => v.key === neuerKey)) {
    throw s.fehler(409, `Es gibt bereits eine Version „${neuerName}".`);
  }

  // Text: neuer Text oder der bisherige Inhalt (bei reiner Umbenennung).
  const text = aenderung.text ?? (await s.dateiText(aktuell.file.fileUrl));
  await chordproHochladen(s, arrangementId, versionFileName(songName, neuerName), text);
  const alteId = fileIdFromUrl(aktuell.file.fileUrl);
  if (alteId) await dateiLoeschen(s, alteId);
  return { key: neuerKey, name: neuerName, text, writtenKey: metaValue(text, 'key') };
}

/** Löscht eine Version. Gibt es sie nicht (mehr), ist nichts zu tun. */
export async function versionLoeschen(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
  versionKey: string,
): Promise<void> {
  const { versionen } = await versionenLaden(s, songId, arrangementId);
  const aktuell = versionen.find((v) => v.key === versionKey);
  if (!aktuell) return;
  const id = fileIdFromUrl(aktuell.file.fileUrl);
  if (id) await dateiLoeschen(s, id);
}

// ── Dateien ──────────────────────────────────────────────────────────────────

/** ALLE Dateien eines Arrangements (Dateiverwaltung, #321). */
export async function dateienListen(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
): Promise<ArrangementFileEntry[]> {
  const arr = arrangementAus(await s.song(songId), arrangementId, (st, m) => s.fehler(st, m));
  return arrangementFileEntries(arr.files);
}

/**
 * Fügt eine Datei hinzu und liefert die frische Liste – der Aufrufer braucht die neue Datei-ID, und
 * ein zweiter Abruf wäre eine Anfrage mehr gegen ChurchTools (#300).
 */
export async function dateiHinzufuegen(
  s: CtNotenSchreiber,
  songId: number,
  arrangementId: number,
  datei: HochzuladendeDatei,
): Promise<ArrangementFileEntry[]> {
  const filename = safeFileName(datei.filename);
  if (!filename) throw s.fehler(400, 'Bitte einen Dateinamen angeben.');
  // Gehört das Arrangement zum Lied? Sonst ließe sich an ein fremdes Lied hochladen.
  arrangementAus(await s.song(songId), arrangementId, (st, m) => s.fehler(st, m));
  await s.hochladen(arrangementId, { ...datei, filename }, DATEI_MELDUNGEN);
  return dateienListen(s, songId, arrangementId);
}

/** Löscht eine Datei des Lieds – nur, wenn sie wirklich zu ihm gehört. */
export async function dateiEntfernen(
  s: CtSchreiber,
  songId: number,
  fileId: number,
): Promise<void> {
  if (!dateiUrlFinden(await s.song(songId), fileId)) throw s.fehler(404, 'Datei nicht gefunden.');
  await dateiLoeschen(s, fileId);
}

/**
 * Schreibt das **Original**-Notenblatt (`<Titel>.chordpro`) neu.
 *
 * Vor dem Schreiben wird gemerkt, was ersetzt werden soll – danach ist die neue Datei nicht mehr von
 * der alten zu unterscheiden (beide heißen gleich). Erst hochladen, dann die alten löschen; ein
 * Fehlschlag beim Aufräumen darf den Erfolg nicht umwerfen – das neue Blatt liegt schon da.
 */
export async function notenblattSchreiben(
  s: CtNotenSchreiber,
  songId: number,
  arrangementId: number,
  text: string,
): Promise<ArrangementFileEntry[]> {
  const song = await s.song(songId);
  const arr = arrangementAus(song, arrangementId, (st, m) => s.fehler(st, m));
  const vorher = arr.files.filter(isOriginalChordpro).map((f) => fileIdFromUrl(f.fileUrl));

  await s.hochladen(
    arrangementId,
    { filename: `${safeFileName(song.name)}.chordpro`, mime: 'text/plain', inhalt: text },
    DATEI_MELDUNGEN,
  );
  for (const id of vorher) {
    if (id !== null) await dateiLoeschen(s, id).catch(() => undefined);
  }
  return dateienListen(s, songId, arrangementId);
}
