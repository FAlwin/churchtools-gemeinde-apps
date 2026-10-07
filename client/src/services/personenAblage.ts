/**
 * Der Speicher der ChurchTools-Extension: die **Personen-Dateien** des eigenen Kontos (#334).
 *
 * Warum Dateien und nicht die Custom-Module-Daten (gemessen 07.10.2026, Plan §2b): Ein Wert dort fasst
 * höchstens 10.000 Zeichen, und man lädt immer die ganze Kategorie **aller** Musiker. Personen-Dateien
 * lädt man gezielt je Person, ein Mitglied darf sie an sich selbst hängen, und fremde ändern oder
 * löschen verweigert ChurchTools (403). Lesen können sie andere Mitglieder – von Alwin hingenommen.
 *
 * **Die einzige Stelle, die Personen-Dateien liest und schreibt.** Abgelegt wird:
 * - je Seite mit Zeichnung ein Bild `musikapp_<Schlüssel>.png` (Schlüssel aus `@shared/keys`)
 * - alles andere in EINER Datei `musikapp_daten.json`: Einstellungen, Textnotizen, Zoom, „gesehen"
 *
 * **Ersetzen ist ein Doppelschritt**, weil ChurchTools Dateien nicht überschreiben kann: neue Fassung
 * hochladen → Liste neu lesen → erst wenn sie dort steht, die alten löschen (Lehre vom 11.08.2026:
 * ein Erfolgssignal ist kein Beleg). Bleibt eine alte Fassung liegen, schadet das nicht: Bilder nehmen
 * die neueste, die Daten-Dateien werden Feld für Feld nach Zeitstempel zusammengeführt. Deshalb
 * verliert auch ein zweites Gerät, das gleichzeitig schreibt, nichts.
 *
 * Die Härtungen gegen verlorene Änderungen (Warteschlange, Wiederholen, Nachholen nach Neustart)
 * liegen NICHT hier, sondern unverändert in `annotations.ts`/`userSettings.ts` – ausgetauscht wird
 * dort nur der Transportweg. Dieser Baustein wirft bei jedem Fehler; verworfen wird hier nichts.
 */
import { ApiError } from './api';
import { ctAnfrage, ctDatei, KeinSpeicherRecht } from './ctRuntime';
import {
  SETTINGS_KEY_RE,
  SETTINGS_MAX_WERT,
  songIdOfAnnoKey,
  songIdOfSettingsKey,
} from '@shared/keys/index';
import {
  GESEHEN_MAX_ALTER_MS,
  type AnnotationText,
  type GesehenerStand,
  type GespeicherterZoom,
  type PageAnnotation,
} from '@shared/types/index';

const PRAEFIX = 'musikapp_';
const DATEN_NAME = `${PRAEFIX}daten.json`;
const BILD_RE = /^musikapp_(.+)\.png$/;
/** Gelöschte Felder bleiben als Grabstein stehen, damit ein anderes Gerät sie nicht zurückholt. */
const GRABSTEIN_MAX_ALTER_MS = 180 * 24 * 60 * 60 * 1000;

interface Datei {
  id: number;
  name: string;
  fileUrl: string;
}

/** Ein Feld der Daten-Datei: Wert (`null` = gelöscht) + Zeitpunkt der Änderung. */
interface Feld {
  w: unknown;
  t: number;
}

export interface DatenDatei {
  v: 1;
  felder: Record<string, Feld>;
}

// ── Zustand im Speicher ──────────────────────────────────────────────────────
let ich: number | null = null;
/** Die Dateiliste der eigenen Person – einmal geladen, nach jedem Hochladen neu gelesen. */
let liste: Datei[] | null = null;
/** Inhalt geladener Dateien je Datei-ID: Eine Datei ändert sich nie, eine neue Fassung hat eine neue ID. */
const bildInhalt = new Map<number, string>();
const datenInhalt = new Map<number, DatenDatei>();
/**
 * Alle Zugriffe dieses Geräts laufen nacheinander – Lesen eingeschlossen. Sonst könnte ein Lesen, das
 * mitten in ein Ersetzen fällt, eine gerade gelöschte Fassung zurück in die Liste schreiben.
 */
