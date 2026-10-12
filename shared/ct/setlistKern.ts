/**
 * Der Aufbau von Terminliste, Ablauf und Liedblatt aus den ChurchTools-Rohdaten – **geteilt von Server
 * und ChurchTools-Extension** (#335). Lag bis dahin in `server/src/services/setlistBuilder.ts`.
 *
 * Unterschiedlich ist nur, WIE mit ChurchTools gesprochen wird: Der Server nutzt das Cookie der
 * Sitzung, die Extension die Sitzung der Seite. Das steckt im `CtLeser`, den der Aufrufer mitgibt.
 * Die Regeln selbst stehen nur hier – eine Korrektur am Liedblatt gilt damit für beide Auslieferungen.
 * (Zwei Fassungen dieser Logik wären genau die Fehlerklasse, die dieses Projekt am häufigsten getroffen
 * hat: dieselbe Regel an zwei Stellen, die Korrektur nur an einer.)
 *
 * Rein bis auf den `CtLeser`: kein Node, kein DOM.
 */
import type {
  AgendaItem,
  Service,
  SetlistSong,
  SongArrangementOption,
  SongLibraryEntry,
  SongVersion,
} from '../types/index';
import { isoTag } from './zeit';
import { agendaSignatureList, diffAgendaItems, fingerprintRohtext } from './agendaDiff';
import { formatBerlinTime, isHeaderType, responsibleEntries } from './agendaFormat';
import {
  documentsOf,
  isOriginalChordpro,
  isVersionFile,
  versionNameBisher,
  versionNameOf,
  versionSlug,
} from './arrangementFiles';
import { metaValue } from './chordproMeta';
import { mapEventToService } from './mapEvent';
import { mapLimit } from './mapLimit';
import {
  alsTempoZahl,
  type CtAgenda,
  type CtAgendaSong,
  type CtArrangementFile,
  type CtEvent,
  type CtService,
  type CtSong,
  type CtSongListEntry,
} from './typen';

/**
 * Wie mit ChurchTools gesprochen wird – vom Aufrufer gestellt.
 *
 * Fehler müssen eine Eigenschaft `status` tragen (404 = gibt es nicht). Der Server wirft dafür seinen
 * `HttpError`, die Extension ihren `ApiError` – beide haben sie.
 */
export interface CtLeser {
  events(from: string, to: string): Promise<CtEvent[]>;
  agenda(eventId: number): Promise<CtAgenda>;
  song(songId: number): Promise<CtSong>;
  alleLieder(): Promise<CtSongListEntry[]>;
  /** Untertitel eines Kalender-Termins; `null` bei keinem ODER bei Fehler (nie werfen). */
  untertitel(calendarId: string, appointmentId: number): Promise<string | null>;
  /** Eine Arrangement-Datei als Text. 404 = Datei gibt es in ChurchTools nicht mehr. */
  dateiText(fileUrl: string): Promise<string>;
  /** Einen Fehler mit Status erzeugen – in der Fehlerklasse des Aufrufers. */
  fehler(status: number, meldung: string): Error;
  /** Heißt der Fehler „ChurchTools kann gerade nicht mehr" (429, Zeitüberschreitung, #300)? */
  istUeberlastet(e: unknown): boolean;
  /** Zeitzone der Gemeinde (#414). */
  zeitzone: string;
}

/** Standard-Zeitfenster der Terminliste: 1 Woche zurück bis 6 Wochen voraus. */
export function standardFenster(jetzt: Date = new Date()): { from: string; to: string } {
  return {
    from: isoTag(new Date(jetzt.getTime() - 7 * 86400000)),
    to: isoTag(new Date(jetzt.getTime() + 42 * 86400000)),
  };
}

/**
 * „Geändert"-Punkt je Konto (#143): mit dem zuletzt gesehenen Fingerabdruck vergleichen. Ohne
 * gemerkten Stand (nie geöffnet) gilt ein Termin NICHT als geändert – kein Fehlalarm bei Erstnutzung.
 */
