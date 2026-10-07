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
  AuthStatus,
  Service,
  SetlistSong,
  SongArrangementOption,
  SiteConfig,
  SongLibraryEntry,
  UserCapabilities,
} from '@shared/types/index';
import { DEFAULT_SITE_CONFIG } from '@shared/types/index';
import { agendaSignatureList, fingerprintRohtext } from '@shared/ct/agendaDiff';
import { dateiUrlFinden } from '@shared/ct/arrangementFiles';
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
import { sanitizeFileContentType } from '@shared/dateien/index';
import type { GesehenerStand } from '@shared/types/index';
import { ApiError } from './api';
import { ctAnfrage, ctDatei, istUeberlastet } from './ctRuntime';
import { holeGesehen, merkeGesehen } from './personenAblage';

/** Zeitzone der Gemeinde. Die Server-Variante liest sie aus `ZEITZONE`; hier gilt der Standard. */
const ZEITZONE = 'Europe/Berlin';

/** ChurchTools packt fast alles in `{ data: … }` – wie `ctGet` im Server: `data`, sonst den Rumpf. */
async function daten<T>(pfad: string): Promise<T> {
  const body = await ctAnfrage<{ data?: T } | null>(pfad);
  return (body?.data ?? body) as T;
}

/**
 * Untertitel-Memo (#306): Der Untertitel war die HÄLFTE der Dauerlast der Terminliste – je Termin ein
 * Abruf, im Minutentakt. In der Extension fragt jedes Gerät selbst, das Memo zählt hier also noch mehr.
 * Ein Fehler wird NICHT gemerkt (#306): „vorübergehend ist nicht ungültig".
 */
const untertitelMemo = createTtlMemo<string | null>(10 * 60_000);

/** Der `CtLeser` des Browsers für den geteilten Aufbau. */
export const leser: CtLeser = {
  events: (from, to) => daten<CtEvent[]>(`/events?from=${from}&to=${to}`),
  agenda: (eventId) => daten<CtAgenda>(`/events/${eventId}/agenda`),
  song: (songId) => daten<CtSong>(`/songs/${songId}`),
  async alleLieder() {
    // Wie `ctRead.getAllSongs`: seitenweise, höchstens 50 Seiten.
    const alle: CtSongListEntry[] = [];
    for (let seite = 1; seite <= 50; seite++) {
      const teil = await daten<CtSongListEntry[]>(`/songs?limit=100&page=${seite}`);
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
        await daten<{ appointment?: { subtitle?: string }; subtitle?: string }>(
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
  const ich = await daten<{ id?: number; firstName?: string; lastName?: string }>('/whoami');
  if (!ich || typeof ich.id !== 'number' || ich.id <= 0) return { authenticated: false };
  return {
    authenticated: true,
    user: { id: ich.id, firstName: ich.firstName ?? '', lastName: ich.lastName ?? '' },
  };
}

/**
 * `GET /api/site-config` – in der Extension gibt es kein `site.json`. Der Gemeindename kommt aus
 * ChurchTools (`/api/info` → `siteName`, gemessen 07.10.2026, sogar ohne Anmeldung); alles andere
 * bleibt beim Standard. Ein Fehler hier darf die App nicht aufhalten – dann eben der Standardname.
 */
export async function gemeindeKonfiguration(): Promise<SiteConfig> {
  try {
    const info = await ctAnfrage<{ siteName?: unknown } | null>('/info');
    const name = typeof info?.siteName === 'string' ? info.siteName.trim() : '';
    return { ...DEFAULT_SITE_CONFIG, orgName: name || DEFAULT_SITE_CONFIG.orgName };
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

/**
 * `GET /api/capabilities` – die Rechte aus ChurchTools, mit derselben Regel wie im Server.
 *
 * Team-Notizen und Abwesenheiten bleiben aus: Wer dazugehört, steht in der Server-Variante in deren
 * Einstellungen (Gruppen, Rollen) – die Extension hat dafür noch keinen Ort (Phase 3b).
 */
export async function meineRechte(): Promise<UserCapabilities> {
  const roh = await daten<Record<string, Record<string, unknown>>>('/permissions/global');
  const rechte = rechteAus(
    roh,
    STANDARD_ADMIN_RECHT,
    (status, meldung) => new ApiError(status, meldung),
  );
  // Schreiben kommt erst mit Phase 3b (#335). Bis dahin meldet die Extension „darf nicht" – dann
  // verschwinden die Bearbeiten-Knöpfe von selbst, statt beim Antippen mit 501 zu scheitern (#336).
  return { ...rechte, canEditAgendas: false, canEditSongs: false, canUseCcli: false };
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
  const roh = await daten<CtService[]>('/services');
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