let kette: Promise<unknown> = Promise.resolve();

/** Nur für Tests: alles vergessen. */
export function _zuruecksetzen(): void {
  ich = null;
  liste = null;
  bildInhalt.clear();
  datenInhalt.clear();
  kette = Promise.resolve();
}

function nacheinander<T>(fn: () => Promise<T>): Promise<T> {
  const lauf = kette.then(fn, fn);
  kette = lauf.catch(() => {});
  return lauf;
}

async function meineId(): Promise<number> {
  if (ich !== null) return ich;
  const body = await ctAnfrage<{ data?: { id?: unknown } }>('/whoami');
  const id = body?.data?.id;
  // id -1 = keine gültige Sitzung (#381) – dann gibt es keine eigene Ablage.
  if (typeof id !== 'number' || id <= 0)
    throw new ApiError(401, 'Bei ChurchTools nicht angemeldet.');
  ich = id;
  return id;
}

/** Die Dateien der App an einer Person – älteste zuerst (ChurchTools vergibt aufsteigende IDs). */
async function listeVon(personId: number): Promise<Datei[]> {
  const body = await ctAnfrage<{ data?: unknown }>(`/files/person/${personId}`);
  const roh = Array.isArray(body?.data) ? (body.data as Record<string, unknown>[]) : [];
  return roh
    .filter(
      (f) =>
        typeof f.id === 'number' && typeof f.name === 'string' && typeof f.fileUrl === 'string',
    )
    .map((f) => ({ id: f.id as number, name: f.name as string, fileUrl: f.fileUrl as string }))
    .filter((f) => f.name.startsWith(PRAEFIX))
    .sort((a, b) => a.id - b.id);
}

/** Die Dateiliste der eigenen Person neu lesen. */
export async function aktualisiereListe(): Promise<void> {
  liste = await listeVon(await meineId());
}

async function dateien(): Promise<Datei[]> {
  if (liste === null) await aktualisiereListe();
  return liste ?? [];
}

/** Alle Fassungen einer Datei, älteste zuerst (ChurchTools vergibt aufsteigende IDs). */
function fassungen(name: string, l: Datei[] = liste ?? []): Datei[] {
  return l.filter((f) => f.name === name);
}

/**
 * Eine Datei ersetzen: hochladen → Liste neu lesen → die neue Fassung muss da sein → alte löschen.
 * Scheitert das Löschen einer alten Fassung vorübergehend, bleibt sie liegen – die neuere gewinnt.
 */
async function ersetze(name: string, inhalt: Blob): Promise<void> {
  await dateien();
  const alt = fassungen(name).map((f) => f.id);
  const form = new FormData();
  form.append('files[]', inhalt, name);
  await ctAnfrage(`/files/person/${await meineId()}`, { method: 'POST', body: form });
  await aktualisiereListe();
  const neu = fassungen(name).filter((f) => !alt.includes(f.id));
  if (neu.length === 0) {
    throw new ApiError(
      502,
      'ChurchTools hat das Speichern bestätigt, die Datei ist aber nicht da. Es wurde nichts gelöscht.',
    );
  }
  for (const id of alt) {
    try {
      await ctAnfrage(`/files/${id}`, { method: 'DELETE' });
      liste = (liste ?? []).filter((f) => f.id !== id);
    } catch (e) {
      if (e instanceof KeinSpeicherRecht) throw e;
      // Vorübergehend: Die alte Fassung bleibt liegen; beim Lesen gewinnt die neuere.
    }
  }
}

