/**
 * **Die Lied-Wege des Browsers zu ChurchTools** – Liederliste, Liedblatt, Stammdaten, Statistik, SongSelect, Anlegen und
 * Ändern, Notenblätter (Dienstplaner-Bauplan E9, „LW2a", 06.11.2026).
 *
 * Bis dahin in `client/src/services/ctLesen.ts`, `ctSchreiben.ts` und `ctSongSelect.ts` – **wortgleich übernommen**,
 * damit der Dienstplaner dieselben Wege nutzt wie die Musik-App als ChurchTools-Erweiterung, samt derselben
 * Zwischenspeicher (Statistik zehn Minuten, Stammdaten je Sitzung, Untertitel-Memo). Die Regeln selbst stehen weiter in
 * `@shared/ct`; hier liegt nur ihre Bindung an die Verbindung des Browsers (`./verbindung`). Die Musik-App reicht diese
 * Funktionen in ihren Diensten nur weiter – es gibt sie EINMAL.
 */
import type {
  ArrangementAnsicht,
  ArrangementAuftrag,
  ArrangementFileEntry,
  LiedAngelegt,
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
  LiedtextVorschau,
  SetlistSong,
  SongCategory,
  SongLibraryEntry,
  SongSelectLiedtext,
  SongSelectSong,
  SongSelectSuchergebnis,
  SongSource,
} from '@shared/types/index';
import type { CtSchreiber, SchreibAuftrag } from '@shared/ct/schreibKern';
import * as liedVerwaltung from '@shared/ct/liedVerwaltung';
import { arrangementAnsicht, stammdatenAnsicht, type CtVerwalter } from '@shared/ct/liedVerwaltung';
import * as noten from '@shared/ct/notenblaetter';
import type { CtNotenSchreiber } from '@shared/ct/notenblaetter';
import {
  notenblattAusSongSelect,
  songSelectLied,
  songSelectLiedtext,
  songSelectSuchen,
  type SongSelectPort,
} from '@shared/ct/songselect';
import {
  alleKategorien,
  bearbeitbareKategorien as bearbeitbareKategorienAus,
  quellenAusStammdaten,
  type LiedStammdatenRoh,
} from '@shared/ct/stammdaten';
import { liedtextVorschauAus } from '@shared/ct/liedtext';
import { liedStatistik, type LiedNutzung } from '@shared/ct/liedStatistik';
import { STANDARD_ADMIN_RECHT } from '@shared/ct/rechte';
import { liedBibliothek, liedBlatt, untertitelAus, type CtLeser } from '@shared/ct/setlistKern';
import type { CtAgenda, CtEvent, CtSong, CtSongListEntry } from '@shared/ct/typen';
import { createTtlMemo } from '@shared/ct/ttlMemo';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import { ApiError } from './fehler';
import {
  ctAlleSeiten,
  ctAltAnfrage,
  ctAnfrage,
  ctDaten,
  ctDatei,
  istUeberlastet,
} from './verbindung';
import { browserSchreiber, schreibFehler } from './schreiber';

/**
 * Untertitel-Memo (#306): Der Untertitel war die HÄLFTE der Dauerlast der Terminliste – je Termin ein
 * Abruf, im Minutentakt. In der Extension fragt jedes Gerät selbst, das Memo zählt hier also noch mehr.
 * Ein Fehler wird NICHT gemerkt (#306): „vorübergehend ist nicht ungültig".
 */
const untertitelMemo = createTtlMemo<string | null>(10 * 60_000);

/** Der `CtLeser` des Browsers für den geteilten Aufbau. */
export const leser: CtLeser = {
  events: (from, to) => ctDaten<CtEvent[]>(`/events?from=${from}&to=${to}`),
  agenda: (eventId) => ctDaten<CtAgenda>(`/events/${eventId}/agenda`),
  song: (songId) => ctDaten<CtSong>(`/songs/${songId}`),
  // Wie `ctRead.getAllSongs`: seitenweise, höchstens 50 Seiten – das Blättern steht seit #480 einmal in
  // `ctAlleSeiten` (mehr als 5.000 Lieder → Fehler statt still abgeschnitten).
  alleLieder: () => ctAlleSeiten<CtSongListEntry>('/songs'),
  async untertitel(calendarId, appointmentId) {
    const key = `${calendarId}|${appointmentId}`;
    const treffer = untertitelMemo.get(key);
    if (treffer !== undefined) return treffer;
    try {
      const wert = untertitelAus(
        await ctDaten<{ appointment?: { subtitle?: string }; subtitle?: string }>(
          `/calendars/${calendarId}/appointments/${appointmentId}`,
        ),
      );
      untertitelMemo.set(key, wert);
      return wert;
    } catch {
      return null;
    }
  },
  dateiText: async (fileUrl) => (await ctDatei(fileUrl)).text(),
  fehler: (status, meldung) => new ApiError(status, meldung),
  istUeberlastet,
  // Ein Getter: `leser` entsteht beim Import, die Zeitzone der Gemeinde kommt erst mit `getSiteConfig` (#847).
  get zeitzone() {
    return gemeindeZeitzone();
  },
};

