/**
 * Konkrete Backend-Endpunkte der Worship-App. Alle UI-Datenzugriffe laufen hierüber.
 */
import type {
  AgendaItem,
  AgendaServiceOption,
  ArrangementAnsicht,
  ArrangementAuftrag,
  ArrangementFileEntry,
  AuthStatus,
  LiedAngelegt,
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
  Service,
  SetlistSong,
  SongArrangementOption,
  SongCategory,
  SongLibraryEntry,
  SongSelectSong,
  SongSelectSuchergebnis,
  SongSource,
  SongTextTreffer,
  LiedtextVorschau,
  SongSelectLiedtext,
  SongVersion,
  UserCapabilities,
} from '@shared/types/index';
import { apiFetch, apiFetchBlob } from './api';
import { istExtension, ohneServer } from './ctRuntime';
import * as ext from './ctLesen';
import * as extSchreiben from './ctSchreiben';
import type { NeuerPunkt, PunktAenderung } from '@shared/ct/schreibKern';

// Die Weiche zur ChurchTools-Extension (#335): Lesende Aufrufe gehen dort über `ctLesen.ts`, schreibende
// über `ctSchreiben.ts` direkt an ChurchTools; was es dort (noch) nicht gibt, sagt `ohneServer`. Phase 3b
// kommt in Scheiben (Ablauf + Tempo zuerst), die Massenläufe (Statistik, Liedtext-Suche) bleiben der
// Server-Variante vorbehalten (Plan §6).

export function login(email: string, password: string): Promise<AuthStatus> {
  if (istExtension) return ohneServer('Eine eigene Anmeldung');
  return apiFetch<AuthStatus>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<AuthStatus> {
  if (istExtension) return ohneServer('Ein eigenes Abmelden (bitte in ChurchTools abmelden)');
  return apiFetch<AuthStatus>('/api/auth/logout', { method: 'POST' });
}

export function getMe(): Promise<AuthStatus> {
  if (istExtension) return ext.meinStatus();
  return apiFetch<AuthStatus>('/api/auth/me');
}

/** Rechte des angemeldeten Nutzers (steuert die sichtbare UI). */
export async function getCapabilities(): Promise<UserCapabilities> {
  const caps = istExtension
    ? await ext.meineRechte()
    : await apiFetch<UserCapabilities>('/api/capabilities');
  // ChurchTools liefert sporadisch alle Rechte-Zuordnungen leer (Struktur da, Werte []), obwohl
  // der Nutzer Zugriff hat. Das als transienten Fehler werfen → useCapabilities versucht
  // automatisch neu; hält es an, zeigt App.tsx den Fehlerschirm mit „Erneut versuchen".
  if (!caps.canViewSongs && !caps.canViewAgendas) {
    throw new Error('Berechtigungen wurden unvollständig geladen – bitte erneut versuchen.');
  }
  return caps;
}

export function getServices(range?: { from?: string; to?: string }): Promise<Service[]> {
  if (istExtension) return ext.termine(range);
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return apiFetch<Service[]>(`/api/services${qs ? `?${qs}` : ''}`);
}

/** Alle Ablaufpunkte eines Gottesdienstes (Lieder inkl. ChordPro). */
export function getAgenda(eventId: number): Promise<AgendaItem[]> {
  if (istExtension) return ext.ablauf(eventId);
  return apiFetch<AgendaItem[]>(`/api/services/${eventId}/setlist`);
}

/** Merkt den aktuellen Setlist-Stand als „gesehen" → entfernt das „geändert"-Badge (#143). */
export function markSetlistSeen(eventId: number): Promise<{ ok: boolean }> {
  if (istExtension) return ext.alsGesehenMerken(eventId);
  return apiFetch<{ ok: boolean }>(`/api/services/${eventId}/seen`, { method: 'POST' });
}

/** Aktueller Ablauf-Fingerabdruck (Live-Abgleich: billig, ohne ChordPro-Downloads). */
export function getSetlistVersion(eventId: number): Promise<{ hash: string }> {
  if (istExtension) return ext.ablaufStand(eventId);
  return apiFetch<{ hash: string }>(`/api/services/${eventId}/setlist/version`);
}

/** Speichert die neue Reihenfolge der Ablaufpunkte (Liste der Item-IDs in Wunschreihenfolge). */
export function reorderAgenda(eventId: number, order: number[]): Promise<{ ok: boolean }> {
  if (istExtension) return extSchreiben.reihenfolge(eventId, order);
  return apiFetch(`/api/services/${eventId}/agenda/order`, {
    method: 'PATCH',
    body: JSON.stringify({ order }),
  });
}

/** Legt einen neuen Ablaufpunkt an (Text/Überschrift/Lied). */
export function createAgendaItem(eventId: number, data: NeuerPunkt): Promise<{ ok: boolean }> {
  if (istExtension) return extSchreiben.punktNeu(eventId, data);
  return apiFetch(`/api/services/${eventId}/agenda/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Lädt die ChurchTools-Dienste (für die Verantwortlich-Chips). */
export function getAgendaServices(): Promise<AgendaServiceOption[]> {
  if (istExtension) return ext.dienste();
  return apiFetch<AgendaServiceOption[]>('/api/agenda-services');
}

/**
 * Änderbare Felder eines Ablaufpunkts – gesammelt in EINEM Request. Die Feldliste steht einmal, in
 * `@shared/ct/schreibKern` (#335): Server, Extension und Oberfläche teilen sie.
 */
export type AgendaItemUpdate = PunktAenderung;

/** Schreibt die geänderten Felder eines Ablaufpunkts gesammelt (ein PUT statt Request pro Feld). */
export function updateAgendaItem(
  eventId: number,
  itemId: number,
  fields: AgendaItemUpdate,
): Promise<{ ok: boolean }> {
  if (istExtension) return extSchreiben.punkt(eventId, itemId, fields);
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

/** Legt fest, ob ein Punkt vor dem Beginn der Veranstaltung läuft (Vorlauf, #423). */
export function setAgendaItemVorBeginn(
  eventId: number,
  itemId: number,
  vorBeginn: boolean,
): Promise<{ ok: boolean }> {
  if (istExtension) return extSchreiben.vorBeginn(eventId, itemId, vorBeginn);
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}/vor-beginn`, {
    method: 'PUT',
    body: JSON.stringify({ vorBeginn }),
  });
}

/** Alle Lieder (für die „Alle Lieder"-Ansicht) – ohne Statistik (lädt schnell). */
export function getSongLibrary(): Promise<SongLibraryEntry[]> {
  if (istExtension) return ext.lieder();
  return apiFetch<SongLibraryEntry[]>('/api/song-library');
}

/**
 * Die Lied-Kategorien, in denen der Nutzer anlegen/ändern darf (#322).
 *
 * Der Server schneidet die Liste bereits am ChurchTools-Recht zu – hier wird **nicht** noch einmal
 * gefiltert. Zwei Filter über dieselbe Regel wären zwei Stellen, die auseinanderlaufen können.
 */
export function getSongCategories(): Promise<SongCategory[]> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<SongCategory[]>('/api/song-categories');
}