/** Alle Fassungen einer Datei löschen. Wirft, wenn eine stehen bleibt – sonst käme sie zurück. */
async function loescheAlle(name: string): Promise<void> {
  await dateien();
  for (const f of fassungen(name)) {
    try {
      await ctAnfrage(`/files/${f.id}`, { method: 'DELETE' });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e; // schon weg = erledigt
    }
    liste = (liste ?? []).filter((x) => x.id !== f.id);
  }
}

// ── Bilder ───────────────────────────────────────────────────────────────────
function bildName(key: string): string {
  return `${PRAEFIX}${key}.png`;
}

/** `data:image/png;base64,…` → Blob. Wirft bei allem anderen (dann ist der Aufrufer kaputt). */
function blobAusDataUrl(dataUrl: string): Blob {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
  if (!m) throw new Error('Zeichnung ist keine Bild-Adresse (data:…;base64).');
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

async function dataUrlAusBlob(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  // ChurchTools liefert die Datei als `application/unknown` – es ist aber immer unser PNG.
  return `data:image/png;base64,${btoa(bin)}`;
}

/** Die neueste Fassung jeder Zeichnung dieser Lieder (Schlüssel → Datei), aus einer Dateiliste. */
function neuesteBilder(l: Datei[], songIds: Set<number>): Map<string, Datei> {
  const neueste = new Map<string, Datei>();
  for (const f of l) {
    const key = f.name.match(BILD_RE)?.[1];
    if (!key) continue;
    const song = songIdOfAnnoKey(key);
    if (song === null || !songIds.has(song)) continue;
    neueste.set(key, f); // aufsteigend sortiert → die letzte ist die neueste
  }
  return neueste;
}

/** Die neueste Fassung jeder Zeichnung dieser Lieder (Schlüssel → PNG-DataURL). */
async function ladeBilder(l: Datei[], songIds: Set<number>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, f] of neuesteBilder(l, songIds)) {
    let inhalt = bildInhalt.get(f.id);
    if (inhalt === undefined) {
      inhalt = await dataUrlAusBlob(await ctDatei(f.fileUrl));
      bildInhalt.set(f.id, inhalt);
    }
    out[key] = inhalt;
  }
  return out;
}

// ── Daten-Datei ──────────────────────────────────────────────────────────────
function leer(): DatenDatei {
  return { v: 1, felder: {} };
}

function istDatenDatei(x: unknown): x is DatenDatei {
  return (
    !!x &&
    typeof x === 'object' &&
    (x as { v?: unknown }).v === 1 &&
    !!(x as { felder?: unknown }).felder &&
    typeof (x as { felder?: unknown }).felder === 'object'
  );
}

/** Zwei Stände Feld für Feld zusammenführen – die jüngere Änderung gewinnt. */
export function mische(a: DatenDatei, b: DatenDatei): DatenDatei {
  const felder: Record<string, Feld> = { ...a.felder };
  for (const [k, f] of Object.entries(b.felder)) {
    const da = felder[k];
    if (!da || f.t >= da.t) felder[k] = f;
  }
  return { v: 1, felder };
}

/**
 * Der zusammengeführte Stand aller vorhandenen Fassungen der Daten-Datei.
 *
 * Eine Fassung, die sich nicht lesen lässt, **wirft** – sie als leer zu behandeln hieße, beim nächsten
 * Schreiben einen Stand ohne ihre Felder hochzuladen und sie danach zu löschen (#273: nur „nicht
 * vorhanden" ist leer). Eine unlesbare Fassung, die nicht als Daten-Datei zu erkennen ist, bleibt außen
 * vor: Das ist keine von uns.
 */
async function ladeDaten(l: Datei[] = liste ?? []): Promise<DatenDatei> {
  let stand = leer();
  for (const f of fassungen(DATEN_NAME, l)) {
    let inhalt = datenInhalt.get(f.id);
    if (inhalt === undefined) {
      const text = await (await ctDatei(f.fileUrl)).text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        continue;
      }
      if (!istDatenDatei(json)) continue;
      inhalt = json;
      datenInhalt.set(f.id, inhalt);
    }
    stand = mische(stand, inhalt);
  }
  return stand;
}

