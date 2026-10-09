/**
 * Die lesenden Aufrufe der ChurchTools-Extension (#335, Phase 3a) – das, was in der Server-Variante
 * der eigene Server tut, direkt im Browser.
 *
 * **Hier stehen keine Regeln.** Wie aus den Rohdaten Terminliste, Ablauf und Liedblatt werden, steht
 * in `@shared/ct` und gilt für beide Auslieferungen. Hier liegt nur der `CtLeser` des Browsers (die
 * Sitzung der Seite, Bremse und Zeitgrenzen aus `ctRuntime`) und das, was der Server sonst in seinen
 * Controllern zusammensetzt – mit denselben geteilten Bausteinen.
 *
 * Aufgerufen wird es nur aus der Weiche in `churchtoolsApi.ts` und `fileDownload.ts`.
 */
import type {
  AgendaItem,
  AgendaServiceOption,
  ArrangementAnsicht,
  ArrangementFileEntry,
  AuthStatus,
  LiedStammdatenAnsicht,
  LiedtextVorschau,
  Service,
  SetlistSong,
  SongArrangementOption,
  SiteConfig,
  SongCategory,
  SongLibraryEntry,
  SongSource,
  UserCapabilities,
} from '@shared/types/index';
import { DEFAULT_SITE_CONFIG } from '@shared/types/index';
import { agendaSignatureList, fingerprintRohtext } from '@shared/ct/agendaDiff';
import { arrangementFileEntries, dateiUrlFinden } from '@shared/ct/arrangementFiles';
import { einstellungenAus } from '@shared/ct/einstellungen';
import {
  aktiveMitgliedschaften,
  computeTeamNotesAllowed,
  gruppenAus,
  rollenAus,
  type RohMitgliedschaft,
} from '@shared/ct/gruppen';
import { arrangementAnsicht, stammdatenAnsicht } from '@shared/ct/liedVerwaltung';
import { arrangementAus } from '@shared/ct/schreibKern';
import {
  alleKategorien,
  bearbeitbareKategorien as bearbeitbareKategorienAus,
  quellenAusStammdaten,
  type LiedStammdatenRoh,
} from '@shared/ct/stammdaten';
import { liedtextVorschauAus } from '@shared/ct/liedtext';
import { liedStatistik, type LiedNutzung } from '@shared/ct/liedStatistik';
import { rechteAus, STANDARD_ADMIN_RECHT } from '@shared/ct/rechte';
import {
  ablaufPunkte,
  arrangementOptionen,
  dienstReihenfolge,
  liedBibliothek,
  liedBlatt,
  setlistGeaendert,
  standardFenster,
  termineMitAblauf,
  untertitelAus,
  type CtLeser,
} from '@shared/ct/setlistKern';
import type { CtAgenda, CtEvent, CtService, CtSong, CtSongListEntry } from '@shared/ct/typen';
import { createTtlMemo } from '@shared/ct/ttlMemo';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import { whoamiId } from '@shared/ct/whoami';
import { sanitizeFileContentType } from '@shared/dateien/index';
import type { GesehenerStand } from '@shared/types/index';
import { ApiError } from './api';
import { ctAltAnfrage, ctAnfrage, ctDaten, ctDatei, istUeberlastet } from './ctRuntime';
import { gespeicherteEinstellungen } from './ctEinstellungen';
import { holeGesehen, merkeGesehen } from './personenAblage';

/** Zeitzone der Gemeinde. Die Server-Variante liest sie aus `ZEITZONE`; hier gilt der Standard. */
const ZEITZONE = 'Europe/Berlin';

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
  async alleLieder() {
    // Wie `ctRead.getAllSongs`: seitenweise, höchstens 50 Seiten.
    const alle: CtSongListEntry[] = [];
    for (let seite = 1; seite <= 50; seite++) {
      const teil = await ctDaten<CtSongListEntry[]>(`/songs?limit=100&page=${seite}`);
      alle.push(...teil);
      if (teil.length < 100) break;
    }
    return alle;
  },
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
  zeitzone: ZEITZONE,
};

/**
 * Fingerabdruck aus dem geteilten Text – sha256 wie im Server (`node:crypto`), hier mit
 * `crypto.subtle`. Derselbe Wert, deshalb vergleichbar; leerer Text bleibt `''`.
 */
