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
  isVersionFile,
  neuerDateiname,
  safeFileName,
  versionFileName,
  versionNameBisher,
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
  /** Der Schlüssel nach der Erkennung bis 07.10.2026 (`versionNameBisher`) – eine ältere App schickt ihn noch. */
  alterKey: string | null;
}

/** Die Version zu einem Schlüssel – dem heutigen oder dem bis 07.10.2026 gültigen. */
function versionZu(versionen: VersionsDatei[], versionKey: string): VersionsDatei | undefined {
  return (
    versionen.find((v) => v.key === versionKey) ?? versionen.find((v) => v.alterKey === versionKey)
  );
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
      if (!name) return null;
      const bisher = versionNameBisher(file);
      return { file, name, key: versionSlug(name), alterKey: bisher ? versionSlug(bisher) : null };
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
  const aktuell = versionZu(versionen, versionKey);
  if (!aktuell) throw s.fehler(404, 'Version nicht gefunden.');

  const neuerName = versionsName(s, aenderung.name ?? aktuell.name);
  const neuerKey = versionSlug(neuerName);
  if (neuerKey !== aktuell.key && versionen.some((v) => v.key === neuerKey)) {
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
  const aktuell = versionZu(versionen, versionKey);
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
 * Benennt eine Datei des Arrangements um und liefert die frische Liste (31.10.2026).
 *
 * **Gemessen an der Test-Instanz** (`musik-planung/docs/messung-datei-umbenennen-31.10.md`): `PATCH /files/<id>` mit
 * `{ name }` → 204, und der Name ist danach wirklich ein anderer; ID, Adresse und Inhalt bleiben. `PUT` und das Feld
 * `filename` wurden nicht gebraucht. Weil die ID bleibt, bleiben auch die gewählte Anzeige und die Anmerkungen auf
 * einem PDF (beide hängen an der Datei-ID, nicht am Namen).
 *
 * - **Versionen nicht hier:** Ihr Name steckt im Dateinamen samt Lied-Titel und „(App)“, und an ihm hängen Schlüssel
 *   für Tonart und Anmerkungen. Sie gehen über `versionAendern` – die Oberfläche nimmt dafür den Versions-Weg.
 * - **Nachlesen statt glauben:** Ein 2xx allein beweist nichts – `PATCH /files/<id> {securityLevelId}` antwortete
 *   schon einmal 204 und änderte nichts (`plan-extension.md`). Erst die neu gelesene Liste zählt.
 * - Ein gleicher Name daneben wird abgelehnt: ChurchTools hätte nichts dagegen, aber zwei gleich benannte Dateien
 *   sind in jeder Liste eine zu viel.
 */
export async function dateiUmbenennen(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
  fileId: number,
  eingabe: string,
): Promise<ArrangementFileEntry[]> {
  const arr = arrangementAus(await s.song(songId), arrangementId, (st, m) => s.fehler(st, m));
  const datei = arr.files.find((f) => fileIdFromUrl(f.fileUrl) === fileId);
  if (!datei) throw s.fehler(404, 'Datei nicht gefunden.');
  if (isVersionFile(datei)) {
    throw s.fehler(400, 'Eine Version wird über die Version umbenannt, nicht als Datei.');
  }
  const neu = neuerDateiname(datei.name, eingabe);
  if (neu.fehler !== null) throw s.fehler(400, neu.fehler);
  if (neu.name === datei.name) return arrangementFileEntries(arr.files);
  if (arr.files.some((f) => f !== datei && f.name === neu.name)) {
    throw s.fehler(409, `Es gibt hier schon eine Datei „${neu.name}“.`);
  }

  await s.schreibe(`/files/${fileId}`, {
    method: 'PATCH',
    json: { name: neu.name },
    verweigert: 'Keine Berechtigung, Dateien in ChurchTools umzubenennen.',
    fehler: 'Umbenennen in ChurchTools fehlgeschlagen',
  });
  const danach = await dateienListen(s, songId, arrangementId);
  if (danach.find((d) => d.fileId === fileId)?.name !== neu.name) {
    throw s.fehler(
      502,
      'ChurchTools hat den neuen Namen nicht übernommen. Bitte erneut versuchen.',
    );
  }
  return danach;
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