export function setlistGeaendert(gesehen: { hash: string } | undefined, hash: string): boolean {
  return gesehen != null && gesehen.hash !== hash;
}

/** Die Arrangements eines Lieds als Auswahl (für „Zu Ablauf hinzufügen"). */
export function arrangementOptionen(song: CtSong): SongArrangementOption[] {
  return (song.arrangements ?? []).map((a) => ({
    arrangementId: a.id,
    arrangementName: a.name,
    key: a.keyOfArrangement ?? a.key ?? null,
  }));
}

/** Der Untertitel aus der Antwort von `GET /calendars/{id}/appointments/{id}` – leer zählt als keiner. */
export function untertitelAus(data: {
  appointment?: { subtitle?: string };
  subtitle?: string;
}): string | null {
  const roh = data.appointment?.subtitle ?? data.subtitle ?? null;
  return roh && roh.trim() ? roh.trim() : null;
}

/** ChurchTools-Dienste (Musik, Predigt …) für die Verantwortlich-Chips – sortiert wie in ChurchTools. */
export function dienstReihenfolge(dienste: CtService[]): CtService[] {
  return [...dienste].sort(
    (a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || a.name.localeCompare(b.name, 'de'),
  );
}

/** Trägt der Fehler den Status 404 (gibt es nicht)? */
export function istNichtGefunden(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { status?: unknown }).status === 404;
}

/**
 * Beim Sammeln über viele Termine ist ein fehlender Ablaufplan (404) normal und wird still
 * übersprungen. Ein anderer Fehler (CT-500, Netz-Aussetzer) darf NICHT unbemerkt Termine aus der
 * Liste/Statistik fallen lassen – daher einmal pro Vorkommen warnen.
 */
export function skipMissingAgenda(context: string, e: unknown): void {
  if (istNichtGefunden(e)) return; // kein Ablaufplan – erwartet
  console.warn(`${context}: Ablauf-Abruf fehlgeschlagen (Termin übersprungen):`, e);
}

/**
 * Gottesdienste im Zeitfenster, die einen Ablaufplan haben (mit Song-Anzahl). Liefert je Termin
 * zusätzlich den Text für den Setlist-Fingerabdruck (#143) – gehasht wird beim Aufrufer.
 *
 * **Bremst ChurchTools (429, Zeitüberschreitung), wirft der ganze Lauf** (#300, #335): Vorher wurde
 * auch das als „Termin übersprungen" verbucht – die Liste kam dann lückenhaft zurück und galt als
 * Wahrheit; Termine verschwanden, bis ChurchTools sich erholt hatte. Jetzt startet nach der ersten
 * Drosselung keine weitere Anfrage, und der Aufrufer behält seinen letzten vollständigen Stand.
 * „Vorübergehend ist nicht ungültig."
 */
