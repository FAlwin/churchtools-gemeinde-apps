/**
 * **Die Personen-Ablage** – Anmerkungen, Lied-Einstellungen, „gesehen" und Teilen in den Dateien des
 * eigenen ChurchTools-Kontos (#334). Seit dem Umzug der Server-App nach ChurchTools die Regel für
 * **beide** Auslieferungen: Die Erweiterung spricht ChurchTools aus dem Browser an
 * (`client/src/services/personenAblage.ts`), der Server mit der Sitzung der Person
 * (`server/src/services/ctPersonenAblage.ts`). Beide geben dafür einen `AblagePort` mit.
 *
 * Warum Dateien und nicht die Custom-Module-Daten (gemessen 07.10.2026, Plan §2b): Ein Wert dort fasst
 * höchstens 10.000 Zeichen, und man lädt immer die ganze Kategorie **aller** Musiker. Personen-Dateien
 * lädt man gezielt je Person, ein Mitglied darf sie an sich selbst hängen, und fremde ändern oder
 * löschen verweigert ChurchTools (403). Lesen können sie andere Mitglieder – von Alwin hingenommen.
 * Vom Server aus gemessen (09.10.2026): Hochladen braucht das CSRF-Token (ohne → 401), Herunterladen
 * und Löschen gehen mit der Sitzung.
 *
 * Abgelegt wird:
 * - je Seite mit Zeichnung ein Bild `musikapp_<Schlüssel>.png` (Schlüssel aus `@shared/keys`)
 * - alles andere in EINER Datei `musikapp_daten.json`: Einstellungen, Textnotizen, Zoom, „gesehen"
 *
 * **Ersetzen ist ein Doppelschritt**, weil ChurchTools Dateien nicht überschreiben kann: neue Fassung
 * hochladen → Liste neu lesen → erst wenn sie dort steht, die alten löschen (Lehre vom 11.08.2026:
 * ein Erfolgssignal ist kein Beleg). Bleibt eine alte Fassung liegen, schadet das nicht: Bilder nehmen
 * die neueste, die Daten-Dateien werden Feld für Feld nach Zeitstempel zusammengeführt. Deshalb
 * verliert auch ein zweites Gerät, das gleichzeitig schreibt, nichts.
 *
 * Dieser Baustein wirft bei jedem Fehler; verworfen wird hier nichts. Die Härtungen gegen verlorene
 * Änderungen (Warteschlange, Wiederholen, Nachholen nach Neustart) liegen bei den Aufrufern.
 */
import {
  SETTINGS_KEY_RE,
  SETTINGS_MAX_WERT,
  songIdOfAnnoKey,
  songIdOfSettingsKey,
} from '../keys/index';
import {
  GESEHEN_MAX_ALTER_MS,
  type AnnotationText,
  type GesehenerStand,
  type GespeicherterZoom,
  type PageAnnotation,
} from '../types/index';

/** Der Anschluss an ChurchTools – Browser (Erweiterung) oder Server (Sitzung der Person). */
export interface AblagePort {
  /** Die eigene Person (`id > 0`); wirft 401, wenn niemand angemeldet ist. */
  meineId(): Promise<number>;
  /** `GET /api<pfad>` – der rohe JSON-Rumpf. */
  lesen(pfad: string): Promise<unknown>;
  /** Den Inhalt einer Datei (`fileUrl` aus der Dateiliste). */
  datei(fileUrl: string): Promise<Uint8Array>;
  /** Eine Datei an die Person hängen (`POST /api/files/person/<id>`, Feld `files[]`). */
  hochladen(personId: number, name: string, inhalt: Uint8Array, typ: string): Promise<void>;
  /** `DELETE /api/files/<id>`. */
  loeschen(fileId: number): Promise<void>;
  fehler(status: number, meldung: string): Error;
  /** Fehlendes Recht (dauerhaft) – das darf nicht als „vorübergehend" verschluckt werden. */
  istKeinRecht(e: unknown): boolean;
  /** 404 – beim Löschen heißt das „schon weg". */
  istNichtGefunden(e: unknown): boolean;
}

const PRAEFIX = 'musikapp_';
export const DATEN_NAME = `${PRAEFIX}daten.json`;
const BILD_RE = /^musikapp_(.+)\.png$/;
/** Gelöschte Felder bleiben als Grabstein stehen, damit ein anderes Gerät sie nicht zurückholt. */
const GRABSTEIN_MAX_ALTER_MS = 180 * 24 * 60 * 60 * 1000;

