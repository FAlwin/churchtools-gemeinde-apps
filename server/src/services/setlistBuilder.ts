/**
 * Baut aus den ChurchTools-Rohdaten unsere App-Strukturen:
 *  - Liste der Gottesdienste, die tatsächlich eine Setlist (Agenda mit Songs) haben
 *  - die Songs einer Setlist inkl. heruntergeladenem ChordPro-Inhalt
 */
import type {
  AgendaItem,
  ArrangementFileEntry,
  Service,
  SetlistSong,
  SongLibraryEntry,
  SongVersion,
} from '@shared/types/index';
import { downloadFileText } from './ctFiles.js';
import { CtOverloadedError, isCtOverloaded } from './ctHttp.js';
import { createGebuendelterLauf } from './gebuendelterLauf.js';
import { getAgenda, getAllSongs, getAppointmentSubtitle, getEvents, getSong } from './ctRead.js';
import * as noten from '@shared/ct/notenblaetter';
import { verwalterFuer } from './ctVerwalter.js';
import { altPortFuer } from './ctAjax.js';
import { notenblattAusSongSelect } from '@shared/ct/songselect';
import { liedStatistik, type LiedNutzung } from '@shared/ct/liedStatistik';
import { dateiUrlFinden } from './arrangementFiles.js';
import { setlistFingerprint, agendaSignatureList, fingerprintAusText } from './agendaDiff.js';
import { HttpError } from '../middleware/errorHandler.js';
import { config } from '../config.js';
import {
  ablaufPunkte,
  liedBibliothek,
  liedBlatt,
  termineMitAblauf,
  type CtLeser,
} from '@shared/ct/setlistKern';

/**
 * Der Server-`CtLeser` für den geteilten Aufbau (`@shared/ct/setlistKern`, #335): dieselben Regeln wie
 * in der Extension, nur mit dem Cookie der Sitzung und den Zwischenspeichern des Servers.
 */
function leserFuer(cookie: string, account = ''): CtLeser {
  return {
    events: (from, to) => getEvents(cookie, from, to),
    agenda: (eventId) => getAgenda(cookie, eventId),
    song: (songId) => getSong(cookie, songId),
    alleLieder: () => getAllSongs(cookie),
    untertitel: (calendarId, appointmentId) =>
      getAppointmentSubtitle(cookie, calendarId, appointmentId, account),
    dateiText: (fileUrl) => downloadFileText(cookie, fileUrl),
    fehler: (status, meldung) => new HttpError(status, meldung),
    istUeberlastet: isCtOverloaded,
    zeitzone: config.zeitzone,
  };
}

/** Fingerabdruck der aktuellen Setlist eines Termins (leichter Abruf, ohne ChordPro zu laden). */
export async function getSetlistFingerprint(cookie: string, eventId: number): Promise<string> {
  const agenda = await getAgenda(cookie, eventId);
  return setlistFingerprint(agenda.items ?? []);
}

/** Fingerabdruck + Signatur je Punkt in einem Abruf – für das „gesehen"-Merken (#143/#161). */
export async function getSetlistState(
  cookie: string,
  eventId: number,
): Promise<{ hash: string; items: { id: number; sig: string }[] }> {
  const agenda = await getAgenda(cookie, eventId);
  const items = agenda.items ?? [];
  return { hash: setlistFingerprint(items), items: agendaSignatureList(items) };
}

/**
 * Gottesdienste im Zeitfenster, die einen Ablaufplan haben (mit Song-Anzahl). Liefert je Termin
 * zusätzlich den Setlist-Fingerabdruck (#143), damit der Controller das „geändert"-Badge je Konto
 * bestimmen kann. Der Aufbau liegt in `@shared/ct/setlistKern` (#335).
 */
export async function getServicesWithSetlists(
  cookie: string,
  from: string,
  to: string,
  /** Konto-Kennung (`accountKey`) – nur für das Untertitel-Memo, das je Konto trennt (#199/#306). */
  account: string,
): Promise<{ service: Service; hash: string }[]> {
  const rows = await termineMitAblauf(leserFuer(cookie, account), from, to);
  return rows.map((r) => ({ service: r.service, hash: fingerprintAusText(r.fingerprintText) }));
}

/** Findet die ChurchTools-fileUrl einer Datei (per Datei-ID) zum Durchreichen – oder 404. */
export async function resolveFileUrl(
  cookie: string,
  songId: number,
  fileId: number,
): Promise<string> {
  const url = dateiUrlFinden(await getSong(cookie, songId), fileId);
  if (!url) throw new HttpError(404, 'Datei nicht gefunden.');
  return url;
}