export async function termineMitAblauf(
  leser: CtLeser,
  from: string,
  to: string,
): Promise<{ service: Service; fingerprintText: string }[]> {
  const events = await leser.events(from, to);
  // mapLimit liefert in Fertigstellungs-Reihenfolge → Start-Zeitpunkt (ISO inkl. Uhrzeit)
  // mitführen und am Ende danach sortieren (sonst stehen gleich-tägige Events falsch).
  const rows: { service: Service; fingerprintText: string; start: string }[] = [];
  let ueberlastung: unknown = null;
  // Max. 8 Events gleichzeitig (je 2 CT-Abrufe) – schont die ChurchTools-API.
  await mapLimit(events, 8, async (ev) => {
    if (ueberlastung) return; // nach der ersten Drosselung keine weitere Anfrage
    try {
      const calId = ev.calendar?.domainIdentifier;
      // Agenda + Termin-Untertitel parallel laden.
      const [agenda, subtitle] = await Promise.all([
        leser.agenda(ev.id),
        calId && ev.appointmentId
          ? leser.untertitel(calId, ev.appointmentId)
          : Promise.resolve(null),
      ]);
      const items = agenda.items ?? [];
      const songCount = items.filter((i) => i.song).length;
      // Sichtbar, sobald ein Ablaufplan existiert – auch ohne Lieder.
      rows.push({
        service: {
          ...mapEventToService(ev, songCount, subtitle, leser.zeitzone),
          ablaufAbgeschlossen: agenda.isLocked === true,
        },
        fingerprintText: fingerprintRohtext(items),
        start: ev.startDate,
      });
    } catch (e) {
      if (leser.istUeberlastet(e)) ueberlastung ??= e;
      else skipMissingAgenda('getServicesWithSetlist', e);
    }
  });
  if (ueberlastung) {
    throw ueberlastung instanceof Error
      ? ueberlastung
      : leser.fehler(503, 'ChurchTools bremst gerade (zu viele Anfragen).');
  }
  return rows
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((r) => ({ service: r.service, fingerprintText: r.fingerprintText }));
}

/**
 * Baut einen einzelnen SetlistSong aus dem Agenda-Song-Eintrag (lädt Datei + Details).
 * `preloadedSong` vermeidet einen erneuten getSong-Abruf, wenn der Song schon vorliegt.
 */