export interface Datei {
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

// ── Reine Regeln ─────────────────────────────────────────────────────────────
export function bildName(key: string): string {
  return `${PRAEFIX}${key}.png`;
}

/** Die App-Dateien einer Person aus der Antwort von `/files/person/<id>` – älteste zuerst. */
export function dateienAus(body: unknown): Datei[] {
  const daten = (body as { data?: unknown } | null)?.data;
  const roh = Array.isArray(daten) ? (daten as Record<string, unknown>[]) : [];
  return roh
    .filter(
      (f) =>
        typeof f.id === 'number' && typeof f.name === 'string' && typeof f.fileUrl === 'string',
    )
    .map((f) => ({ id: f.id as number, name: f.name as string, fileUrl: f.fileUrl as string }))
    .filter((f) => f.name.startsWith(PRAEFIX))
    .sort((a, b) => a.id - b.id);
}

/** Alle Fassungen einer Datei, älteste zuerst (ChurchTools vergibt aufsteigende IDs). */
function fassungen(name: string, l: Datei[]): Datei[] {
  return l.filter((f) => f.name === name);
}

/** `data:image/png;base64,…` → Bytes + Typ. Wirft bei allem anderen (dann ist der Aufrufer kaputt). */
export function bytesAusDataUrl(dataUrl: string): { bytes: Uint8Array; typ: string } {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
  if (!m) throw new Error('Zeichnung ist keine Bild-Adresse (data:…;base64).');
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, typ: m[1] };
}

/** Bytes → `data:image/png;base64,…`. ChurchTools liefert `application/unknown` – es ist immer unser PNG. */
export function dataUrlAusBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
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

const textFeld = (key: string) => `anno:${key}:texts`;
const zoomFeld = (key: string) => `anno:${key}:zoom`;
const ANNO_FELD_RE = /^anno:(.+):(texts|zoom)$/;
const einstFeld = (key: string) => `einst:${key}`;
const gesehenFeld = (eventId: number) => `gesehen:${eventId}`;

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