// ── Lesen ──────────────────────────────────────────────────────────────────────────────

export function lieder(): Promise<SongLibraryEntry[]> {
  return liedBibliothek(leser);
}

export function blatt(songId: number, arrangementId?: number): Promise<SetlistSong> {
  return liedBlatt(leser, songId, arrangementId);
}

/**
 * `GET /api/songs/:id/liedtext-vorschau` – beim Hinzufügen eines Lieds zum Ablauf (#335, 3b-1).
 *
 * Der Server sucht das Lied in der ganzen Liederliste (die er ohnehin für die Suche hält); hier wird
 * nur dieses eine Lied gelesen – eine Anfrage plus die Datei. Welche Datei und „nur mit Text" regelt
 * `@shared/ct/liedtext`.
 */
export async function liedtextVorschau(songId: number): Promise<LiedtextVorschau> {
  const song = await leser.song(songId);
  return { chordpro: await liedtextVorschauAus(song, (url) => leser.dateiText(url)) };
}

// ── Lied-Statistik ───────────────────────────────────────────────────────────

/**
 * `GET /api/song-usage` – die Lied-Statistik aus ChurchTools selbst (`@shared/ct/liedStatistik`, Alwin
 * 08.10.2026): EIN Aufruf (`getSongStatistic`) plus die Liederliste. Bis dahin gab es die Statistik in
 * der Extension nicht, weil der alte Weg je Gerät ~250 Anfragen gekostet hätte (#300).
 *
 * Zehn Minuten gemerkt, wie im Server. Ein Fehlschlag wird NICHT gemerkt – vorübergehend ist nicht
 * ungültig. Ohne das Recht „Song-Statistik sehen" fragt die Ansicht gar nicht erst
 * (`canViewSongStatistics`); täte sie es doch, würfe ChurchTools.
 */
const nutzung = merkeVersprechen<Record<number, LiedNutzung>>({ ttlMs: 10 * 60_000 });

export function liedNutzung(): Promise<Record<number, LiedNutzung>> {
  return nutzung.hole('statistik', async () =>
    liedStatistik(
      { anfrage: ctAltAnfrage, fehler: (status, meldung) => new ApiError(status, meldung) },
      await leser.alleLieder(),
      gemeindeZeitzone(),
    ),
  );
}

/** Nur für Tests: die gemerkte Statistik vergessen. */
export function _vergissNutzung(): void {
  nutzung.vergiss();
}

// ── Lied-Stammdaten (3b-2) ───────────────────────────────────────────────────

/**
 * `getMasterData` der alten Schnittstelle – einmal je Sitzung der Seite geholt. Die Liste ändert sich
 * selten (Kategorien, Liederbücher), und die Liedverwaltung fragt sie bei jedem Anlegen/Ändern
 * (Recht, Quelle). Ein Fehlschlag wird NICHT gemerkt – vorübergehend ist nicht ungültig.
 */
const stammdaten = merkeVersprechen<LiedStammdatenRoh>();
function liedStammdaten(): Promise<LiedStammdatenRoh> {
  return stammdaten.hole(
    'stammdaten',
    async () =>
      (await ctAltAnfrage(
        'getMasterData',
        {},
        {
          verweigert: 'Keine Berechtigung, die Lied-Kategorien in ChurchTools zu lesen.',
          unlesbar: 'ChurchTools lieferte keine lesbare Antwort für die Lied-Kategorien.',
          fehlgeschlagen: 'Die Lied-Kategorien konnten nicht geladen werden.',
        },
      )) as LiedStammdatenRoh,
  );
}

/** Nur für Tests: gemerkte Stammdaten vergessen. */
export function _vergissStammdaten(): void {
  stammdaten.vergiss();
}

/** `GET /api/song-categories` – die Kategorien, in denen die Person Lieder anlegen/ändern darf. */
export async function bearbeitbareKategorien(): Promise<SongCategory[]> {
  const rechte = await ctDaten<Record<string, Record<string, unknown>>>('/permissions/global');
  return bearbeitbareKategorienAus(
    rechte,
    STANDARD_ADMIN_RECHT,
    await alleKategorien({
      stammdaten: liedStammdaten,
      lieder: () => leser.alleLieder(),
      istUeberlastet,
    }),
    (status, meldung) => new ApiError(status, meldung),
  );
}