export async function baueLied(
  leser: CtLeser,
  agendaSong: CtAgendaSong,
  preloadedSong?: CtSong,
): Promise<SetlistSong> {
  const song = preloadedSong ?? (await leser.song(agendaSong.songId));
  const arr =
    song.arrangements.find((a) => a.id === agendaSong.arrangementId) ?? song.arrangements[0];

  const originalFile = arr?.files.find(isOriginalChordpro);
  const versionFiles = (arr?.files ?? []).filter(isVersionFile);

  /**
   * Lädt eine Akkord-Datei und sagt, OB der Fehlschlag vorübergehend war (#274).
   *
   * Vorher gab jeder Fehler schlicht `''` zurück – eine Zeitüberschreitung wurde damit zu einem
   * **leeren Lied**: leeres Blatt ohne ein Wort, und in der Sammel-PDF fiel das Lied ganz heraus
   * (`Setlist.tsx` filtert leere Texte). Ein Absturz des ganzen Ablaufs wäre die falsche Antwort –
   * dann sähe man auch die anderen Lieder nicht. Deshalb wird der Fehlschlag am Lied vermerkt.
   *
   * `404` zählt NICHT als Fehlschlag: Dann ist die Datei in ChurchTools wirklich weg und leer ist
   * die Wahrheit (`fileDownloadError` unterscheidet das seit #274).
   */
  const download = async (f?: CtArrangementFile): Promise<{ text: string; failed: boolean }> => {
    if (!f) return { text: '', failed: false };
    try {
      return { text: await leser.dateiText(f.fileUrl), failed: false };
    } catch (e) {
      if (istNichtGefunden(e)) return { text: '', failed: false };
      console.warn(
        `[setlist] Akkord-Datei von Lied ${agendaSong.songId} nicht ladbar:`,
        e instanceof Error ? e.message : e,
      );
      return { text: '', failed: true };
    }
  };
  // Original + alle benannten Versionen parallel laden
  const [original, ...versionResults] = await Promise.all([
    download(originalFile),
    ...versionFiles.map((f) => download(f)),
  ]);
  const chordpro = original.text;
  const chordproFailed = original.failed || versionResults.some((r) => r.failed);
  const versions: SongVersion[] = versionFiles.map((f, i) => {
    const name = versionNameOf(f) ?? 'Version';
    const text = versionResults[i]?.text ?? '';
    // Die Tonart der VERSION – dieselbe Regel wie für das Original weiter unten: Die Datei hat das
    // letzte Wort (#236). Ohne eigene Zeile bleibt `null`, und die App nimmt die des Originals (#398).
    const key = versionSlug(name);
    const bisher = versionNameBisher(f);
    const alterKey =
      bisher !== null && versionSlug(bisher) !== key ? versionSlug(bisher) : undefined;
    return {
      key,
      name,
      text,
      writtenKey: metaValue(text, 'key'),
      ...(alterKey ? { alterKey } : {}),
    };
  });

  // Kopfangaben aus dem Original ableiten (sonst erste Version, falls kein Original existiert)
  const source = chordpro || versions[0]?.text || '';
  const originalKey =
    metaValue(source, 'key') ?? arr?.keyOfArrangement ?? arr?.key ?? agendaSong.key ?? 'C';
  const targetKey = agendaSong.key ?? arr?.key ?? originalKey;
  const timeSig = metaValue(source, 'time') ?? arr?.beat ?? null;

  return {
    id: agendaSong.songId,
    /**
     * Die ID des WIRKLICH benutzten Arrangements, nicht die aus dem Ablaufpunkt.
     *
     * Beides fällt normalerweise zusammen. Zeigt der Ablaufpunkt aber auf ein Arrangement, das es in
     * ChurchTools nicht mehr gibt, fällt `arr` oben auf das erste zurück – der Inhalt käme dann von
     * einem anderen Arrangement, als die ID behauptet. Bis #320 war das kosmetisch; seit die
     * Anmerkungs-Schlüssel die ID tragen, lägen die Notizen unter einer Nummer, die zum gezeigten
     * Blatt nicht passt.
     */
    arrangementId: arr?.id ?? agendaSong.arrangementId,
    arrangementName: arr?.name ?? agendaSong.arrangement ?? '',
    arrangementCount: song.arrangements.length,
    // `{title}`/`{artist}` aus der Datei gehen vor – genau wie Tonart und Taktart darüber (#236).
    // Wirkt damit in Kopfzeile, Ablaufplan, Blatt und PDF. Die Bibliothek „Alle Lieder" bleibt
    // beim ChurchTools-Namen: `liedBibliothek` hat keinen ChordPro-Text (siehe Kommentar dort).
    title: metaValue(source, 'title') ?? (agendaSong.title || song.name),
    author: metaValue(source, 'artist') ?? song.author ?? '',
    originalKey,
    targetKey,
    bpm: alsTempoZahl(agendaSong.bpm ?? arr?.bpm),
    timeSig,
    ccli: song.ccli ?? null,
    chordpro,
    // Nur setzen, wenn wirklich etwas schiefging – so bleibt die Antwort für den Normalfall gleich.
    ...(chordproFailed ? { chordproFailed: true } : {}),
    versions,
    documents: arr ? documentsOf(arr.files) : [],
  };
}

/**
 * Die Lieder für „Alle Lieder" – mit dem Standard-Arrangement, alphabetisch.
 *
 * Bewusst der ChurchTools-Name, nicht `{title}` aus der Datei: Die Liste hat keinen ChordPro-Text
 * vor, und ihn zu beschaffen hieße, beim Öffnen der Liste jede Lieddatei einzeln herunterzuladen.
 * In Ablaufplan, Kopfzeile und auf dem Blatt gilt dagegen `{title}`.
 */