/**
 * Im **Liedtext** des eigenen Bestands suchen (#322).
 *
 * Beim ersten Aufruf baut der Server dafür einen Index (ein Datei-Download je Lied) – das dauert
 * spürbar, danach kommt die Antwort aus dem Speicher. Gemessen: Weder ChurchTools noch CCLI können im
 * Liedtext suchen, deshalb macht es unser Server selbst (siehe `songTextIndex.ts`).
 */
export function sucheImLiedtext(q: string): Promise<SongTextTreffer[]> {
  if (istExtension) return ohneServer('Die Suche im Liedtext');
  return apiFetch<SongTextTreffer[]>(`/api/song-text-search?q=${encodeURIComponent(q)}`);
}

/**
 * Den Textanfang **eines** Liedes holen (#379) – für die Vorschau bei gleichnamigen Liedern.
 *
 * Baut den Suchindex **nicht**: Steht er beim Server frisch, kommt die Antwort daraus; sonst lädt er
 * genau dieses eine Notenblatt. Deshalb ist der Aufruf je Lied vertretbar – anders als ein
 * Index-Aufbau, der ~50 Downloads kostet.
 */
export function holeLiedtextVorschau(songId: number): Promise<LiedtextVorschau> {
  if (istExtension) return ohneServer('Die Liedtext-Vorschau');
  return apiFetch<LiedtextVorschau>(`/api/songs/${songId}/liedtext-vorschau`);
}

/**
 * Den Liedtext eines **SongSelect**-Liedes holen (#379) – die Vorschau vor dem Anlegen.
 *
 * **Nur beim bewussten Öffnen eines Treffers**, nie beim Durchsehen: Ob CCLI den Abruf als Nutzung
 * verbucht, ist offen (gemessen wurde nur, dass die Antwort keinen Hinweis darauf enthält). Der Hook
 * darüber speichert je Nummer zwischen.
 */
export function holeSongSelectLiedtext(songNumber: number): Promise<SongSelectLiedtext> {
  if (istExtension) return ohneServer('SongSelect');
  return apiFetch<SongSelectLiedtext>(`/api/songselect/songs/${songNumber}/liedtext`);
}

