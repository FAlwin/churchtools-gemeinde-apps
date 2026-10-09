/**
 * Die schreibenden ChurchTools-Operationen (#280).
 *
 * Alles hier ändert Daten in ChurchTools. Zwei Regeln gelten durchgehend:
 *  - **Jeder Schreibvorgang holt zuerst ein CSRF-Token** und meldet eine Ablehnung über
 *    `csrfWriteDenied` – die eine Stelle, die den Fehler meldet UND das Token verwirft. Wäre das je
 *    Funktion einzeln eingebaut, hätte genau eine davon gefehlt (#298).
 *  - **Kein Schreibvorgang wird automatisch wiederholt.** Nicht alle sind idempotent.
 */
import type { HochzuladendeDatei } from '@shared/ct/notenblaetter';
import { HttpError } from '../middleware/errorHandler.js';
import {
  ablaufAbschliessen,
  ablaufUmsortieren,
  punktAendern,
  punktAnlegen,
  punktLoeschen,
  tempoSetzen,
  vorBeginnSetzen,
  type CtSchreiber,
  type NeuerPunkt,
  type PunktAenderung,
} from '@shared/ct/schreibKern';
import { csrfWriteDenied, getCsrfToken } from './ctCsrf.js';
import {
  BASE,
  CT_FILE_TIMEOUT_MS,
  CtOverloadedError,
  ctSignal,
  parseRetryAfter,
} from './ctHttp.js';
import { getAgenda, getSong } from './ctRead.js';

/**
 * Der Schreibvorgang selbst – **einmal, für alle sieben** (#280).
 *
 * Jede Schreibfunktion hatte dieses Ritual vorher wortgleich stehen: Token holen, als `CSRF-Token`
 * mitschicken, bei 401/403 über `csrfWriteDenied` melden (das den Fehler wirft UND das Token
 * verwirft), sonst 502. Sieben Kopien einer Regel – und der Kommentar an `csrfWriteDenied` sagte
 * bereits, warum das gefährlich ist: „Wäre die Invalidierung an den Stellen einzeln eingebaut, hätte
 * genau eine davon gefehlt."
 *
 * Jetzt kann sie niemand mehr vergessen: Wer eine achte Schreiboperation ergänzt, bekommt Token,
 * Kopfzeile und Ablehnungs-Behandlung, ohne daran zu denken.
 *
 * Bewusst NICHT hier: ein Wiederholversuch. Schreibvorgänge sind nicht alle idempotent – ein
 * Datei-Upload liefe doppelt. Wiederholt wird nur das Token-Holen (#294), und das steckt in
 * `getCsrfToken`.
 */