export async function liedBibliothek(leser: CtLeser): Promise<SongLibraryEntry[]> {
  const songs = await leser.alleLieder();
  return songs
    .map((s) => {
      const arr = s.arrangements.find((a) => a.isDefault) ?? s.arrangements[0];
      if (!arr) return null;
      return {
        songId: s.id,
        name: s.name,
        author: s.author ?? null,
        // Leer in ChurchTools kommt als `null` oder `""` – beides heißt „keine Nummer" (#378).
        ccli: s.ccli ? String(s.ccli) : null,
        key: arr.keyOfArrangement ?? arr.key ?? null,
        arrangementId: arr.id,
      };
    })
    .filter((e): e is SongLibraryEntry => e !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Baut die Chart-Daten eines einzelnen Lieds (für die „Alle Lieder"-Ansicht). */
export async function liedBlatt(
  leser: CtLeser,
  songId: number,
  arrangementId?: number,
): Promise<SetlistSong> {
  const song = await leser.song(songId);
  const arr =
    (arrangementId && song.arrangements.find((a) => a.id === arrangementId)) ||
    song.arrangements.find((a) => a.isDefault) ||
    song.arrangements[0];
  if (!arr) throw leser.fehler(404, 'Kein Arrangement für dieses Lied gefunden.');
  // `song` direkt durchreichen → kein zweiter getSong-Abruf in baueLied.
  return baueLied(
    leser,
    {
      songId,
      arrangementId: arr.id,
      title: song.name,
      arrangement: arr.name,
      key: arr.keyOfArrangement ?? arr.key ?? null,
      bpm: alsTempoZahl(arr.bpm),
    },
    song,
  );
}

/**
 * Alle Punkte eines Ablaufplans in Reihenfolge – Lieder aufgelöst, übrige nur als Eintrag.
 * `prevSigs` (zuletzt gesehener Stand, #161): ist es gesetzt, bekommt jeder geänderte/neue/
 * verschobene Punkt `changed: true` – die Grundlage fürs Aufleuchten im Client.
 */
export async function ablaufPunkte(
  leser: CtLeser,
  eventId: number,
  prevSigs?: { id: number; sig: string; title?: string }[],
): Promise<AgendaItem[]> {
  const agenda = await leser.agenda(eventId);
  const items = agenda.items ?? [];
  const diff = prevSigs ? diffAgendaItems(prevSigs, agendaSignatureList(items)) : null;
  const changedIds = diff ? new Set(diff.changedIds) : null;
  const built = await Promise.all(
    items.map(async (item): Promise<AgendaItem> => {
      const song = item.song ? await baueLied(leser, item.song) : null;
      const durationSec = item.duration ?? 0;
      // Uhrzeit MASSGEBLICH aus startTimes[eventId]: ist der Eintrag null, hat der Nutzer die
      // Uhrzeit in ChurchTools ausgeblendet (Auge) → keine Zeit anzeigen. Das Feld `start` bleibt
      // auch dann gefüllt und ist daher unbrauchbar. Fallback auf `start`, falls startTimes fehlt.
      const stEntry = item.startTimes ? item.startTimes[String(eventId)] : undefined;
      const timeSource = stEntry === undefined ? item.start : stEntry;
      return {
        id: item.id,
        title: item.title,
        type: item.type ?? null,
        isHeader: isHeaderType(item.type),
        responsible: responsibleEntries(item),
        responsibleText: item.responsible?.text ?? '',
        song,
        time: formatBerlinTime(timeSource),
        vorBeginn: item.isBeforeEvent ?? false,
        durationMin: durationSec > 0 ? Math.round(durationSec / 60) : null,
        note: item.note ?? '',
        changed: changedIds ? changedIds.has(item.id) : undefined,
      };
    }),
  );
  // Entfernte Punkte (Etappe B) als Platzhalter an ihrer alten Position einblenden – der Client
  // lässt sie auflösen. Ohne Diff (nie gesehen) gibt es keine.
  if (!diff || diff.removed.length === 0) return built;
  const result = [...built];
  for (const r of diff.removed) {
    const placeholder: AgendaItem = {
      id: r.id,
      title: r.title,
      type: null,
      isHeader: false,
      responsible: [],
      responsibleText: '',
      song: null,
      time: null,
      vorBeginn: false,
      durationMin: null,
      note: '',
      removed: true,
    };
    const at = r.afterId == null ? 0 : result.findIndex((it) => it.id === r.afterId) + 1;
    result.splice(at, 0, placeholder);
  }
  return result;
}