/**
 * Bei CCLI SongSelect nach einem Titel suchen (#322) – über ChurchTools als Vermittler.
 *
 * **Die Trefferliste ist nicht unbedingt vollständig:** ChurchTools holt 100 Treffer und zeigt keinen
 * Weg weiter (gemessen: 147 zu „Wo ich auch stehe"). Die Oberfläche sagt das, statt Vollständigkeit
 * vorzutäuschen.
 */
export function sucheSongSelect(title: string): Promise<SongSelectSuchergebnis> {
  if (istExtension) return ohneServer('SongSelect');
  return apiFetch<SongSelectSuchergebnis>(
    `/api/songselect/search?title=${encodeURIComponent(title)}`,
  );
}

/** Ein CCLI-Lied per Nummer abfragen (#322) – liefert zusätzlich das Copyright fürs Formular. */
export function getSongSelectSong(songNumber: number): Promise<SongSelectSong> {
  if (istExtension) return ohneServer('SongSelect');
  return apiFetch<SongSelectSong>(`/api/songselect/songs/${songNumber}`);
}

/**
 * Die Stammdaten eines Liedes lesen (#322, Schritt 11) – für das Änderungsformular.
 *
 * **Nicht aus der Bibliothek:** `SongLibraryEntry` kennt CCLI-Nummer, Copyright und Kategorie nicht.
 * Sie dort mitzuschleppen hieße, sie in jeder Liedliste zu laden, obwohl kein Bildschirm sie anzeigt.
 */
export function getSongStammdaten(songId: number): Promise<LiedStammdatenAnsicht> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<LiedStammdatenAnsicht>(`/api/songs/${songId}/stammdaten`);
}

/**
 * Stammdaten ändern (#322, Schritt 11) – **nur die geänderten Felder.**
 *
 * Der Server macht daraus ein vollständiges `PUT` (lesen–ändern–schreiben), weil ChurchTools bei einem
 * Teil-`PUT` die nicht gesendeten Felder löscht. Zurück kommt, was danach wirklich drinsteht.
 */
export function aendereLied(
  songId: number,
  aenderung: Partial<LiedStammdaten>,
): Promise<LiedStammdatenAnsicht> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<LiedStammdatenAnsicht>(`/api/songs/${songId}`, {
    method: 'PUT',
    body: JSON.stringify(aenderung),
  });
}

/**
 * Ein Lied löschen (#322, Schritt 11) – **samt allem, was daran hängt.**
 *
 * Die Rückfrage steht in der Oberfläche und nennt die Folgen. Zurück kommt der Name, weil es ihn danach
 * nicht mehr gibt, die Meldung ihn aber braucht.
 */
export function loescheLied(songId: number): Promise<{ name: string }> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<{ name: string }>(`/api/songs/${songId}`, { method: 'DELETE' });
}

/**
 * Die **Liedquellen** (Liederbücher) der Gemeinde (#396).
 *
 * Kommen bei ChurchTools aus der alten Schnittstelle; die App merkt davon nichts. Eine leere Liste
 * heißt „diese Gemeinde führt keine Liederbücher" – dann zeigt das Formular die Quelle gar nicht.
 */
export function getSongSources(): Promise<SongSource[]> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<SongSource[]>('/api/song-sources');
}

/**
 * Alle Arrangements eines Liedes **mit allen Feldern** (#396) – für das Stammdaten-Blatt.
 *
 * **Nicht `/api/songs/:id/arrangements`:** Dort steht die schmale Auswahl für „Zu Ablauf
 * hinzufügen". Acht Felder überall mitzuladen, wo nur ein Name gebraucht wird, wäre derselbe Fehler
 * wie CCLI-Nummer und Copyright in der Bibliothek.
 */
export function getArrangements(songId: number): Promise<ArrangementAnsicht[]> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<ArrangementAnsicht[]>(`/api/songs/${songId}/arrangements/verwaltung`);
}

/** Ein weiteres Arrangement anlegen (#396) – nie als Standard, das ist ein eigener Schritt. */
export function legeArrangementAn(
  songId: number,
  auftrag: ArrangementAuftrag & { name: string },
): Promise<ArrangementAnsicht> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<ArrangementAnsicht>(`/api/songs/${songId}/arrangements`, {
    method: 'POST',
    body: JSON.stringify(auftrag),
  });
}

/**
 * Ein Arrangement ändern (#396) – **nur die geänderten Felder.**
 *
 * `null` heißt „leeren", ein fehlendes Feld „unverändert". Der Server macht daraus ein
 * vollständiges `PUT`, weil ChurchTools bei einem Teil-`PUT` den Rest löscht.
 */