/**
 * Ob eine Person ihre Anmerkungen teilt, steht in IHRER Daten-Datei – und die kann nur sie selbst
 * ändern (fremde Personen-Dateien schreiben verweigert ChurchTools mit 403, Plan §2b). Die Liste „Wer
 * teilt" in den Daten der Erweiterung ist nur das Verzeichnis, wo man nachsehen muss; ein Eintrag dort,
 * den die Person nicht selbst bestätigt, bewirkt nichts.
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

/** Was eine andere Person teilt: ihre Dateiliste und ihre Daten-Datei, einmal gelesen. */
export interface GeteilteAblage {
  personId: number;
  name: string;
  liste: Datei[];
  daten: DatenDatei;
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

/** Die Lied-Einstellungen der Person – damit ihre Anmerkungen in IHRER Ansicht stehen. */
export function geteilteEinstellungen(
  a: GeteilteAblage,
  songIds: number[],
): Record<string, string> {
  return liedEinstellungenAus(a.daten, songIds);
}

// ── Umzug aus der alten Server-Ablage (09.10.2026) ───────────────────────────
/** Was die Server-App bis zum Umzug auf ihrem Daten-Volume hatte – je Person. */
export interface Altbestand {
  anmerkungen: Record<string, PageAnnotation>;
  einstellungen: Record<string, string>;
  gesehen: Record<number, GesehenerStand>;
  teilen: { an: boolean; name: string } | null;
}

/** Was beim Umzug fehlt bzw. übernommen wurde. */
export interface UmzugBericht {
  /** Seiten, deren Bild hochgeladen wurde (bzw. bei `pruefe` noch fehlt). */
  bilder: number;
  /** Felder der Daten-Datei (Texte, Zoom, Einstellungen, gesehen, teilen). */
  felder: number;
}

/**
 * Welche Seiten stehen schon in ChurchTools? Eine Seite zählt, sobald es IRGENDETWAS zu ihr gibt –
 * ein Bild oder ein Feld, auch ein gelöschtes (Grabstein): **ChurchTools gewinnt** (Alwin, 09.10.2026).
 * Wer eine Seite in der Erweiterung schon bearbeitet oder geleert hat, bekommt sie nicht vom NAS zurück.
 */
function seitenInChurchTools(l: Datei[], daten: DatenDatei): Set<string> {
  const da = new Set<string>();
  for (const f of l) {
    const key = f.name.match(BILD_RE)?.[1];
    if (key) da.add(key);
  }
  for (const name of Object.keys(daten.felder)) {
    const m = name.match(ANNO_FELD_RE);
    if (m) da.add(m[1]);
  }
  return da;
}

/** Was vom Altbestand in ChurchTools noch fehlt – Seiten mit Bild und die fehlenden Felder. */
function fehlendes(
  alt: Altbestand,
  l: Datei[],
  daten: DatenDatei,
  jetzt = Date.now(),
): { bilder: [string, string][]; felder: Record<string, unknown> } {
  const da = seitenInChurchTools(l, daten);
  const bilder: [string, string][] = [];
  const felder: Record<string, unknown> = {};
  for (const [key, seite] of Object.entries(alt.anmerkungen)) {
    if (da.has(key)) continue;
    if (seite.strokes) bilder.push([key, seite.strokes]);
    if (seite.texts?.length) felder[textFeld(key)] = seite.texts;
    if (seite.zoom) felder[zoomFeld(key)] = seite.zoom;
  }
  for (const [key, wert] of Object.entries(alt.einstellungen)) {
    if (!SETTINGS_KEY_RE.test(key) || !wert) continue;
    if (!(einstFeld(key) in daten.felder))
      felder[einstFeld(key)] = wert.slice(0, SETTINGS_MAX_WERT);
  }
  for (const [eventId, stand] of Object.entries(alt.gesehen)) {
    // Zu alte Stände zählen ohnehin nicht mehr (`holeGesehen` lässt sie weg) – die ziehen nicht um.
    if (jetzt - stand.seenAt > GESEHEN_MAX_ALTER_MS) continue;
    const name = gesehenFeld(Number(eventId));
    if (!(name in daten.felder)) felder[name] = stand;
  }
  if (alt.teilen && !(TEILEN_FELD in daten.felder)) felder[TEILEN_FELD] = alt.teilen;
  return { bilder, felder };
}

// ── Die Ablage mit Zustand ───────────────────────────────────────────────────
/**
 * Eine Ablage mit ihrem Zustand: Dateiliste der eigenen Person, Inhalte geladener Dateien und die
 * Reihenfolge aller Zugriffe. Die Erweiterung hat genau eine; der Server eine je Person.
 *
 * Den Anschluss bekommt jeder Aufruf mit, nicht die Fabrik: Im Server hängt er an der Sitzung der
 * Anfrage, und die kann sich zwischen zwei Aufrufen erneuert haben.
 */
export function erstellePersonenAblage(
  opts: {
    /** Höchstens so viele Bilder im Speicher (die zuletzt gebrauchten). Ohne Angabe: alle. */
    maxBilder?: number;
  } = {},
) {
  /** Die Dateiliste der eigenen Person – einmal geladen, nach jedem Hochladen neu gelesen. */
  let liste: Datei[] | null = null;
  /** Inhalt geladener Dateien je Datei-ID: Eine Datei ändert sich nie, eine neue Fassung hat eine neue ID. */
  const bildInhalt = new Map<number, string>();
  const datenInhalt = new Map<number, DatenDatei>();
  /**
   * Alle Zugriffe laufen nacheinander – Lesen eingeschlossen. Sonst könnte ein Lesen, das mitten in ein
   * Ersetzen fällt, eine gerade gelöschte Fassung zurück in die Liste schreiben.
   */
  let kette: Promise<unknown> = Promise.resolve();

  function nacheinander<T>(fn: () => Promise<T>): Promise<T> {
    const lauf = kette.then(fn, fn);
    kette = lauf.catch(() => {});
    return lauf;
  }

  async function listeVon(p: AblagePort, personId: number): Promise<Datei[]> {
    return dateienAus(await p.lesen(`/files/person/${personId}`));
  }

  async function aktualisiereListe(p: AblagePort): Promise<void> {
    liste = await listeVon(p, await p.meineId());
  }

  async function dateien(p: AblagePort): Promise<Datei[]> {
    if (liste === null) await aktualisiereListe(p);
    return liste ?? [];
  }

  /**
   * Eine Datei ersetzen: hochladen → Liste neu lesen → die neue Fassung muss da sein → alte löschen.
   * Scheitert das Löschen einer alten Fassung vorübergehend, bleibt sie liegen – die neuere gewinnt.
   */
  async function ersetze(p: AblagePort, name: string, bytes: Uint8Array, typ: string) {
    const alt = fassungen(name, await dateien(p)).map((f) => f.id);
    await p.hochladen(await p.meineId(), name, bytes, typ);
    await aktualisiereListe(p);
    const neu = fassungen(name, liste ?? []).filter((f) => !alt.includes(f.id));
    if (neu.length === 0) {
      throw p.fehler(
        502,
        'ChurchTools hat das Speichern bestätigt, die Datei ist aber nicht da. Es wurde nichts gelöscht.',
      );
    }
    for (const id of alt) {
      try {
        await p.loeschen(id);
        liste = (liste ?? []).filter((f) => f.id !== id);
      } catch (e) {
        if (p.istKeinRecht(e)) throw e;
        // Vorübergehend: Die alte Fassung bleibt liegen; beim Lesen gewinnt die neuere.
      }
    }
  }

  /** Alle Fassungen einer Datei löschen. Wirft, wenn eine stehen bleibt – sonst käme sie zurück. */
  async function loescheAlle(p: AblagePort, name: string): Promise<void> {
    for (const f of fassungen(name, await dateien(p))) {
      try {
        await p.loeschen(f.id);
      } catch (e) {
        if (!p.istNichtGefunden(e)) throw e; // schon weg = erledigt
      }
      liste = (liste ?? []).filter((x) => x.id !== f.id);
    }
  }

  /** Die neueste Fassung jeder Zeichnung dieser Lieder (Schlüssel → PNG-DataURL). */
  async function ladeBilder(
    p: AblagePort,
    l: Datei[],
    songIds: Set<number>,
  ): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [key, f] of neuesteBilder(l, songIds)) {
      let inhalt = bildInhalt.get(f.id);
      if (inhalt === undefined) inhalt = dataUrlAusBytes(await p.datei(f.fileUrl));
      // Nach hinten (zuletzt gebraucht); bei Überlauf fällt das am längsten ungenutzte heraus.
      bildInhalt.delete(f.id);
      bildInhalt.set(f.id, inhalt);
      if (opts.maxBilder !== undefined && bildInhalt.size > opts.maxBilder) {
        const aeltestes = bildInhalt.keys().next().value;
        if (aeltestes !== undefined) bildInhalt.delete(aeltestes);
      }
      out[key] = inhalt;
    }
    return out;
  }

  /**
   * Der zusammengeführte Stand aller vorhandenen Fassungen der Daten-Datei.
   *
   * Eine Fassung, die sich nicht laden lässt, **wirft** – sie als leer zu behandeln hieße, beim nächsten
   * Schreiben einen Stand ohne ihre Felder hochzuladen und sie danach zu löschen (#273: nur „nicht
   * vorhanden" ist leer). Eine Fassung, die nicht als Daten-Datei zu erkennen ist, bleibt außen vor:
   * Das ist keine von uns.
   */
  async function ladeDaten(p: AblagePort, l: Datei[]): Promise<DatenDatei> {
    let stand = leer();
    for (const f of fassungen(DATEN_NAME, l)) {
      let inhalt = datenInhalt.get(f.id);
      if (inhalt === undefined) {
        const text = new TextDecoder().decode(await p.datei(f.fileUrl));
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
   * Die Liste wird vorher NICHT neu geholt: Hat ein anderes Gerät inzwischen eine Fassung abgelegt,
   * steht sie nach dem Hochladen als „neu" in der Liste und wird nicht gelöscht; der nächste Leser
   * führt beide zusammen.
   */
  async function schreibeFelder(
    p: AblagePort,
    aenderungen: Record<string, unknown>,
    jetzt = Date.now(),
  ): Promise<void> {
    const stand = await ladeDaten(p, await dateien(p));
    for (const [k, w] of Object.entries(aenderungen)) stand.felder[k] = { w: w ?? null, t: jetzt };
    for (const [k, f] of Object.entries(stand.felder)) {
      if (f.w === null && jetzt - f.t > GRABSTEIN_MAX_ALTER_MS) delete stand.felder[k];
    }
    await ersetze(
      p,
      DATEN_NAME,
      new TextEncoder().encode(JSON.stringify(stand)),
      'application/json',
    );
  }

  /** Anmerkungen dieser Lieder aus einer Dateiliste – der eigenen oder der einer teilenden Person. */
  async function anmerkungenAus(
    p: AblagePort,
    l: Datei[],
    songIds: number[],
  ): Promise<Record<string, PageAnnotation>> {
    const ids = new Set(songIds);
    const bilder = await ladeBilder(p, l, ids);
    const daten = await ladeDaten(p, l);
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

  async function gesehenLesen(p: AblagePort, jetzt: number) {
    await aktualisiereListe(p);
    const daten = await ladeDaten(p, liste ?? []);
    const out: Record<number, GesehenerStand> = {};
    for (const [name, f] of Object.entries(daten.felder)) {
      const m = name.match(/^gesehen:(\d+)$/);
      if (!m || !f.w) continue;
      const stand = f.w as GesehenerStand;
      if (jetzt - stand.seenAt <= GESEHEN_MAX_ALTER_MS) out[Number(m[1])] = stand;
    }
    return out;
  }

  return {
    /**
     * **Den Altbestand der Server-App übernehmen** – nur, was in ChurchTools noch fehlt (ChurchTools
     * gewinnt je Seite, je Einstellung). Bilder einzeln mit `pause` dazwischen – ein Massenlauf hat
     * ChurchTools schon einmal ausgebremst (#300); die Felder in EINEM Schreibvorgang. Wirft bei jedem
     * Fehler; ein zweiter Lauf macht da weiter, wo der erste aufgehört hat (was hochgeladen ist, fehlt
     * dann nicht mehr).
     */
    uebernimmAltbestand(
      p: AblagePort,
      alt: Altbestand,
      pause: () => Promise<void> = () => Promise.resolve(),
    ): Promise<UmzugBericht> {
      return nacheinander(async () => {
        await aktualisiereListe(p);
        const { bilder, felder } = fehlendes(alt, liste ?? [], await ladeDaten(p, liste ?? []));
        for (const [key, strokes] of bilder) {
          const { bytes, typ } = bytesAusDataUrl(strokes);
          await ersetze(p, bildName(key), bytes, typ);
          await pause();
        }
        if (Object.keys(felder).length > 0) await schreibeFelder(p, felder);
        return { bilder: bilder.length, felder: Object.keys(felder).length };
      });
    },

    /** Was vom Altbestand in ChurchTools noch fehlt – frisch gelesen. `0/0` = Umzug vollständig. */
    pruefeAltbestand(p: AblagePort, alt: Altbestand): Promise<UmzugBericht> {
      return nacheinander(async () => {
        await aktualisiereListe(p);
        const { bilder, felder } = fehlendes(alt, liste ?? [], await ladeDaten(p, liste ?? []));
        return { bilder: bilder.length, felder: Object.keys(felder).length };
      });
    },

    /** Nur für Tests: alles vergessen. */
    zuruecksetzen(): void {
      liste = null;
      bildInhalt.clear();
      datenInhalt.clear();
      kette = Promise.resolve();
    },

    /** Die Dateiliste der eigenen Person neu lesen. */
    aktualisiereListe: (p: AblagePort) => nacheinander(() => aktualisiereListe(p)),

    /** Wie `GET /api/annotations?songs=…`: alle eigenen Anmerkungen dieser Lieder. */
    holeAnmerkungen(p: AblagePort, songIds: number[]): Promise<Record<string, PageAnnotation>> {
      return nacheinander(async () => {
        await aktualisiereListe(p);
        return anmerkungenAus(p, liste ?? [], songIds);
      });
    },

    /** Wie `PUT /api/annotations/<key>`: nur die übergebenen Felder ändern. */
    schreibeAnmerkung(p: AblagePort, key: string, teil: PageAnnotation): Promise<void> {
      return nacheinander(async () => {
        if ('strokes' in teil) {
          if (teil.strokes) {
            const { bytes, typ } = bytesAusDataUrl(teil.strokes);
            await ersetze(p, bildName(key), bytes, typ);
          } else await loescheAlle(p, bildName(key));
        }
        const felder: Record<string, unknown> = {};
        if ('texts' in teil) felder[textFeld(key)] = teil.texts?.length ? teil.texts : null;
        if ('zoom' in teil) felder[zoomFeld(key)] = teil.zoom ?? null;
        if (Object.keys(felder).length > 0) await schreibeFelder(p, felder);
      });
    },

    /** Wie `GET /api/settings?songs=…`. */
    holeEinstellungen(p: AblagePort, songIds: number[]): Promise<Record<string, string>> {
      return nacheinander(async () => {
        await aktualisiereListe(p);
        return liedEinstellungenAus(await ladeDaten(p, liste ?? []), songIds);
      });
    },

    /** Wie `PUT /api/settings`: mehrere setzen/entfernen (`null`/`''` entfernt). */
    schreibeEinstellungen(p: AblagePort, eintraege: Record<string, string | null>): Promise<void> {
      return nacheinander(async () => {
        const felder: Record<string, unknown> = {};
        for (const [key, wert] of Object.entries(eintraege)) {
          if (!SETTINGS_KEY_RE.test(key)) continue;
          // Leer heißt entfernen, Werte gekappt (`SETTINGS_MAX_WERT`).
          felder[einstFeld(key)] =
            wert === null || wert === '' ? null : String(wert).slice(0, SETTINGS_MAX_WERT);
        }
        if (Object.keys(felder).length > 0) await schreibeFelder(p, felder);
      });
    },

    /** Gemerkte Stände „gesehen" (#143, Termin-ID → Stand), ohne zu alte. */
    holeGesehen(p: AblagePort, jetzt = Date.now()): Promise<Record<number, GesehenerStand>> {
      return nacheinander(() => gesehenLesen(p, jetzt));
    },

    /** Einen Stand als gesehen merken – und zu alte dabei aufräumen. */
    merkeGesehen(
      p: AblagePort,
      eventId: number,
      stand: Omit<GesehenerStand, 'seenAt'>,
      jetzt = Date.now(),
    ): Promise<void> {
      return nacheinander(async () => {
        const daten = await ladeDaten(p, await dateien(p));
        const felder: Record<string, unknown> = {
          [gesehenFeld(eventId)]: { ...stand, seenAt: jetzt },
        };
        for (const [name, f] of Object.entries(daten.felder)) {
          if (!name.startsWith('gesehen:') || !f.w) continue;
          if (jetzt - (f.w as GesehenerStand).seenAt > GESEHEN_MAX_ALTER_MS) felder[name] = null;
        }
        await schreibeFelder(p, felder, jetzt);
      });
    },

    /** Teilt die eigene Person ihre Anmerkungen? Ohne Eintrag: nein. */
    holeTeilen(p: AblagePort): Promise<boolean> {
      return nacheinander(async () => {
        await aktualisiereListe(p);
        return teilenAus(await ladeDaten(p, liste ?? []))?.an === true;
      });
    },

    /** Das eigene Teilen ein- oder ausschalten – mit dem Namen, unter dem andere die Notizen sehen. */
    schreibeTeilen(p: AblagePort, an: boolean, name: string): Promise<void> {
      return nacheinander(() => schreibeFelder(p, { [TEILEN_FELD]: { an, name } }));
    },

    /**
     * Die Ablage einer anderen Person – **nur, wenn sie laut ihrer eigenen Datei teilt**, sonst `null`.
     * Lesen dürfen das Mitglieder, die die Person sehen dürfen (gemessen, Plan §2b).
     */
    async geteilteAblage(p: AblagePort, personId: number): Promise<GeteilteAblage | null> {
      const l = await listeVon(p, personId);
      const daten = await ladeDaten(p, l);
      const teilen = teilenAus(daten);
      if (!teilen?.an) return null;
      return { personId, name: teilen.name, liste: l, daten };
    },

    /** Die geteilten Anmerkungen dieser Lieder – **ohne Zoom** (der ist persönlich). */
    async geteilteAnmerkungen(
      p: AblagePort,
      a: GeteilteAblage,
      songIds: number[],
    ): Promise<Record<string, { strokes: string | null; texts: AnnotationText[] }>> {
      const out: Record<string, { strokes: string | null; texts: AnnotationText[] }> = {};
      for (const [key, seite] of Object.entries(await anmerkungenAus(p, a.liste, songIds))) {
        const strokes = seite.strokes ?? null;
        const texts = seite.texts ?? [];
        if (!strokes && texts.length === 0) continue;
        out[key] = { strokes, texts };
      }
      return out;
    },
  };
}

export type PersonenAblage = ReturnType<typeof erstellePersonenAblage>;