/** `GET /api/song-sources` – die Liedquellen (Liederbücher). */
export async function quellen(): Promise<SongSource[]> {
  return quellenAusStammdaten(await liedStammdaten());
}

/** `GET /api/songs/:id/stammdaten` */
export async function liedStammdatenAnsicht(songId: number): Promise<LiedStammdatenAnsicht> {
  return stammdatenAnsicht(await leser.song(songId));
}

/** `GET /api/songs/:id/arrangements/verwaltung` */
export async function arrangementVerwaltung(songId: number): Promise<ArrangementAnsicht[]> {
  return (await leser.song(songId)).arrangements.map(arrangementAnsicht);
}

// ── SongSelect (CCLI) ─────────────────────────────────────────────────────────────────

export const songSelect: SongSelectPort = {
  anfrage: (func, felder, meldungen) => ctAltAnfrage(func, felder, meldungen),
  fehler: (status, meldung) => new ApiError(status, meldung),
};

/** `GET /api/songselect/search?title=…` */
export function songSelectSuche(titel: string): Promise<SongSelectSuchergebnis> {
  return songSelectSuchen(songSelect, titel);
}

/** `GET /api/songselect/songs/:nr` */
export function songSelectLiedHolen(songNumber: number): Promise<SongSelectSong> {
  return songSelectLied(songSelect, songNumber);
}

/** `GET /api/songselect/songs/:nr/liedtext` */
export function songSelectLiedtextHolen(songNumber: number): Promise<SongSelectLiedtext> {
  return songSelectLiedtext(songSelect, songNumber);
}

// ── Schreiben ─────────────────────────────────────────────────────────────────────────

/** Der `CtSchreiber` des Browsers (`@ui/ct/schreiber`) samt Liedverwaltung und Notenblättern. */
export const liedSchreiber: CtSchreiber & CtVerwalter & CtNotenSchreiber = {
  ...browserSchreiber,
  // ── Liedverwaltung und Notenblätter (3b-2) ──
  alleLieder: () => leser.alleLieder(),
  bearbeitbareKategorien,
  quellen,
  dateiText: (fileUrl) => leser.dateiText(fileUrl),
  /** Wie `uploadFile` im Server: EIN Feld `files[]`, Name und Art mit der Datei. */
  async hochladen(arrangementId, datei, meldungen) {
    const form = new FormData();
    const inhalt = typeof datei.inhalt === 'string' ? datei.inhalt : new Uint8Array(datei.inhalt);
    form.append('files[]', new Blob([inhalt], { type: datei.mime }), datei.filename);
    const auftrag: SchreibAuftrag = { method: 'POST', ...meldungen };
    try {
      await ctAnfrage(`/files/song_arrangement/${arrangementId}`, {
        method: 'POST',
        body: form,
        verweigert: meldungen.verweigert,
      });
    } catch (e) {
      throw schreibFehler(e, auftrag);
    }
  },
};

/** `POST /api/songs` */
export function liedNeu(auftrag: LiedAnlegenAuftrag): Promise<LiedAngelegt> {
  return liedVerwaltung.liedAnlegen(liedSchreiber, auftrag);
}

/** `PUT /api/songs/:id` – zurück kommt das Lied, wie ChurchTools es DANACH liest. */
export async function liedAendern(
  songId: number,
  aenderung: Partial<LiedStammdaten>,
): Promise<LiedStammdatenAnsicht> {
  return liedVerwaltung.stammdatenAnsicht(
    await liedVerwaltung.liedAendern(liedSchreiber, songId, aenderung),
  );
}

/** `PUT /api/songs/:id/arrangements/:arrId` */
export function arrangement(
  songId: number,
  arrangementId: number,
  auftrag: ArrangementAuftrag,
): Promise<ArrangementAnsicht> {
  return liedVerwaltung.arrangementBearbeiten(liedSchreiber, songId, arrangementId, auftrag);
}

/** `PUT /api/songs/:id/arrangements/:arrId/chordpro` – das Original-Notenblatt. */
export function notenblatt(
  songId: number,
  arrangementId: number,
  text: string,
): Promise<ArrangementFileEntry[]> {
  return noten.notenblattSchreiben(liedSchreiber, songId, arrangementId, text);
}

/**
 * `POST /api/songs/:id/arrangements/:arr/songselect/chordpro` (3b-5) – das Original-Notenblatt aus
 * CCLI SongSelect holen und ersetzen; erst holen, dann das alte löschen (`notenblattAusSongSelect`).
 */
export function notenblattAusCcli(
  songId: number,
  arrangementId: number,
  songNumber: number,
): Promise<ArrangementFileEntry[]> {
  return notenblattAusSongSelect(liedSchreiber, songSelect, songId, arrangementId, songNumber);
}