export function aendereArrangement(
  songId: number,
  arrangementId: number,
  auftrag: ArrangementAuftrag,
): Promise<ArrangementAnsicht> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<ArrangementAnsicht>(`/api/songs/${songId}/arrangements/${arrangementId}`, {
    method: 'PUT',
    body: JSON.stringify(auftrag),
  });
}

/**
 * Ein Arrangement zum **Standard** machen (#396).
 *
 * Zurück kommt die ganze Liste: Der Wechsel betrifft immer zwei Einträge, und die Oberfläche soll
 * nicht raten müssen, welcher das Flag verloren hat.
 */
export function arrangementZumStandard(
  songId: number,
  arrangementId: number,
): Promise<ArrangementAnsicht[]> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<ArrangementAnsicht[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/default`,
    { method: 'PATCH' },
  );
}

/** Ein Arrangement löschen (#396) – samt Notenblättern, Dateien und Versionen. */
export function loescheArrangement(
  songId: number,
  arrangementId: number,
): Promise<{ name: string }> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<{ name: string }>(`/api/songs/${songId}/arrangements/${arrangementId}`, {
    method: 'DELETE',
  });
}

/**
 * Ein neues Lied anlegen (#322) – Lied + erstes Arrangement.
 *
 * **Rechte, Kategorie und die CCLI-Doppelprüfung macht der Server**, nicht das Formular: Eine Prüfung,
 * die nur in der Oberfläche steht, umgeht jeder, der den Endpunkt direkt aufruft.
 */
export function legeLiedAn(auftrag: LiedAnlegenAuftrag): Promise<LiedAngelegt> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<LiedAngelegt>('/api/songs', {
    method: 'POST',
    body: JSON.stringify(auftrag),
  });
}

/**
 * Nutzungsdaten je Song: die vergangenen Spieltermine (YYYY-MM-DD, absteigend). Häufigkeit und
 * „zuletzt" für einen gewählten Zeitraum rechnet die Ansicht daraus selbst aus – separat, gecacht.
 */
export type SongUsageMap = Record<string, { dates: string[] }>;
export function getSongUsage(): Promise<SongUsageMap> {
  if (istExtension) return ohneServer('Die Lied-Statistik');
  return apiFetch<SongUsageMap>('/api/song-usage');
}

/** Arrangements eines bekannten Lieds (für „Zu Ablauf hinzufügen"). */
export function getSongArrangements(songId: number): Promise<SongArrangementOption[]> {
  if (istExtension) return ext.arrangements(songId);
  return apiFetch<SongArrangementOption[]>(`/api/songs/${songId}/arrangements`);
}

/** Chart-Daten eines einzelnen Lieds. */
export function getSongChart(songId: number, arrangementId?: number): Promise<SetlistSong> {
  if (istExtension) return ext.blatt(songId, arrangementId);
  const qs = arrangementId ? `?arrangementId=${arrangementId}` : '';
  return apiFetch<SetlistSong>(`/api/songs/${songId}/chart${qs}`);
}

/**
 * Die Dateien eines Arrangements – ALLE, flach (#321).
 *
 * Anders als `song.documents`, das nur die anzeigbaren PDFs/Bilder meint: Hier sind auch ChordPro,
 * die verwalteten Versionen und alles Übrige dabei.
 */
export function getArrangementFiles(
  songId: number,
  arrangementId: number,
): Promise<ArrangementFileEntry[]> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<ArrangementFileEntry[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/files`,
  );
}

/**
 * Eine Datei aus ChurchTools als Bytes holen (#321) – zum Herunterladen aufs Gerät.
 *
 * Derselbe Endpunkt, über den auch der Dokumenten-Betrachter liest; er prüft die Ziel-URL gegen die
 * eigene Instanz (#199).
 */
export function getSongFileBlob(songId: number, fileId: number): Promise<Blob> {
  if (istExtension) return ext.datei(songId, fileId);
  return apiFetchBlob(`/api/songs/${songId}/files/${fileId}`);
}

/**
 * Eine Datei an ein Arrangement hängen (#321) – gibt die frische Liste zurück.
 *
 * **Roher Rumpf, kein Multipart:** Die Datei geht unverändert als Body, ihre Art über
 * `Content-Type`, der Name über `?name=`. Der Server setzt daraus das Multipart für ChurchTools
 * zusammen. So braucht keine Seite eine Bibliothek zum Zerlegen von Multipart.
 *
 * Der `Content-Type` wird ausdrücklich gesetzt: `apiFetch` schreibt sonst bei jedem Rumpf
 * `application/json` – ein PDF käme dann als JSON deklariert an.
 */