export async function fingerabdruck(text: string): Promise<string> {
  if (!text) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Gemerkte „gesehen"-Stände – best effort: Ohne sie gibt es keine Markierungen, aber keinen Fehler. */
async function gesehenOderLeer(): Promise<Record<number, GesehenerStand>> {
  try {
    return await holeGesehen();
  } catch {
    return {};
  }
}

// ── Die Gegenstücke zu den Server-Endpunkten ─────────────────────────────────

/** `GET /api/auth/me` – in der Extension: wer ist in ChurchTools angemeldet (`id > 0`, #381)? */
export async function meinStatus(): Promise<AuthStatus> {
  const ich = await ctDaten<{ firstName?: string; lastName?: string } | null>('/whoami');
  const id = whoamiId(ich);
  if (!id) return { authenticated: false };
  return {
    authenticated: true,
    user: { id, firstName: ich?.firstName ?? '', lastName: ich?.lastName ?? '' },
  };
}

/**
 * `GET /api/site-config` – in der Extension gibt es kein `site.json`. Der Gemeindename kommt aus
 * ChurchTools (`/api/info` → `siteName`, gemessen 07.10.2026, sogar ohne Anmeldung), der Rest seit
 * 3b-4 aus dem Datenbereich der Erweiterung (`ctEinstellungen.ts`), geprüft mit derselben Regel wie im
 * Server.
 *
 * Der Name ist Beiwerk: Scheitert `/info`, gilt der Standardname. Die gespeicherten Einstellungen
 * nicht – ein vorübergehender Fehler dort **wirft** (siehe `gespeicherteEinstellungen`), damit das
 * Gerät die Wahl der Gemeinde nicht durch die Vorgaben ersetzt.
 */
export async function gemeindeKonfiguration(): Promise<SiteConfig> {
  const [orgName, gespeichert] = await Promise.all([gemeindeName(), gespeicherteEinstellungen()]);
  // Geprüft mit dem Standardnamen, eingesetzt wird der echte: Das Schema begrenzt den Namen auf 80
  // Zeichen – ein längerer Name in ChurchTools ließe sonst die ganzen Einstellungen durchfallen.
  const geprueft =
    einstellungenAus({ ...gespeichert, orgName: DEFAULT_SITE_CONFIG.orgName }) ??
    DEFAULT_SITE_CONFIG;
  return { ...geprueft, orgName };
}

async function gemeindeName(): Promise<string> {
  try {
    const info = await ctAnfrage<{ siteName?: unknown } | null>('/info');
    const name = typeof info?.siteName === 'string' ? info.siteName.trim() : '';
    return name || DEFAULT_SITE_CONFIG.orgName;
  } catch {
    return DEFAULT_SITE_CONFIG.orgName;
  }
}

/**
 * `GET /api/capabilities` – die Rechte aus ChurchTools, mit derselben Regel wie im Server.
 *
 * Team-Notizen seit 3b-4b: wie im Server aus den Gruppen und Rollen der Gemeinde-Einstellungen und den
 * eigenen Mitgliedschaften (`@shared/ct/gruppen`). Abwesenheiten bleiben bis 3b-3 aus.
 */
export async function meineRechte(): Promise<UserCapabilities> {
  const roh = await ctDaten<Record<string, Record<string, unknown>>>('/permissions/global');
  const rechte = rechteAus(
    roh,
    STANDARD_ADMIN_RECHT,
    (status, meldung) => new ApiError(status, meldung),
  );
  // Seit 3b-5 schreibt und liest die Extension alles selbst, auch SongSelect (`ctSongSelect.ts`) –
  // die Rechte gelten, wie ChurchTools sie meldet. Abwesenheiten bleiben aus (`canUseAvailability`,
  // in `rechteAus` false), bis sie gebaut sind.
  return { ...rechte, canUseGlobalNotes: await darfTeamNotizen() };
}

/**
 * Darf ich Team-Notizen nutzen? Kein Admin-Bypass, wie im Server. Ein Fehler hier (Einstellungen oder
 * Mitgliedschaften nicht lesbar) heißt „gerade nicht" – die Knöpfe fehlen dann, bis die Rechte neu
 * geladen werden. Verworfen wird dabei nichts; die Rechte als Ganzes scheitern daran nicht.
 */
async function darfTeamNotizen(): Promise<boolean> {
  try {
    const cfg = await gemeindeKonfiguration();
    if (cfg.musicianGroupIds.length === 0) return false;
    const status = await meinStatus();
    if (!status.user) return false;
    const mitglied = aktiveMitgliedschaften(
      await ctDaten<RohMitgliedschaft[]>(`/persons/${status.user.id}/groups`),
    );
    return computeTeamNotesAllowed(mitglied, cfg.musicianGroupIds, cfg.noteRoles ?? []);
  } catch (e) {
    console.warn('[rechte] Team-Notizen nicht ermittelbar – vorerst aus:', e);
    return false;
  }
}

/** `GET /api/groups` – sichtbare Gruppen für die Gruppen-Zuweisung (nur Admin). */
export async function gruppen(): Promise<{ id: number; name: string }[]> {
  // limit hoch genug für ein Dropdown; page=1 (CT beginnt bei 1, nicht 0) – wie im Server.
  return gruppenAus(await ctDaten('/groups?limit=200&page=1'));
}

/** `GET /api/groups/:id/roles` – Rollen einer Gruppe für die Rollen-Zuweisung (nur Admin). */
export async function rollen(groupId: number): Promise<{ id: number; name: string }[]> {
  return rollenAus(await ctDaten(`/groups/${groupId}/roles`));
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
      ZEITZONE,
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

/** `GET /api/songs/:id/arrangements/:arrId/files` */
export async function arrangementDateien(
  songId: number,
  arrangementId: number,
): Promise<ArrangementFileEntry[]> {
  const arr = arrangementAus(
    await leser.song(songId),
    arrangementId,
    (st, m) => new ApiError(st, m),
  );
  return arrangementFileEntries(arr.files);
}

/** `GET /api/services` – Termine mit Ablauf, samt „geändert"-Punkt (#143). */
export async function termine(range?: { from?: string; to?: string }): Promise<Service[]> {
  const fenster = standardFenster();
  const zeilen = await termineMitAblauf(
    leser,
    range?.from ?? fenster.from,
    range?.to ?? fenster.to,
  );
  const gesehen = await gesehenOderLeer();
  return Promise.all(
    zeilen.map(async ({ service, fingerprintText }) => ({
      ...service,
      setlistChanged: setlistGeaendert(gesehen[service.id], await fingerabdruck(fingerprintText)),
    })),
  );
}

/** `GET /api/services/:id/setlist` – der Ablauf, geänderte Punkte markiert (#161). */
export async function ablauf(eventId: number): Promise<AgendaItem[]> {
  const gesehen = await gesehenOderLeer();
  return ablaufPunkte(leser, eventId, gesehen[eventId]?.items);
}

/** `POST /api/services/:id/seen` – den aktuellen Stand als gesehen merken (#143). */
export async function alsGesehenMerken(eventId: number): Promise<{ ok: boolean }> {
  const items = (await leser.agenda(eventId)).items ?? [];
  await merkeGesehen(eventId, {
    hash: await fingerabdruck(fingerprintRohtext(items)),
    items: agendaSignatureList(items),
  });
  return { ok: true };
}

/** `GET /api/services/:id/setlist/version` – nur der Fingerabdruck (billig, ohne Lieddateien). */
export async function ablaufStand(eventId: number): Promise<{ hash: string }> {
  const items = (await leser.agenda(eventId)).items ?? [];
  return { hash: await fingerabdruck(fingerprintRohtext(items)) };
}

export function lieder(): Promise<SongLibraryEntry[]> {
  return liedBibliothek(leser);
}

export function blatt(songId: number, arrangementId?: number): Promise<SetlistSong> {
  return liedBlatt(leser, songId, arrangementId);
}

export async function arrangements(songId: number): Promise<SongArrangementOption[]> {
  return arrangementOptionen(await leser.song(songId));
}

export async function dienste(): Promise<AgendaServiceOption[]> {
  const roh = await ctDaten<CtService[]>('/services');
  return dienstReihenfolge(roh).map((s) => ({ id: s.id, name: s.name }));
}

/**
 * Eine Datei eines Lieds laden – nur, wenn sie zu DIESEM Lied gehört (wie `resolveFileUrl`).
 *
 * Der Typ wird gehärtet wie im Datei-Proxy des Servers (#138): Alles außer PDF, Rasterbild und Text
 * wird `application/octet-stream`. In der Extension liefe eine HTML-Datei sonst auf der Adresse von
 * ChurchTools.
 */
export async function datei(songId: number, fileId: number): Promise<Blob> {
  const url = dateiUrlFinden(await leser.song(songId), fileId);
  if (!url) throw new ApiError(404, 'Datei nicht gefunden.');
  const roh = await ctDatei(url);
  const { contentType } = sanitizeFileContentType(roh.type);
  return new Blob([await roh.arrayBuffer()], { type: contentType });
}