// Versionen, Dateien und das Original-Notenblatt: Regeln seit #335 (3b-2) in `@shared/ct/notenblaetter`.

export function createVersion(
  cookie: string,
  songId: number,
  arrangementId: number,
  name: string,
  text: string,
): Promise<SongVersion> {
  return noten.versionAnlegen(verwalterFuer(cookie), songId, arrangementId, name, text);
}

export function updateVersion(
  cookie: string,
  songId: number,
  arrangementId: number,
  versionKey: string,
  changes: { text?: string; name?: string },
): Promise<SongVersion> {
  return noten.versionAendern(verwalterFuer(cookie), songId, arrangementId, versionKey, changes);
}

export function deleteVersion(
  cookie: string,
  songId: number,
  arrangementId: number,
  versionKey: string,
): Promise<void> {
  return noten.versionLoeschen(verwalterFuer(cookie), songId, arrangementId, versionKey);
}

/**
 * **Die Lied-Statistik kommt aus ChurchTools selbst** (`@shared/ct/liedStatistik`, Alwin 08.10.2026) –
 * ein Aufruf (`getSongStatistic`) plus die Liederliste, statt wie bis dahin für jeden Termin der
 * letzten vier Jahre den Ablauf zu lesen (~250 Anfragen je Lauf, der Auslöser von #300).
 *
 * Org-weit gleich und kurz gemerkt: Der Inhalt (nur Spieltage je Lied) ist für alle gleich und
 * unkritisch; aufgebaut wird mit dem Cookie des ersten Anfragenden im Zeitfenster. Wer das Recht
 * „Lied-Statistik sehen" nicht hat, löst selbst keinen Abruf aus, der gelingt – bekommt aber den Stand
 * eines anderen, solange er gemerkt ist. Das war beim alten Lauf genauso.
 */
let usageCache: { at: number; data: Record<number, LiedNutzung> } | null = null;

/** So lange gilt ein Stand. Der Abruf ist billig – kurz genug, dass ein Gottesdienst bald auftaucht. */
const USAGE_TTL_MS = 10 * 60_000;
/** Sperrfrist nach einer Drosselung – lang genug, dass sich das CT-Limit erholt. */
const USAGE_COOLDOWN_MS = 120_000;
/**
 * Bündelung und Sperrfrist (#300) bleiben, auch für den einen Aufruf: Fünf iPads, die gleichzeitig
 * „Alle Lieder" öffnen, lösen EINEN Abruf aus; nach einer Drosselung wird eine Weile nicht gefragt.
 */
const usageLauf = createGebuendelterLauf<Record<number, LiedNutzung>>(USAGE_COOLDOWN_MS);

/**
 * Der nächste Aufruf holt die Statistik neu (nach einer Ablauf-Änderung). Der gemerkte Stand bleibt
 * bis dahin stehen – scheitert der neue Abruf an einer Drosselung, ist er die bessere Antwort als gar
 * keine Zahlen.
 */
export function invalidateSongUsageCache(): void {
  if (usageCache) usageCache = { ...usageCache, at: 0 };
}

/** Nur für Tests: Cache, laufender Abruf und Sperrfrist zurücksetzen. */
export function __resetSongUsageForTests(): void {
  usageCache = null;
  usageLauf.reset();
}

/**
 * Je Lied die vergangenen Spieltage. Häufigkeit und „zuletzt gespielt" für einen frei gewählten Zeitraum
 * rechnet der Client selbst aus dieser Liste.
 */
export async function getSongUsageMap(cookie: string): Promise<Record<number, LiedNutzung>> {
  if (usageCache && Date.now() - usageCache.at < USAGE_TTL_MS) return usageCache.data;
  // Nach einer Drosselung eine Weile gar nicht erst fragen – sonst verlängert jeder Aufruf sie.
  if (usageLauf.istGesperrt()) {
    if (usageCache) return usageCache.data;
    throw new CtOverloadedError(usageLauf.restMs());
  }
  return usageLauf.fuehreAus(async () => {
    try {
      const data = await liedStatistik(
        altPortFuer(cookie),
        await getAllSongs(cookie),
        config.zeitzone,
      );
      usageCache = { at: Date.now(), data };
      usageLauf.entsperren();
      return data;
    } catch (e) {
      if (!isCtOverloaded(e)) throw e;
      const ms = (e instanceof HttpError ? e.retryAfterMs : undefined) ?? USAGE_COOLDOWN_MS;
      usageLauf.sperren(ms);
      // Der letzte bekannte Stand ist besser als nichts; ohne ihn ein ehrlicher Fehler.
      if (usageCache) return usageCache.data;
      throw new CtOverloadedError(ms);
    }
  });
}