export function uploadArrangementFile(
  songId: number,
  arrangementId: number,
  datei: File,
): Promise<ArrangementFileEntry[]> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<ArrangementFileEntry[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/files?name=${encodeURIComponent(datei.name)}`,
    {
      method: 'POST',
      body: datei,
      headers: { 'Content-Type': datei.type || 'application/octet-stream' },
    },
  );
}

/**
 * Das Notenblatt aus CCLI SongSelect ins Arrangement holen (#322).
 *
 * **Ersetzt ein vorhandenes Original-ChordPro** – pro Arrangement gehört genau eines hin, sonst
 * entscheidet die Reihenfolge von ChurchTools, welche Tonart angezeigt wird. Gibt die frische
 * Dateiliste zurück.
 */
export function holeChordProAusSongSelect(
  songId: number,
  arrangementId: number,
  songNumber: number,
): Promise<ArrangementFileEntry[]> {
  if (istExtension) return ohneServer('SongSelect');
  return apiFetch<ArrangementFileEntry[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/songselect/chordpro`,
    { method: 'POST', body: JSON.stringify({ songNumber }) },
  );
}

/**
 * Das **Original**-Notenblatt eines Arrangements aus eigenem Text schreiben – der Editor nach dem
 * Anlegen (Wunsch Alwin, 04.09.2026). Ersetzt ein vorhandenes Original; die verwalteten Versionen
 * bleiben. Dieselbe Server-Stelle wie der SongSelect-Import.
 */
export function speichereNotenblatt(
  songId: number,
  arrangementId: number,
  text: string,
): Promise<ArrangementFileEntry[]> {
  if (istExtension) return ohneServer('Das Bearbeiten von Notenblättern');
  return apiFetch<ArrangementFileEntry[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/chordpro`,
    { method: 'PUT', body: JSON.stringify({ text }) },
  );
}

/** Löscht eine Datei des Lieds (#321). Der Server prüft, dass sie wirklich zu ihm gehört. */
export function deleteSongFile(songId: number, fileId: number): Promise<void> {
  if (istExtension) return ohneServer('Die Liedverwaltung');
  return apiFetch<void>(`/api/songs/${songId}/files/${fileId}`, { method: 'DELETE' });
}

/** Löscht einen Ablaufpunkt. */
export function deleteAgendaItem(eventId: number, itemId: number): Promise<{ ok: boolean }> {
  if (istExtension) return extSchreiben.punktWeg(eventId, itemId);
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, { method: 'DELETE' });
}

/** Legt eine neue benannte Version eines Songs in ChurchTools an. */

export function createVersion(
  songId: number,
  arrangementId: number,
  name: string,
  text: string,
): Promise<SongVersion> {
  if (istExtension) return ohneServer('Das Bearbeiten von Notenblättern');
  return apiFetch(`/api/songs/${songId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ arrangementId, name, text }),
  });
}

/** Aktualisiert Text und/oder Namen einer Version. */
export function updateVersion(
  songId: number,
  arrangementId: number,
  versionKey: string,
  changes: { text?: string; name?: string },
): Promise<SongVersion> {
  if (istExtension) return ohneServer('Das Bearbeiten von Notenblättern');
  return apiFetch(`/api/songs/${songId}/versions/${encodeURIComponent(versionKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ arrangementId, ...changes }),
  });
}

/** Löscht eine benannte Version (das Original bleibt erhalten). */
export function deleteVersion(
  songId: number,
  arrangementId: number,
  versionKey: string,
): Promise<{ ok: boolean }> {
  if (istExtension) return ohneServer('Das Bearbeiten von Notenblättern');
  return apiFetch(`/api/songs/${songId}/versions/${encodeURIComponent(versionKey)}`, {
    method: 'DELETE',
    body: JSON.stringify({ arrangementId }),
  });
}

/**
 * Setzt das Tempo eines Arrangements in ChurchTools.
 *
 * ⚠️ Das gilt für ALLE, die das Lied öffnen – auch rückwirkend für vergangene Gottesdienste. Anders
 * als die Anzeige-Einstellungen (Tonart, Spalten, Schrift), die bewusst persönlich bleiben.
 */
export function setArrangementTempo(
  songId: number,
  arrangementId: number,
  tempo: number,
): Promise<{ tempo: number }> {
  if (istExtension) return extSchreiben.tempo(songId, arrangementId, tempo);
  return apiFetch(`/api/songs/${songId}/arrangements/${arrangementId}/tempo`, {
    method: 'PUT',
    body: JSON.stringify({ tempo }),
  });
}