/**
 * Felder der Daten-Datei ändern (`null` = löschen) und die Datei ersetzen.
 *
 * Gelesen wird dafür nur die eigene, kleine Datei – nicht „alles von allen" wie bei der Vorlage. Die
 * Liste wird vorher NICHT neu geholt: Hat ein anderes Gerät inzwischen eine Fassung abgelegt, steht sie
 * nach dem Hochladen als „neu" in der Liste und wird nicht gelöscht; der nächste Leser führt beide
 * zusammen.
 */
async function schreibeFelder(
  aenderungen: Record<string, unknown>,
  jetzt = Date.now(),
): Promise<void> {
  await dateien();
  const stand = await ladeDaten();
  for (const [k, w] of Object.entries(aenderungen)) stand.felder[k] = { w: w ?? null, t: jetzt };
  for (const [k, f] of Object.entries(stand.felder)) {
    if (f.w === null && jetzt - f.t > GRABSTEIN_MAX_ALTER_MS) delete stand.felder[k];
  }
  const blob = new Blob([JSON.stringify(stand)], { type: 'application/json' });
  await ersetze(DATEN_NAME, blob);
}

// ── Anmerkungen ──────────────────────────────────────────────────────────────
const textFeld = (key: string) => `anno:${key}:texts`;
const zoomFeld = (key: string) => `anno:${key}:zoom`;
const ANNO_FELD_RE = /^anno:(.+):(texts|zoom)$/;

/** Wie `GET /api/annotations?songs=…` des Servers: alle eigenen Anmerkungen dieser Lieder. */
export function holeAnmerkungen(songIds: number[]): Promise<Record<string, PageAnnotation>> {
  return nacheinander(() => anmerkungenLesen(songIds));
}

async function anmerkungenLesen(songIds: number[]): Promise<Record<string, PageAnnotation>> {
  await aktualisiereListe();
  return anmerkungenAus(liste ?? [], songIds);
}

/** Anmerkungen dieser Lieder aus einer Dateiliste – der eigenen oder der einer teilenden Person. */
async function anmerkungenAus(
  l: Datei[],
  songIds: number[],
): Promise<Record<string, PageAnnotation>> {
  const ids = new Set(songIds);
  const bilder = await ladeBilder(l, ids);
  const daten = await ladeDaten(l);
  const out: Record<string, PageAnnotation> = {};
  const seite = (key: string) => (out[key] ??= {});
  for (const [key, strokes] of Object.entries(bilder)) seite(key).strokes = strokes;
  for (const [name, f] of Object.entries(daten.felder)) {
    const m = name.match(ANNO_FELD_RE);
    if (!m || f.w === null) continue;
    const song = songIdOfAnnoKey(m[1]);
    if (song === null || !ids.has(song)) continue;
    if (m[2] === 'texts') seite(m[1]).texts = f.w as AnnotationText[];
    else seite(m[1]).zoom = f.w as GespeicherterZoom;
  }
  return out;
}

/** Wie `PUT /api/annotations/<key>` des Servers: nur die übergebenen Felder ändern. */
export function schreibeAnmerkung(key: string, teil: PageAnnotation): Promise<void> {
  return nacheinander(async () => {
    if ('strokes' in teil) {
      if (teil.strokes) await ersetze(bildName(key), blobAusDataUrl(teil.strokes));
      else await loescheAlle(bildName(key));
    }
    const felder: Record<string, unknown> = {};
    if ('texts' in teil) felder[textFeld(key)] = teil.texts?.length ? teil.texts : null;
    if ('zoom' in teil) felder[zoomFeld(key)] = teil.zoom ?? null;
    if (Object.keys(felder).length > 0) await schreibeFelder(felder);
  });
}

// ── Einstellungen ────────────────────────────────────────────────────────────
const einstFeld = (key: string) => `einst:${key}`;

