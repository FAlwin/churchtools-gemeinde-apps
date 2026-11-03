/**
 * **Die Dateien am Termin** – die Büroklammer in der Dienstplan-Liste von ChurchTools (Idee Alwin 02.11.2026, Entwurf
 * `termin-einstellungen.html` Variante B, Scheibe T2a). Gemessen 02.11.2026 (`dienstplaner-planung/docs/
 * messung-termin-einstellungen.md`, Nachmessung T2):
 *  - Die **Terminliste** (`GET /events…`) trägt je Termin `eventFiles` – ohne Zusatzanfrage. Je Eintrag `title`,
 *    `domainType` (`file` oder `link`), `domainIdentifier` (die Datei-ID als Text) und `frontendUrl` (Download-Adresse
 *    bzw. der Link). **Ohne Größe.**
 *  - Ausführlich `GET /files/service/{id}`: `id`, `name`, `type` (`file`/`link`), `fileUrl`, **`size`** (Bytes, bei
 *    Links `null`).
 *  - Dateien öffnen sich über die Sitzung der Seite (ohne Anmeldung 401) – in der Erweiterung also einfach als Link.
 *  - **Ändern (T2b):** Hochladen `POST /files/service/{id}` (`files[]`, höchstens 128 MiB je Anfrage, 413 erst nach
 *    dem Hochladen), Link `POST …/link` `{name, url}` (nur `http(s)`, höchstens 255), Umbenennen `PATCH /files/{id}`
 *    (Name 1–255), Löschen `DELETE /files/{id}` (schon weg → 404). Recht wie bei den Infos (`darfTerminAendern`).
 */
import { pruefeHochladen } from '../dateien/index';
import { neuerDateiname, safeFileName } from './arrangementFiles';
import type { SchreibAuftrag } from './schreibKern';

export interface TerminDatei {
  id: number;
  name: string;
  art: 'datei' | 'link';
  /** Download-Adresse (Datei) bzw. das Ziel (Link) – geöffnet nur über `dateiAdresse`. */
  url: string;
  /** Bytes; `null` = unbekannt (die Terminliste liefert keine Größe, Links haben keine). */
  groesse: number | null;
  /**
   * Wann und von wem angehängt – nur aus der ausführlichen Liste (`meta.createdDate`, `meta.createdPerson.title`), für
   * das kleine Fenster einer Datei (wie in ChurchTools: „03.11.2026 11:05 (Alwin Friesen)“). Fehlt in der Terminliste.
   */
  angelegt?: { am: string; von: string | null };
}