/** Die Lieder für „Alle Lieder" – Regeln in `@shared/ct/setlistKern` (#335). */
export function getSongLibrary(cookie: string): Promise<SongLibraryEntry[]> {
  return liedBibliothek(leserFuer(cookie));
}

/** Baut die Chart-Daten eines einzelnen Lieds (für die „Alle Lieder"-Ansicht). */
export function getSongChart(
  cookie: string,
  songId: number,
  arrangementId?: number,
): Promise<SetlistSong> {
  return liedBlatt(leserFuer(cookie), songId, arrangementId);
}

/**
 * Alle Punkte eines Ablaufplans in Reihenfolge – Lieder aufgelöst, übrige nur als Eintrag.
 * `prevSigs` (zuletzt gesehener Stand, #161): ist es gesetzt, bekommt jeder geänderte/neue/
 * verschobene Punkt `changed: true`. Der Aufbau liegt in `@shared/ct/setlistKern` (#335).
 */
export function getAgendaItems(
  cookie: string,
  eventId: number,
  prevSigs?: { id: number; sig: string; title?: string }[],
): Promise<AgendaItem[]> {
  return ablaufPunkte(leserFuer(cookie), eventId, prevSigs);
}

export function listArrangementFiles(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<ArrangementFileEntry[]> {
  return noten.dateienListen(verwalterFuer(cookie), songId, arrangementId);
}

export function addArrangementFile(
  cookie: string,
  songId: number,
  arrangementId: number,
  datei: { filename: string; mime: string; inhalt: Uint8Array },
): Promise<ArrangementFileEntry[]> {
  return noten.dateiHinzufuegen(verwalterFuer(cookie), songId, arrangementId, datei);
}

export function removeArrangementFile(
  cookie: string,
  songId: number,
  fileId: number,
): Promise<void> {
  return noten.dateiEntfernen(verwalterFuer(cookie), songId, fileId);
}

/**
 * Das Notenblatt eines Liedes aus CCLI SongSelect ins Arrangement holen (#322, Schritt 9).
 *
 * **Pro Arrangement genau EIN Original-ChordPro.** Aus der Messung vom 11.08.2026: Die Datei bringt
 * ihre Tonart selbst mit (`{key: …}`), und `buildSong` sucht das Notenblatt mit
 * `files.find(isOriginalChordpro)` – die **erste** gewinnt. Lägen zwei da, entschiede die Reihenfolge
 * von ChurchTools, welche Fassung (und welche Tonart!) angezeigt wird. Nichts kracht, es ist nur
 * plötzlich anders. Deshalb wird ersetzt, nicht danebengelegt.
 *
 * **ERST holen, DANN das alte löschen** – und diese Reihenfolge ist der Kern dieser Funktion.
 * Andersherum stünde das Lied ohne Notenblatt da, sobald der Abruf bei CCLI scheitert (Netz, Lizenz,
 * Zeitüberschreitung). Im schlimmsten Fall bleibt so ein Doppel liegen; das ist ärgerlich, aber
 * behebbar – ein Lied ohne Blatt im Gottesdienst ist es nicht.
 *
 * **Die verwalteten Versionen bleiben unangetastet.** Sie gehören der App und dem Nutzer, nicht
 * CCLI; ersetzt wird nur das Original.
 */
export function holeChordProAusSongSelect(
  cookie: string,
  songId: number,
  arrangementId: number,
  songNumber: number,
): Promise<ArrangementFileEntry[]> {
  // Tonart-Regel und Reihenfolge stehen seit 3b-5 in `@shared/ct/songselect` (#335).
  return notenblattAusSongSelect(
    verwalterFuer(cookie),
    altPortFuer(cookie),
    songId,
    arrangementId,
    songNumber,
  );
}

export function originalNotenblattSchreiben(
  cookie: string,
  songId: number,
  arrangementId: number,
  text: string,
): Promise<ArrangementFileEntry[]> {
  return noten.notenblattSchreiben(verwalterFuer(cookie), songId, arrangementId, text);
}