async function schreibe(
  cookie: string,
  pfad: string,
  opts: {
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** JSON-Rumpf; schließt `form` aus. */
    json?: unknown;
    /** Datei-Upload; schließt `json` aus und bekommt die längere Zeitgrenze. */
    form?: FormData;
    /** Meldung bei 401/403. */
    verweigert: string;
    /** Meldung bei jedem anderen Fehlschlag – erhält den Statuscode angehängt. */
    fehler: string;
    /** Für Löschvorgänge: „schon weg" ist kein Fehler. */
    okBei404?: boolean;
  },
): Promise<Response> {
  const csrf = await getCsrfToken(cookie);
  const headers: Record<string, string> = { Cookie: cookie, 'CSRF-Token': csrf };
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${pfad}`, {
    // Datei-Uploads dürfen länger dauern als ein API-Aufruf.
    signal: ctSignal(opts.form ? CT_FILE_TIMEOUT_MS : undefined),
    method: opts.method,
    headers,
    body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
  });

  if (res.status === 401 || res.status === 403) csrfWriteDenied(cookie, opts.verweigert);
  /**
   * **429 ist eine Drosselung, kein Serverfehler** – die DRITTE Stelle dieser Regel (13.08.2026).
   *
   * `ctGet` unterscheidet das seit #300, der Datei-Download seit demselben Tag – hier fehlte es noch.
   * Folge: Bremste ChurchTools einen Schreibvorgang aus (Lied anlegen, Datei hochladen, Tempo
   * speichern), meldete die App „fehlgeschlagen (429)" statt „ChurchTools bremst uns gerade aus, bitte
   * einen Moment warten". Für den Nutzer sind das zwei verschiedene Dinge: Das eine klingt nach einem
   * Fehler, den er nicht lösen kann, das andere nach „gleich nochmal".
   *
   * Gefunden bei der Dopplungs-Suche im `/festhalten` – genau dafür ist sie da: Dieselbe Regel stand an
   * drei Stellen, und zwei waren korrigiert.
   */
  if (res.status === 429) {
    throw new CtOverloadedError(parseRetryAfter(res.headers.get('retry-after')));
  }
  if (!res.ok && !(opts.okBei404 && res.status === 404)) {
    throw new HttpError(502, `${opts.fehler} (${res.status}).`);
  }
  /**
   * **Die Antwort wird zurückgegeben, nicht verworfen** (#322, Schritt 10).
   *
   * Bis hierher hat kein Schreibvorgang etwas von ChurchTools zurückgebraucht. Beim Anlegen eines
   * Liedes ist das anders: Die Antwort enthält die **ID des neuen Datensatzes**, und ohne sie
   * müsste die App das eben angelegte Lied über seinen Namen wiedersuchen.
   *
   * Der Rumpf wird hier bewusst **nicht** gelesen – ein `res.json()` an dieser Stelle würde bei den
   * Antworten ohne Inhalt (204 beim Löschen) werfen und alle bisherigen Aufrufer treffen. Wer die
   * Antwort braucht, liest sie selbst (`neueId`); alle anderen ignorieren den Rückgabewert wie
   * bisher.
   */
  return res;
}

/**
 * Die ID des eben angelegten Datensatzes aus der Antwort – oder ein Fehler.
 *
 * **Warum das eine eigene Funktion mit Wurf ist:** Ein `201` bedeutet nicht, dass wir wissen, WAS
 * entstanden ist. Ohne ID kann die App das neue Lied weder öffnen noch ein Arrangement daranhängen –
 * sie stünde mit einem „hat geklappt" da, das ins Leere führt. Am 11.08.2026 hat genau diese Sorte
 * Annahme („success heißt, es ist etwas entstanden") zwei Notenblätter gekostet. Deshalb wird hier
 * nachgesehen, statt dem Statuscode zu glauben.
 *
 * Gemessen an der Test-Instanz (13.08.2026): `POST /api/songs` und `POST …/arrangements` antworten
 * beide `201` mit `{data: {id}}`.
 */
async function neueId(res: Response, was: string): Promise<number> {
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    throw new HttpError(502, `${was} wurde angelegt, aber ChurchTools nannte keine ID.`);
  }
  const id = (json as { data?: { id?: unknown } } | null)?.data?.id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new HttpError(502, `${was} wurde angelegt, aber ChurchTools nannte keine ID.`);
  }
  return id;
}

/**
 * Lädt EINE Datei an ein Arrangement hoch (#321).
 *
 * **Die einzige Stelle, die einen Datei-Upload zusammenbaut.** Vorher stand sie nur in
 * `uploadChordpro` und war dort auf ChordPro zugeschnitten (`text/plain` festverdrahtet). Für die
 * Dateiverwaltung braucht es beliebige Arten – und die Auflage aus #321 ist ausdrücklich, daraus
 * eine gemeinsame Funktion zu machen **statt einer zweiten Fassung daneben**. Genau diese
 * Fehlerklasse hat das Projekt am häufigsten getroffen; zuletzt am 11.08.2026 die Benennung einer
 * Anmerkungs-Ebene, die an drei Stellen stand.
 *
 * **ChurchTools ersetzt eine vorhandene Datei gleichen Namens NICHT** – sie liegt danach zweimal da.
 * Wer das nicht will, löscht die alte vorher; diese Funktion tut es nicht von sich aus, weil ein
 * ungefragtes Löschen fremder Dateien schlimmer wäre als ein Doppel.
 *
 * Kein Wiederholversuch: Ein Upload ist nicht idempotent (siehe `schreibe`).
 */
export async function uploadFile(
  cookie: string,
  arrangementId: number,
  datei: HochzuladendeDatei,
  meldungen: { verweigert: string; fehler: string } = {
    verweigert: 'Keine Berechtigung, Dateien in ChurchTools zu speichern.',
    fehler: 'Hochladen nach ChurchTools fehlgeschlagen',
  },
): Promise<void> {
  const form = new FormData();
  form.append('files[]', new Blob([datei.inhalt], { type: datei.mime }), datei.filename);
  await schreibe(cookie, `/api/files/song_arrangement/${arrangementId}`, {
    method: 'POST',
    form,
    verweigert: meldungen.verweigert,
    fehler: meldungen.fehler,
  });
}

/**
 * Eine Datei an die eigene Person hängen – die Personen-Ablage der Server-App (Ablage in ChurchTools,
 * 09.10.2026). Gemessen vom Server aus: ohne CSRF-Token 401, mit 200 – deshalb über `schreibe`.
 */
export async function uploadPersonFile(
  cookie: string,
  personId: number,
  name: string,
  inhalt: Uint8Array,
  typ: string,
): Promise<void> {
  const form = new FormData();
  // Kopie: `Blob` verlangt einen Puffer vom Typ ArrayBuffer (TypeScript 5.7).
  form.append('files[]', new Blob([new Uint8Array(inhalt)], { type: typ }), name);
  await schreibe(cookie, `/api/files/person/${personId}`, {
    method: 'POST',
    form,
    verweigert: 'ChurchTools erlaubt dir nicht, Dateien an deiner Person zu speichern.',
    fehler: 'Speichern in ChurchTools fehlgeschlagen',
  });
}

/** Eine Datei löschen (`DELETE /api/files/<id>`). Schon weg (404) ist erledigt, kein Fehler. */
export async function deleteFile(cookie: string, fileId: number): Promise<void> {
  await schreibe(cookie, `/api/files/${fileId}`, {
    method: 'DELETE',
    verweigert: 'ChurchTools erlaubt dir nicht, diese Datei zu löschen.',
    fehler: 'Löschen in ChurchTools fehlgeschlagen',
    okBei404: true,
  });
}

/** Der JSON-Rumpf einer Antwort – `null`, wenn sie leer oder kein JSON ist (204 beim Löschen). */
async function rumpfAus(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Der Schreiber des Servers für die geteilten Regeln in `@shared/ct` (#335, Phase 3b): frisch gelesen
 * über `ctRead`, geschrieben über `schreibe` (CSRF, Ablehnung, Drosselung). Den vollen Anschluss für
 * Lieder und Notenblätter baut `ctVerwalter.ts`.
 */
export function schreiberFuer(cookie: string): CtSchreiber {
  return {
    agenda: (eventId) => getAgenda(cookie, eventId),
    song: (songId) => getSong(cookie, songId),
    schreibe: async (pfad, auftrag) => rumpfAus(await schreibe(cookie, `/api${pfad}`, auftrag)),
    fehler: (status, meldung) => new HttpError(status, meldung),
  };
}

// Ablauf: die Regeln stehen seit #335 (Phase 3b) in `@shared/ct/schreibKern` – hier nur die Anbindung.

export function reorderAgenda(cookie: string, eventId: number, order: number[]): Promise<void> {
  return ablaufUmsortieren(schreiberFuer(cookie), eventId, order);
}

export function createAgendaItem(cookie: string, eventId: number, data: NeuerPunkt): Promise<void> {
  return punktAnlegen(schreiberFuer(cookie), eventId, data);
}

export function updateAgendaItem(
  cookie: string,
  eventId: number,
  itemId: number,
  fields: PunktAenderung,
): Promise<void> {
  return punktAendern(schreiberFuer(cookie), eventId, itemId, fields);
}

export function deleteAgendaItem(cookie: string, eventId: number, itemId: number): Promise<void> {
  return punktLoeschen(schreiberFuer(cookie), eventId, itemId);
}

export function setAgendaItemVorBeginn(
  cookie: string,
  eventId: number,
  itemId: number,
  vorBeginn: boolean,
): Promise<void> {
  return vorBeginnSetzen(schreiberFuer(cookie), eventId, itemId, vorBeginn);
}

/** Den Ablauf abschließen oder wieder öffnen (09.10.2026) – Regel in `@shared/ct/schreibKern`. */
export function setAblaufAbgeschlossen(
  cookie: string,
  eventId: number,
  abgeschlossen: boolean,
): Promise<void> {
  return ablaufAbschliessen(schreiberFuer(cookie), eventId, abgeschlossen);
}

/**
 * Setzt das Tempo eines Arrangements in ChurchTools – **der schmale Weg vom Blatt aus.**
 *
 * Er geht seit #396 durch denselben Lese-Schreib-Weg wie das Ändern eines Arrangements
 * (`arrangementAendern` in `@shared/ct/schreibKern`) und baut den Ablauf nicht mehr nach. Vorher standen
 * hier dieselben Zeilen ein zweites Mal: lesen, `arrangementWritePayload`, `PUT`. Zwei Fassungen
 * derselben Regel – und zwar der gefährlichsten des Projekts (`PUT` ersetzt den ganzen Datensatz,
 * ein unvollständiger Rumpf löscht Tonart und Dauer). Gefunden bei der Dopplungs-Suche zu #396.
 *
 * Der Endpunkt bleibt trotzdem eigen: Er wird vom Blatt angetippt, von jemandem, der nur das Tempo
 * meint – und seine Meldungen sagen genau das.
 */
export function updateArrangementTempo(
  cookie: string,
  songId: number,
  arrangementId: number,
  tempo: number,
): Promise<void> {
  return tempoSetzen(schreiberFuer(cookie), songId, arrangementId, tempo);
}

/**
 * **Die Tage einer Abwesenheit mit Uhrzeit als Zeitpunkte schicken** (24.09.2026).
 *
 * ChurchTools lehnt seit dem 24.09.2026 jeden Eintrag mit Uhrzeit ab, der die Tage als reines
 * Datum trägt: „'endDate' darf nicht vor 'startTime' liegen" – es liest `endDate: 2026-10-08` als
 * Mitternacht, und die liegt vor `startTime: 2026-10-08T09:00:00Z`. Am 22.09.2026 nahm dieselbe
 * Instanz genau diesen Aufruf noch mit 201 an, unter derselben Versionsnummer (3.136.2, Build
 * 32882). Gemessen an der Test-Instanz, mit dem unveränderten Probe-Skript vom 22.09.
 *
 * Angenommen werden die Tage als Zeitpunkte (`startDate` = `startTime`, `endDate` = `endTime`).
 * ChurchTools legt daraus selbst die Tage in deutscher Zeit an und liefert sie als `YYYY-MM-DD`
 * zurück – dieselben, die `absenceBody` rechnet. Ganztägige Einträge gehen unverändert hinaus.
 *
 * Hier und nicht in `absenceBody`: Der Rumpf dort ist zugleich die App-Sicht (Doppel-Erkennung,
 * Antwort an die App) und muss Tage enthalten. Nur das, was über die Leitung geht, ist anders.
 */
export function fuerChurchTools<
  T extends { startDate: string; endDate: string; startTime?: string; endTime?: string },
>(body: T): T {
  if (!body.startTime || !body.endTime) return body;
  return { ...body, startDate: body.startTime, endDate: body.endTime };
}

/**
 * Legt eine Abwesenheit an (#177). Der Rumpf kommt fertig aus `absences.ts` (Marker, Grund) – hier
 * nur der Schreibvorgang über `schreibe`, wie bei allen anderen. Antwort `201 {data:{id}}` wie beim
 * Lied-Anlegen; die ID wird gebraucht, damit die App den Eintrag ohne Neuladen zeigen kann.
 */
export async function createAbsence(
  cookie: string,
  personId: number,
  /**
   * `startTime`/`endTime` gehören dazu (23.09.2026): Zur Laufzeit gingen sie schon durch, der Typ
   * kannte sie nicht – ein späteres Umbauen an dieser Stelle hätte die Uhrzeit still verloren.
   */
  body: {
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    absenceReasonId: number;
    comment: string;
  },
): Promise<number> {
  const res = await schreibe(cookie, `/api/persons/${personId}/absences`, {
    method: 'POST',
    json: fuerChurchTools(body),
    verweigert: 'Keine Berechtigung, Abwesenheiten in ChurchTools einzutragen.',
    fehler: 'Abwesenheit eintragen fehlgeschlagen',
  });
  return neueId(res, 'Die Abwesenheit');
}

/** Löscht eine Abwesenheit (#177). Ob sie angefasst werden darf, prüft `absences.ts` vorher. */
export async function deleteAbsence(
  cookie: string,
  personId: number,
  absenceId: number,
): Promise<void> {
  await schreibe(cookie, `/api/persons/${personId}/absences/${absenceId}`, {
    method: 'DELETE',
    verweigert: 'Keine Berechtigung, Abwesenheiten in ChurchTools zu löschen.',
    fehler: 'Abwesenheit löschen fehlgeschlagen',
    okBei404: true, // schon weg ist auch weg
  });
}