const zahl = (x: unknown): number | null => {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

const text = (x: unknown): string => (typeof x === 'string' ? x : '');

/** Größe in Bytes – als Zahl oder Text (wie bei den Arrangement-Dateien, `groesseVon`), sonst unbekannt. */
const bytes = (x: unknown): number | null => {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Die Dateien aus der Terminliste (`eventFiles`). **Ohne ID oder Adresse kein Eintrag** – eine Zeile, die sich weder
 * öffnen noch (T2b) löschen lässt, wäre schlimmer als keine.
 */
export function dateienAus(termin: { eventFiles?: unknown } | null | undefined): TerminDatei[] {
  const roh = termin?.eventFiles;
  if (!Array.isArray(roh)) return [];
  const aus: TerminDatei[] = [];
  for (const e of roh as Record<string, unknown>[]) {
    const id = zahl(e?.domainIdentifier);
    const url = text(e?.frontendUrl);
    if (id === null || !url) continue;
    aus.push({
      id,
      name: text(e.title) || url,
      art: e.domainType === 'link' ? 'link' : 'datei',
      url,
      groesse: null,
    });
  }
  return aus;
}

/** Die Dateien aus der ausführlichen Liste (`GET /files/service/{id}`, `data[]`) – mit Größe. */
export function dateienAusListe(roh: unknown): TerminDatei[] {
  if (!Array.isArray(roh)) return [];
  const aus: TerminDatei[] = [];
  for (const f of roh as Record<string, unknown>[]) {
    const id = zahl(f?.id);
    const url = text(f?.fileUrl);
    if (id === null || !url) continue;
    const art = f.type === 'link' ? 'link' : 'datei';
    const meta = f.meta as
      | { createdDate?: unknown; createdPerson?: { title?: unknown } }
      | undefined;
    const am = text(meta?.createdDate);
    aus.push({
      id,
      name: text(f.name) || url,
      art,
      url,
      groesse: art === 'link' ? null : bytes(f.size),
      ...(am ? { angelegt: { am, von: text(meta?.createdPerson?.title) || null } } : {}),
    });
  }
  return aus;
}

/**
 * **Wohin ein Tipp auf die Datei führt – oder `null`, wenn nirgendwohin.** Eine Datei nur in der eigenen Instanz (die
 * Sitzung soll an keinen fremden Host gehen, wie `ctDatei`), ein Link nur mit `http(s)`. ChurchTools prüft Links beim
 * Anlegen selbst (`javascript:` → 400, gemessen) – hier noch einmal, weil die Adresse aus ChurchTools-DATEN kommt und
 * ältere Einträge anders entstanden sein können.
 */
export function dateiAdresse(d: TerminDatei, basis: string): string | null {
  if (d.art === 'datei') return d.url.startsWith(`${basis}/`) ? d.url : null;
  try {
    const u = new URL(d.url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Woran man eine Liste wiedererkennt – ändert sich, wenn eine Datei dazukommt, wegfällt oder umbenannt wird. */
export function dateienSchluessel(dateien: readonly TerminDatei[]): string {
  return dateien.map((d) => `${d.id}:${d.name}`).join('|');
}

// ── Ändern (Scheibe T2b) ─────────────────────────────────────────────────────

/**
 * **Höchstens 128 MiB je Datei** – gemessen 02.11.2026: 128 MiB − 4 KB → 200, + 4 KB → 413 vom Webserver vor
 * ChurchTools, und zwar erst NACH dem kompletten Hochladen. Deshalb vorher prüfen, je Datei eine Anfrage.
 */
export const DATEI_MAX_BYTES = 128 * 1024 * 1024;
export const DATEI_MAX_TEXT = '128 MB';
/** Name und Link-Adresse: 1 bis 255 Zeichen (gemessen: leer und 300 → 400). */
export const DATEI_NAME_MAX = 255;

export const DATEIEN_VERWEIGERT =
  'ChurchTools erlaubt dir nicht, die Dateien dieses Termins zu ändern.';
export const DATEI_NICHT_ANGEKOMMEN =
  'ChurchTools hat die Datei nicht übernommen. Bitte noch einmal versuchen.';

/** Der Anschluss: frisch lesen, hochladen (mit Fortschritt), schreiben – Fehler in der Klasse des Aufrufers. */
export interface TerminDateienPort {
  /** `GET /files/service/{id}` – **frisch**, nie aus einem Cache. */
  liste(eventId: number): Promise<TerminDatei[]>;
  /** `POST /files/service/{id}` mit `files[]` – genau EINE Datei je Anfrage. `anteil` 0…1. */
  hochladen(
    eventId: number,
    datei: { name: string; inhalt: Blob },
    fortschritt: (anteil: number) => void,
  ): Promise<unknown>;
  schreibe(pfad: string, auftrag: SchreibAuftrag): Promise<unknown>;
  fehler(status: number, meldung: string): Error;
}

/** Was vor dem Hochladen zu sagen ist – dieselbe Regel wie in der Musik-App, mit der Grenze von ChurchTools. */
export function pruefeTerminDatei(
  datei: { name: string; size: number },
  vorhandene: readonly TerminDatei[],
): { art: 'fehler' | 'warnung'; text: string } | null {
  return pruefeHochladen(
    { name: safeFileName(datei.name), size: datei.size },
    vorhandene.filter((d) => d.art === 'datei').map((d) => d.name),
    { bytes: DATEI_MAX_BYTES, text: DATEI_MAX_TEXT },
  );
}

/**
 * Schreiben und **nachlesen** – erst der neu gelesene Stand zählt (ein Erfolgssignal ist kein Beleg). Scheitert das
 * Schreiben, wird trotzdem nachgelesen: Bei einer Zeitüberschreitung oder einem Netzfehler kann ChurchTools die Datei
 * längst haben – „fehlgeschlagen“ zu melden hieße, zum zweiten Hochladen einzuladen. Lässt sich auch nicht nachlesen,
 * gilt der ursprüngliche Fehler.
 */
async function schreibenUndNachlesen(
  port: TerminDateienPort,
  eventId: number,
  schreiben: () => Promise<unknown>,
  geschafft: (nachher: TerminDatei[]) => boolean,
): Promise<TerminDatei[]> {
  try {
    await schreiben();
  } catch (e) {
    let nachher: TerminDatei[];
    try {
      nachher = await port.liste(eventId);
    } catch {
      throw e;
    }
    if (geschafft(nachher)) return nachher;
    throw e;
  }
  const nachher = await port.liste(eventId);
  if (!geschafft(nachher)) throw port.fehler(502, DATEI_NICHT_ANGEKOMMEN);
  return nachher;
}

/** Eine neue Datei/ein neuer Link: nachher da, vorher nicht. */
const neuDa =
  (vorher: readonly TerminDatei[], passt: (d: TerminDatei) => boolean) =>
  (nachher: TerminDatei[]): boolean => {
    const alt = new Set(vorher.map((d) => d.id));
    return nachher.some((d) => !alt.has(d.id) && passt(d));
  };

/**
 * **Eine Datei hochladen** und die frische Liste liefern. Vorher geprüft (leer, zu groß – gemessen 413 erst nach dem
 * Hochladen) und frisch gelesen, damit „neu“ sicher erkennbar ist; der Name wie in der Musik-App gereinigt.
 */
export async function dateiHochladen(
  port: TerminDateienPort,
  eventId: number,
  datei: { name: string; size: number; inhalt: Blob },
  fortschritt: (anteil: number) => void = () => {},
): Promise<TerminDatei[]> {
  const name = safeFileName(datei.name);
  if (!name) throw port.fehler(400, 'Die Datei hat keinen Namen.');
  const pruefung = pruefeTerminDatei({ name, size: datei.size }, []);
  if (pruefung?.art === 'fehler') throw port.fehler(400, pruefung.text);
  const vorher = await port.liste(eventId);
  return schreibenUndNachlesen(
    port,
    eventId,
    () => port.hochladen(eventId, { name, inhalt: datei.inhalt }, fortschritt),
    neuDa(vorher, (d) => d.art === 'datei' && d.name === name),
  );
}

/** Eine Link-Adresse, die ChurchTools annimmt (gemessen: nur mit `http(s)://`, höchstens 255 Zeichen) – oder `null`. */
export function linkAdresse(eingabe: string): string | null {
  const roh = eingabe.trim();
  if (!roh || roh.length > DATEI_NAME_MAX) return null;
  try {
    const u = new URL(roh);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.host ? roh : null;
  } catch {
    return null;
  }
}

/** **Einen Link anhängen** – ohne Namen nimmt ChurchTools die Adresse als Namen (gemessen), hier genauso. */
export async function linkAnhaengen(
  port: TerminDateienPort,
  eventId: number,
  eingabe: { name: string; url: string },
): Promise<TerminDatei[]> {
  const url = linkAdresse(eingabe.url);
  if (!url) throw port.fehler(400, 'Bitte eine vollständige Adresse angeben, z. B. https://…');
  const name = eingabe.name.trim() || url;
  if (name.length > DATEI_NAME_MAX) throw port.fehler(400, 'Der Name ist zu lang.');
  const vorher = await port.liste(eventId);
  return schreibenUndNachlesen(
    port,
    eventId,
    () =>
      port.schreibe(`/files/service/${eventId}/link`, {
        method: 'POST',
        json: { name, url },
        verweigert: DATEIEN_VERWEIGERT,
        fehler: 'Link anhängen fehlgeschlagen',
      }),
    neuDa(vorher, (d) => d.art === 'link' && d.url === url),
  );
}

/**
 * Der neue Name aus der Eingabe – oder warum nicht. Bei einer Datei bleibt die Endung (dieselbe Regel wie in der
 * Musik-App, `neuerDateiname`); ein Link hat keine.
 */
export function neuerName(
  datei: TerminDatei,
  eingabe: string,
): { name: string; fehler: null } | { name: null; fehler: string } {
  if (datei.art === 'datei') return neuerDateiname(datei.name, eingabe);
  const name = eingabe.trim();
  if (!name) return { name: null, fehler: 'Bitte einen Namen angeben.' };
  if (name.length > DATEI_NAME_MAX) return { name: null, fehler: 'Der Name ist zu lang.' };
  return { name, fehler: null };
}

/** **Umbenennen** (`PATCH /files/{id}`) – nur eine Datei dieses Termins, kein gleicher Name daneben. */
export async function dateiUmbenennen(
  port: TerminDateienPort,
  eventId: number,
  fileId: number,
  eingabe: string,
): Promise<TerminDatei[]> {
  const vorher = await port.liste(eventId);
  const datei = vorher.find((d) => d.id === fileId);
  if (!datei) throw port.fehler(404, 'Die Datei gibt es an diesem Termin nicht mehr.');
  const neu = neuerName(datei, eingabe);
  if (neu.fehler !== null) throw port.fehler(400, neu.fehler);
  if (neu.name === datei.name) return vorher;
  if (vorher.some((d) => d.id !== fileId && d.name === neu.name)) {
    throw port.fehler(409, `Es gibt hier schon „${neu.name}“.`);
  }
  return schreibenUndNachlesen(
    port,
    eventId,
    () =>
      port.schreibe(`/files/${fileId}`, {
        method: 'PATCH',
        json: { name: neu.name },
        verweigert: DATEIEN_VERWEIGERT,
        fehler: 'Umbenennen fehlgeschlagen',
      }),
    (nachher) => nachher.find((d) => d.id === fileId)?.name === neu.name,
  );
}

/** **Löschen** (`DELETE /files/{id}`) – nur eine Datei dieses Termins; schon weg ist kein Fehler (gemessen: 404). */
export async function dateiLoeschen(
  port: TerminDateienPort,
  eventId: number,
  fileId: number,
): Promise<TerminDatei[]> {
  const vorher = await port.liste(eventId);
  if (!vorher.some((d) => d.id === fileId)) return vorher;
  return schreibenUndNachlesen(
    port,
    eventId,
    () =>
      port.schreibe(`/files/${fileId}`, {
        method: 'DELETE',
        verweigert: DATEIEN_VERWEIGERT,
        fehler: 'Löschen fehlgeschlagen',
        okBei404: true,
      }),
    (nachher) => !nachher.some((d) => d.id === fileId),
  );
}