/** Wie `GET /api/settings?songs=…` des Servers. */
export function holeEinstellungen(songIds: number[]): Promise<Record<string, string>> {
  return nacheinander(() => einstellungenLesen(songIds));
}

async function einstellungenLesen(songIds: number[]): Promise<Record<string, string>> {
  await aktualisiereListe();
  return liedEinstellungenAus(await ladeDaten(), songIds);
}

/** Die Lied-Einstellungen dieser Lieder aus einer Daten-Datei. */
function liedEinstellungenAus(daten: DatenDatei, songIds: number[]): Record<string, string> {
  const ids = new Set(songIds);
  const out: Record<string, string> = {};
  for (const [name, f] of Object.entries(daten.felder)) {
    if (!name.startsWith('einst:') || typeof f.w !== 'string') continue;
    const key = name.slice('einst:'.length);
    const song = songIdOfSettingsKey(key);
    if (song !== null && ids.has(song)) out[key] = f.w;
  }
  return out;
}

/** Wie `PUT /api/settings` des Servers: mehrere setzen/entfernen (`null`/`''` entfernt). */
export function schreibeEinstellungen(eintraege: Record<string, string | null>): Promise<void> {
  return nacheinander(async () => {
    const felder: Record<string, unknown> = {};
    for (const [key, wert] of Object.entries(eintraege)) {
      if (!SETTINGS_KEY_RE.test(key)) continue;
      // Wie der Server: leer heißt entfernen, Werte gekappt (`SETTINGS_MAX_WERT`).
      felder[einstFeld(key)] =
        wert === null || wert === '' ? null : String(wert).slice(0, SETTINGS_MAX_WERT);
    }
    if (Object.keys(felder).length > 0) await schreibeFelder(felder);
  });
}

// ── „Gesehen" (#143) ─────────────────────────────────────────────────────────
const gesehenFeld = (eventId: number) => `gesehen:${eventId}`;

/** Gemerkte Stände (Termin-ID → Stand), ohne zu alte. */
export function holeGesehen(jetzt = Date.now()): Promise<Record<number, GesehenerStand>> {
  return nacheinander(() => gesehenLesen(jetzt));
}

async function gesehenLesen(jetzt: number): Promise<Record<number, GesehenerStand>> {
  await aktualisiereListe();
  const daten = await ladeDaten();
  const out: Record<number, GesehenerStand> = {};
  for (const [name, f] of Object.entries(daten.felder)) {
    const m = name.match(/^gesehen:(\d+)$/);
    if (!m || !f.w) continue;
    const stand = f.w as GesehenerStand;
    if (jetzt - stand.seenAt <= GESEHEN_MAX_ALTER_MS) out[Number(m[1])] = stand;
  }
  return out;
}

/** Einen Stand als gesehen merken – und zu alte dabei aufräumen (wie `seenSetlists.markSeenSetlist`). */
export function merkeGesehen(
  eventId: number,
  stand: Omit<GesehenerStand, 'seenAt'>,
  jetzt = Date.now(),
): Promise<void> {
  return nacheinander(async () => {
    await dateien();
    const daten = await ladeDaten();
    const felder: Record<string, unknown> = { [gesehenFeld(eventId)]: { ...stand, seenAt: jetzt } };
    for (const [name, f] of Object.entries(daten.felder)) {
      if (!name.startsWith('gesehen:') || !f.w) continue;
      if (jetzt - (f.w as GesehenerStand).seenAt > GESEHEN_MAX_ALTER_MS) felder[name] = null;
    }
    await schreibeFelder(felder, jetzt);
  });
}

// ── Teilen (Team-Notizen, #335 3b-4b) ────────────────────────────────────────
/**
 * Ob eine Person ihre Anmerkungen teilt, steht in IHRER Daten-Datei – und die kann nur sie selbst
 * ändern (fremde Personen-Dateien schreiben verweigert ChurchTools mit 403, Plan §2b). Die Liste „Wer
 * teilt" in den Daten der Erweiterung (`ctTeilen.ts`) ist nur das Verzeichnis, wo man nachsehen muss;
 * ein Eintrag dort, den die Person nicht selbst bestätigt, bewirkt nichts.
 */
const TEILEN_FELD = 'teilen';

interface TeilenStand {
  an: boolean;
  /** Anzeigename für „Notizen von …" – aus der eigenen Datei, nicht aus dem Verzeichnis. */
  name: string;
}

function teilenAus(daten: DatenDatei): TeilenStand | null {
  const w = daten.felder[TEILEN_FELD]?.w as Partial<TeilenStand> | null | undefined;
  if (!w || typeof w.an !== 'boolean') return null;
  return { an: w.an, name: typeof w.name === 'string' ? w.name : '' };
}

/** Teilt die eigene Person ihre Anmerkungen? Ohne Eintrag: nein. */
export function holeTeilen(): Promise<boolean> {
  return nacheinander(async () => {
    await aktualisiereListe();
    return teilenAus(await ladeDaten())?.an === true;
  });
}

/** Das eigene Teilen ein- oder ausschalten – mit dem Namen, unter dem andere die Notizen sehen. */
export function schreibeTeilen(an: boolean, name: string): Promise<void> {
  return nacheinander(() => schreibeFelder({ [TEILEN_FELD]: { an, name } }));
}

/** Was eine andere Person teilt: ihre Dateiliste und ihre Daten-Datei, einmal gelesen. */
export interface GeteilteAblage {
  personId: number;
  name: string;
  liste: Datei[];
  daten: DatenDatei;
}

/**
 * Die Ablage einer anderen Person – **nur, wenn sie laut ihrer eigenen Datei teilt**, sonst `null`.
 * Lesen dürfen das Mitglieder, die die Person sehen dürfen (gemessen, Plan §2b).
 */
export async function geteilteAblage(personId: number): Promise<GeteilteAblage | null> {
  const liste = await listeVon(personId);
  const daten = await ladeDaten(liste);
  const teilen = teilenAus(daten);
  if (!teilen?.an) return null;
  return { personId, name: teilen.name, liste, daten };
}

/** Zu welchen dieser Lieder hat die Person Anmerkungen (Striche oder Texte)? Zoom zählt nicht. */
export function geteilteLieder(a: GeteilteAblage, songIds: number[]): number[] {
  const ids = new Set(songIds);
  const gefunden = new Set<number>();
  for (const key of neuesteBilder(a.liste, ids).keys()) {
    const song = songIdOfAnnoKey(key);
    if (song !== null) gefunden.add(song);
  }
  for (const [name, f] of Object.entries(a.daten.felder)) {
    const m = name.match(ANNO_FELD_RE);
    if (!m || m[2] !== 'texts' || !Array.isArray(f.w) || f.w.length === 0) continue;
    const song = songIdOfAnnoKey(m[1]);
    if (song !== null && ids.has(song)) gefunden.add(song);
  }
  return [...gefunden];
}

/** Die geteilten Anmerkungen dieser Lieder – **ohne Zoom** (der ist persönlich, wie im Server). */
export async function geteilteAnmerkungen(
  a: GeteilteAblage,
  songIds: number[],
): Promise<Record<string, { strokes: string | null; texts: AnnotationText[] }>> {
  const out: Record<string, { strokes: string | null; texts: AnnotationText[] }> = {};
  for (const [key, seite] of Object.entries(await anmerkungenAus(a.liste, songIds))) {
    const strokes = seite.strokes ?? null;
    const texts = seite.texts ?? [];
    if (!strokes && texts.length === 0) continue;
    out[key] = { strokes, texts };
  }
  return out;
}

/** Die Lied-Einstellungen der Person – damit ihre Anmerkungen in IHRER Ansicht stehen. */
export function geteilteEinstellungen(
  a: GeteilteAblage,
  songIds: number[],
): Record<string, string> {
  return liedEinstellungenAus(a.daten, songIds);
}
