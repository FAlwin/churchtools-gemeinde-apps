/**
 * Die schreibenden Regeln für ChurchTools – **für beide Auslieferungen** (#335, Phase 3b).
 *
 * Bis Phase 3b standen sie im Server (`ctWrite.ts`, Teile im `setlistController`). Die
 * ChurchTools-Extension schreibt aus dem Browser und braucht **dieselben** Regeln: frisch lesen, den
 * Rumpf aus dem Ist-Zustand bauen, beim Umsortieren prüfen, dass es noch dieselben Punkte sind. Eine
 * zweite Fassung im Client wäre genau die Fehlerklasse, die dieses Projekt am meisten gekostet hat –
 * und hier ginge es um Daten des ganzen Teams.
 *
 * Wie beim Lesen (`setlistKern.ts`) steht hier **keine** Netzwerk-Technik. Der Aufrufer reicht einen
 * `CtSchreiber` herein: Der Server schreibt mit dem Cookie und seinem CSRF-Ritual (`ctWrite.schreibe`),
 * der Browser mit der Sitzung der Seite (`ctSchreiben.ts`, Bremse aus `ctRuntime`).
 *
 * Zwei Regeln gelten durchgehend und bleiben beim Schreiber:
 *  - **Gelesen wird frisch, nie aus einem Cache** – geschrieben wird auf diesem Stand.
 *  - **Kein Schreibvorgang wird automatisch wiederholt.** Nicht alle sind idempotent.
 */
import { agendaItemWritePayload, dienstgruppenNotizen, vorlaufUmschalten } from './agendaPayload';
import { arrangementWritePayload, type ArrangementOverrides } from './arrangementPayload';
import { isHeaderType } from './agendaFormat';
import { ablaufZeileAus, istWeggelassen, punktStand, type PunktStand } from './ablaufZeile';
import type { CtAblaufVorlage, CtAgenda, CtAgendaItem, CtArrangement, CtSong } from './typen';

/** Ein Schreibvorgang – Pfad ohne `/api`, wie beim `CtLeser`. */
export interface SchreibAuftrag {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-Rumpf. */
  json?: unknown;
  /** Meldung, wenn ChurchTools das Schreiben verweigert (fehlendes Recht). */
  verweigert: string;
  /** Meldung bei jedem anderen Fehlschlag – der Schreiber hängt den Statuscode an. */
  fehler: string;
  /** Für Löschvorgänge: „schon weg" ist kein Fehler. */
  okBei404?: boolean;
}

/** Was die Schreib-Regeln von ChurchTools brauchen – Server und Browser liefern es je auf ihre Art. */
export interface CtSchreiber {
  /** Der Ablauf eines Termins – **frisch**, nie aus einem Cache. */
  agenda(eventId: number): Promise<CtAgenda>;
  /** Ein Lied samt Arrangements – **frisch**, nie aus einem Cache. */
  song(songId: number): Promise<CtSong>;
  /** Eine Ablauf-Vorlage samt Punkten – **frisch** (`GET /agendatemplates/{id}`; E6-5b: zum Nachzählen). */
  vorlage(vorlageId: number): Promise<CtAblaufVorlage>;
  /**
   * Schreibt; wirft bei Ablehnung (`verweigert`), Drosselung oder Fehlschlag (`fehler`). Liefert den
   * JSON-Rumpf der Antwort (`null` bei leerer Antwort) – beim Anlegen steht darin die neue ID.
   */
  schreibe(pfad: string, auftrag: SchreibAuftrag): Promise<unknown>;
  /** Einen Fehler mit Status erzeugen – in der Fehlerklasse des Aufrufers. */
  fehler(status: number, meldung: string): Error;
}

/** Fehlermeldung, wenn ChurchTools das Ändern des Ablaufs verweigert – fünfmal derselbe Satz. */
export const ABLAUF_VERWEIGERT = 'Keine Berechtigung, den Ablauf in ChurchTools zu ändern.';

const ABLAUF_GEAENDERT = 'Der Ablauf hat sich geändert. Bitte neu laden und erneut versuchen.';

/**
 * Meldungen bei einem **echten Konflikt** (E6-3c, #659; entschieden mit Alwin 22.10.2026: nur dann, nicht bei jeder
 * Änderung am Ablauf). Status **412**: Die Oberfläche erkennt daran, dass sie neu lesen und – beim Punkt – fragen soll.
 */
export const PUNKT_GEAENDERT =
  'Dieser Punkt wurde eben woanders geändert. Der Ablauf ist neu geladen – deine Änderung steht noch hier.';
export const REIHENFOLGE_GEAENDERT =
  'Die Reihenfolge wurde eben woanders geändert. Der Ablauf ist neu geladen – bitte noch einmal ziehen.';

/**
 * Meldung, wenn der Ablauf in ChurchTools **abgeschlossen** ist (Alwin, 09.10.2026). ChurchTools antwortet
 * dann auf jedes Ändern mit 403 „nicht aktualisieren" – genau wie bei einem fehlenden Recht. Die App sagte
 * deshalb „Keine Berechtigung", und niemand kam darauf, dass nur der Abschluss im Weg stand.
 */
export const ABLAUF_ABGESCHLOSSEN =
  'Dieser Ablauf ist in ChurchTools abgeschlossen. Zum Ändern erst wieder öffnen.';

/** Wie `ABLAUF_VERWEIGERT`, nur für eine **Ablaufvorlage** (E10): dieselbe Mechanik, andere Meldung. */
export const VORLAGE_VERWEIGERT =
  'Keine Berechtigung, diese Ablaufvorlage in ChurchTools zu ändern.';

/** Wie `ABLAUF_ABGESCHLOSSEN`: Vorlagen lassen sich über die API nicht sperren oder entsperren (gemessen E10-0). */
export const VORLAGE_GESPERRT =
  'Diese Ablaufvorlage ist in ChurchTools gesperrt. Zum Ändern dort erst entsperren.';

/**
 * **Worauf ein Schreibvorgang am Ablauf zielt** (E10): eine Zahl = ein Termin (`/events/{id}/agenda`, so rufen alle
 * bisherigen Stellen auf), `{ vorlageId }` = eine Ablaufvorlage (`/agendatemplates/{id}`). Gemessen E10-0: Vorlagen
 * haben dieselben Regeln wie der Ablauf eines Termins – gleiche Punkte, gleiche Zurücksetz-Falle, dieselbe Grenze –,
 * nur andere Pfade und Meldungen. Deshalb **keine zweite Fassung** der Schreib-Regeln, sondern ein Ziel mit je EINEM
 * Helfer für Pfad, Lesen und Meldungen.
 */
export type AblaufZiel = number | { vorlageId: number };

/** Ist das Ziel eine Ablaufvorlage? */
export function istVorlage(ziel: AblaufZiel): ziel is { vorlageId: number } {
  return typeof ziel !== 'number';
}

/** Der Pfad des Ablaufs ohne `/api` – darunter liegen `items/…` und der Ablauf selbst (`PUT`). */
function ablaufBasis(ziel: AblaufZiel): string {
  return istVorlage(ziel) ? `/agendatemplates/${ziel.vorlageId}` : `/events/${ziel}/agenda`;
}

/** Die Meldung bei verweigertem Schreiben – je Ziel. */
function verweigertFuer(ziel: AblaufZiel): string {
  return istVorlage(ziel) ? VORLAGE_VERWEIGERT : ABLAUF_VERWEIGERT;
}

/**
 * Die Termin-ID für Regeln, die eine brauchen (`ablaufZeileAus`, `istWeggelassen`): Eine Vorlage hat keinen Termin und
 * keine Startzeiten, `0` trifft in `startTimes` nichts – nichts ist „weggelassen“, wie gewollt.
 */
function terminIdVon(ziel: AblaufZiel): number {
  return istVorlage(ziel) ? 0 : ziel;
}

/** Was `ablaufLesen` liefert: ein Ablauf, bei Vorlagen mit Namen (den braucht jedes `PUT` der Vorlage). */
type GelesenerAblauf = CtAgenda & { name?: string | null };

/** Eine Vorlage so lesen wie den Ablauf eines Termins – eine Stelle für die Umrechnung. */
function agendaAusVorlage(v: CtAblaufVorlage): GelesenerAblauf {
  return {
    ...v,
    items: v.items ?? [],
    calendarId: v.calendarId ?? undefined,
  };
}

/** Den Ablauf des Ziels **frisch** lesen – nie aus einem Cache (`s.agenda` bzw. `s.vorlage`). */
async function ablaufLesen(s: CtSchreiber, ziel: AblaufZiel): Promise<GelesenerAblauf> {
  return istVorlage(ziel) ? agendaAusVorlage(await s.vorlage(ziel.vorlageId)) : s.agenda(ziel);
}

/**
 * Die Felder, die jedes `PUT` des Ablaufs selbst mitbringen muss: beim Termin der Kalender, bei der Vorlage zusätzlich
 * der Name – ein `PUT` ohne ihn setzte ihn womöglich zurück (gemessen wurde nur: Name und Kalender gehören zum Aufruf).
 */
function ablaufKopf(ziel: AblaufZiel, a: GelesenerAblauf): Record<string, unknown> {
  return istVorlage(ziel)
    ? { name: a.name ?? '', calendarId: a.calendarId }
    : { calendarId: a.calendarId };
}

/**
 * Jeder Schreibvorgang am Ablauf geht hier durch: Verweigert ChurchTools, wird **am Ablauf nachgesehen**
 * (gemessen 09.10.2026: abgeschlossen → `isLocked: true`, Ändern/Löschen → 403). Ist er abgeschlossen,
 * kommt die richtige Meldung (423); sonst bleibt es bei „Keine Berechtigung". Lässt sich der Ablauf gerade
 * nicht lesen, bleibt der ursprüngliche Fehler – geraten wird nicht. Bei einer Vorlage (E10) dieselbe Mechanik
 * mit den Meldungen `VORLAGE_VERWEIGERT`/`VORLAGE_GESPERRT`; der Aufrufer reicht dann `VORLAGE_VERWEIGERT` als
 * `auftrag.verweigert` herein.
 */
export async function ablaufSchreibe(
  s: CtSchreiber,
  ziel: AblaufZiel,
  pfad: string,
  auftrag: SchreibAuftrag,
): Promise<unknown> {
  try {
    return await s.schreibe(pfad, auftrag);
  } catch (e) {
    if (!(e instanceof Error && e.message === verweigertFuer(ziel))) throw e;
    let abgeschlossen = false;
    try {
      abgeschlossen = (await ablaufLesen(s, ziel)).isLocked === true;
    } catch {
      throw e;
    }
    if (abgeschlossen) {
      throw s.fehler(423, istVorlage(ziel) ? VORLAGE_GESPERRT : ABLAUF_ABGESCHLOSSEN);
    }
    throw e;
  }
}

/**
 * Den Ablauf **abschließen** oder wieder **öffnen** (Alwin, 09.10.2026) – wie der Knopf in ChurchTools.
 * Gemessen an der Test-Instanz: `POST …/agenda/lock` bzw. `…/unlock` (204), danach `isLocked`/`isFinal`.
 * Ein `PUT …/agenda` mit `isLocked`/`isFinal` nimmt ChurchTools an (200), übernimmt es aber nicht. Wer
 * „Ablauf bearbeiten" nicht hat, bekommt 403. Teilen sich mehrere Termine einen Ablauf, gilt es für alle.
 */
export async function ablaufAbschliessen(
  s: CtSchreiber,
  eventId: number,
  abgeschlossen: boolean,
): Promise<void> {
  await s.schreibe(`/events/${eventId}/agenda/${abgeschlossen ? 'lock' : 'unlock'}`, {
    method: 'POST',
    json: {},
    verweigert: 'Keine Berechtigung, den Ablauf in ChurchTools abzuschließen oder zu öffnen.',
    fehler: abgeschlossen ? 'Ablauf abschließen fehlgeschlagen' : 'Ablauf öffnen fehlgeschlagen',
  });
}

/** Höchstlänge der Predigtserie – ChurchTools lehnt mehr mit 400 ab (gemessen 27.11.2026). */
export const SERIE_MAX = 100;

/** Die Predigtserie, wie ChurchTools sie speichert: Rand-Leerzeichen weg, leer = keine (`null`). */
export function serieAus(text: string | null | undefined): string | null {
  const t = (text ?? '').trim();
  return t === '' ? null : t;
}

/** Was an einer Predigtserie nicht stimmt – `null`, wenn sie passt (leer ist erlaubt: „keine Serie“). */
export function serieFehler(text: string): string | null {
  const t = serieAus(text);
  return t !== null && t.length > SERIE_MAX
    ? `Die Predigtserie darf höchstens ${SERIE_MAX} Zeichen lang sein.`
    : null;
}

/**
 * Die **Predigtserie** eines Termins setzen, ändern oder entfernen (`null`/leer). Gemessen 27.11.2026: `PUT …/agenda` mit
 * nur `{ series }` – **ohne** `items`, die ersetzten sonst die ganze Liste und überschrieben eine Änderung, die gerade
 * jemand anders macht; ohne `eventStartPosition`, die Grenze bleibt. Teilen sich mehrere Termine einen Ablauf, gilt die
 * Serie für alle. Abgeschlossen → 423 über `ablaufSchreibe`. Liefert den geschriebenen Wert.
 */
export async function serieSetzen(
  s: CtSchreiber,
  eventId: number,
  text: string | null,
): Promise<string | null> {
  const fehler = serieFehler(text ?? '');
  if (fehler) throw s.fehler(400, fehler);
  const series = serieAus(text);
  await ablaufSchreibe(s, eventId, ablaufBasis(eventId), {
    method: 'PUT',
    json: { series },
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Predigtserie speichern fehlgeschlagen',
  });
  return series;
}

/**
 * Ein bestimmtes Arrangement eines Lieds – oder 404 (#321). Die Suche stand zweimal da (Tempo und
 * Versionen); hier liegt sie, damit Server und Browser sie teilen. Das Lied dazu liest der Aufrufer
 * frisch (`CtSchreiber.song`) – geschrieben wird auf diesem Stand.
 */
export function arrangementAus(
  song: CtSong,
  arrangementId: number,
  fehler: (status: number, meldung: string) => Error,
  /** Die Liedverwaltung sagt es dem Nutzer deutlicher (3b-2: dieselbe Suche, eigene Meldung). */
  meldung = 'Arrangement nicht gefunden.',
): CtArrangement {
  const arrangement = song.arrangements.find((a) => a.id === arrangementId);
  if (!arrangement) throw fehler(404, meldung);
  return arrangement;
}

// ── Ablauf ───────────────────────────────────────────────────────────────────

/**
 * Schreibt die Reihenfolge des Ablaufs zurück: lädt die aktuellen Punkte frisch, sortiert sie nach
 * `orderedItemIds` und speichert die ganze Liste per `PUT /events/{id}/agenda` (Position =
 * Listenindex).
 */
export async function ablaufUmsortieren(
  s: CtSchreiber,
  ziel: AblaufZiel,
  orderedItemIds: number[],
  /** Die Reihenfolge vor dem Ziehen (E6-3c) – weicht die frische ab, hat jemand anderes umsortiert: 412. */
  gesehen?: readonly number[],
): Promise<void> {
  const agenda = await ablaufLesen(s, ziel);
  const { items } = agenda;
  const byId = new Map(items.map((i) => [i.id, i]));

  // Schutz: nur erlauben, wenn die übergebene Reihenfolge exakt dieselben Punkte enthält.
  const same = orderedItemIds.length === items.length && orderedItemIds.every((id) => byId.has(id));
  if (!same) throw s.fehler(409, ABLAUF_GEAENDERT);
  if (gesehen && (gesehen.length !== items.length || items.some((it, k) => it.id !== gesehen[k]))) {
    throw s.fehler(412, REIHENFOLGE_GEAENDERT);
  }

  const payload = orderedItemIds.map((id, index) => ({
    id,
    ...agendaItemWritePayload(byId.get(id) as CtAgendaItem, { position: index }),
  }));

  await ablaufSchreibe(s, ziel, ablaufBasis(ziel), {
    method: 'PUT',
    // Beim Termin genügt die Liste; die Vorlage braucht zusätzlich Name und Kalender (`ablaufKopf`).
    json: { ...(istVorlage(ziel) ? ablaufKopf(ziel, agenda) : {}), items: payload },
    verweigert: verweigertFuer(ziel),
    fehler: 'Ablauf-Reihenfolge speichern fehlgeschlagen',
  });
}

/** Ein neuer Ablaufpunkt, wie die Oberfläche ihn schickt. */
export interface NeuerPunkt {
  type: 'header' | 'text' | 'song';
  /** Fehlt er, gilt der Standard der Art (siehe `standardTitel`). */
  title?: string;
  /** Pflicht für ein Lied. */
  arrangementId?: number;
  responsible?: string;
  note?: string;
  /** Dauer in Minuten (UI-Einheit) – wird in ChurchTools-Sekunden umgerechnet. */
  durationMin?: number;
  /** Infos je Dienstgruppe (E6-4): Gruppe → Text. Leere fehlen. */
  infos?: Record<number, string>;
  /**
   * **Wohin** (Alwin, 30.10.2026 – wie „… dahinter einfügen“ in ChurchTools): hinter diesen Punkt, `null` = ganz nach
   * vorne. Fehlt es, kommt der Punkt ans Ende – wie bisher.
   */
  nachId?: number | null;
  /** Vor dem Gottesdienstbeginn? Fehlt es, entscheidet die Stelle: mitten im Vorlauf Vorlauf, sonst Gottesdienst. */
  vorBeginn?: boolean;
  /** An diesem Termin gleich weglassen (Auge, E6-3b)? */
  weggelassen?: boolean;
}

/** Der Titel eines neuen Punkts, wenn keiner mitkommt. */
export function standardTitel(type: NeuerPunkt['type']): string {
  return type === 'header' ? 'Überschrift' : type === 'song' ? 'Lied' : 'Neuer Punkt';
}

/** Legt einen neuen Ablaufpunkt an (am Ende). Für Lieder ist `arrangementId` Pflicht. */
export async function punktAnlegen(
  s: CtSchreiber,
  ziel: AblaufZiel,
  data: NeuerPunkt,
): Promise<void> {
  // Das Auge gilt für einen Termin; eine Vorlage kennt es nicht (E10-0). Vor jedem Schreiben ablehnen.
  if (istVorlage(ziel) && data.weggelassen) {
    throw s.fehler(400, 'In einer Ablaufvorlage kann man Punkte nicht weglassen.');
  }
  const body: Record<string, unknown> = {
    type: data.type,
    title: data.title ?? standardTitel(data.type),
  };
  // Lied-Verknüpfung MUSS als top-level arrangementId gesendet werden (siehe `agendaPayload`) – bei einem Lied ohne
  // Arrangement als `null`: Fehlt das Feld, lehnt ChurchTools mit 400 ab (gemessen E10-V1, 17.11.2026).
  if (data.type === 'song') body.arrangementId = data.arrangementId ?? null;
  if (data.responsible) body.responsible = data.responsible;
  if (data.note) body.note = data.note;
  // CT erwartet die Dauer in Sekunden (Feld `duration`), die UI arbeitet in Minuten.
  if (data.durationMin !== undefined) body.duration = data.durationMin * 60;
  // Infos je Gruppe nimmt das Anlegen gleich mit – wie beim Zurückholen (gemessen E6-6-0).
  const notizen = Object.entries(data.infos ?? {})
    .filter(([, note]) => note.trim() !== '')
    .map(([gruppe, note]) => ({ serviceGroupId: Number(gruppe), note }));
  // ChurchTools antwortet bei Überschriften in Vorlagen mit Erfolg, speichert die Infos aber nicht (E10-0) – lieber
  // sagen als still verlieren. Beim Termin-Ablauf nicht gemessen, dort bleibt das Verhalten wie es war.
  if (istVorlage(ziel) && data.type === 'header' && notizen.length > 0) {
    throw s.fehler(400, KEINE_INFOS_AN_UEBERSCHRIFT);
  }
  if (notizen.length > 0) body.serviceGroupNotes = notizen;
  const antwort = await ablaufSchreibe(s, ziel, `${ablaufBasis(ziel)}/items`, {
    method: 'POST',
    json: body,
    verweigert: verweigertFuer(ziel),
    fehler: 'Ablaufpunkt anlegen fehlgeschlagen',
  });
  // Nur ans Ende, ohne Schalter: fertig – wie bisher ohne weiteren Abruf.
  if (data.nachId === undefined && data.vorBeginn === undefined && !data.weggelassen) return;
  const neu = await angelegtePruefen(s, ziel, antwort, 'Der Punkt wurde nicht angelegt.');
  await anDieStelle(s, ziel, neu.agenda, neu.id, data.nachId, data.vorBeginn);
  // `weggelassen` ist bei Vorlagen oben schon abgelehnt – hier bleibt nur der Termin.
  if (data.weggelassen && !istVorlage(ziel)) await weglassenSetzen(s, ziel, neu.id, true);
}

/** Die Meldung, wenn jemand einer Überschrift in einer Vorlage Infos je Dienstgruppe geben will. */
const KEINE_INFOS_AN_UEBERSCHRIFT = 'Überschriften haben in Vorlagen keine Infos je Dienstgruppe.';

/**
 * Ob der eben angelegte Punkt **wirklich** im Ablauf steht – geprüft am frisch gelesenen Ablauf, nicht an der Antwort
 * des Anlegens (Lehre vom 11.08.2026: ein Erfolgssignal ist kein Beleg). Liefert seine ID und den gelesenen Ablauf.
 */
async function angelegtePruefen(
  s: CtSchreiber,
  ziel: AblaufZiel,
  antwort: unknown,
  meldung: string,
): Promise<{ id: number; agenda: GelesenerAblauf }> {
  const id = neueId(antwort);
  const agenda = await ablaufLesen(s, ziel);
  if (id === null || !agenda.items.some((i) => i.id === id)) {
    throw s.fehler(502, `${meldung} Bitte den Ablauf neu laden.`);
  }
  return { id, agenda };
}

/**
 * Schiebt einen eben (hinten) angelegten Punkt an seine Stelle und richtet seinen Vorlauf – **eine** Regel für
 * „… dahinter einfügen“ (Alwin, 30.10.2026) und das Zurückholen nach dem Löschen (`punktWiederherstellen`).
 *
 * - `nachId`: hinter diesen Punkt, `null` = ganz vorne, `undefined` = ans Ende. Ist der Punkt inzwischen weg, kommt er
 *   ebenfalls ans Ende.
 * - `vorBeginn`: Passt die Stelle nicht zur Seite (etwa „vor Beginn“, aber mitten im Gottesdienst), gilt die Regel des
 *   Schalters: Der Punkt kommt direkt über bzw. unter „Beginn“ (`vorlaufUmschalten`). Fehlt es, entscheidet die Stelle:
 *   mitten im Vorlauf Vorlauf, sonst Gottesdienst.
 *
 * Die Grenze ist eine Platznummer (#700, gemessen E6-6-0): Ein Vorlauf-Punkt an oder vor ihr schöbe den letzten
 * Vorlauf-Punkt hinaus, sie rückt deshalb um eins mit. Alle anderen Punkte bleiben auf ihrer Seite – auch der letzte
 * Vorlauf-Punkt, wenn der neue mitten in den Vorlauf soll, aber zum Gottesdienst gehört (der Test fand das 30.10.2026).
 */
async function anDieStelle(
  s: CtSchreiber,
  ziel: AblaufZiel,
  angelegt: GelesenerAblauf,
  neuId: number,
  nachId: number | null | undefined,
  vorBeginn: boolean | undefined,
): Promise<void> {
  const { items } = angelegt;
  const grenze = angelegt.eventStartPosition ?? 0;
  const andere = items.filter((i) => i.id !== neuId);
  // Wie viele Punkte vor dem Beginn laufen (ohne den neuen – angelegt wird hinten, die Grenze bleibt dabei).
  const vorlauf = andere.filter((it, k) => (it.position ?? k) < grenze).length;
  const rest = andere.map((i) => i.id);
  const nach = nachId == null ? -1 : rest.indexOf(nachId);
  const gewuenscht =
    nachId === undefined ? rest.length : nachId === null ? 0 : nach >= 0 ? nach + 1 : rest.length;
  const vor = vorBeginn ?? gewuenscht < vorlauf;
  // Auf der falschen Seite der Grenze? Dann direkt an sie – über „Beginn“ als Vorlauf, darunter als Gottesdienst.
  const stelle = vor ? Math.min(gewuenscht, vorlauf) : Math.max(gewuenscht, vorlauf);
  const reihenfolge = [...rest.slice(0, stelle), neuId, ...rest.slice(stelle)];
  if (reihenfolge.some((id, k) => items[k]?.id !== id)) {
    await ablaufUmsortieren(s, ziel, reihenfolge);
  }
  if (!vor) return;
  await ablaufSchreibe(s, ziel, ablaufBasis(ziel), {
    method: 'PUT',
    json: { ...ablaufKopf(ziel, angelegt), eventStartPosition: vorlauf + 1 },
    verweigert: verweigertFuer(ziel),
    fehler: 'Gottesdienstbeginn nachziehen fehlgeschlagen',
  });
}

/**
 * Änderbare Felder eines Ablaufpunkts – gesammelt in EINEM Schreibvorgang. `arrangementId`
 * verknüpft ein Lied, `unlink` hebt die Verknüpfung auf (beides schließt sich aus); `unlink` +
 * `title` zusammen = aufheben und direkt umbenennen.
 */
export interface PunktAenderung {
  title?: string;
  arrangementId?: number;
  unlink?: boolean;
  responsible?: string;
  /** Neue Dauer in Minuten (UI-Einheit) – wird in ChurchTools-Sekunden umgerechnet. */
  durationMin?: number;
  note?: string;
  /**
   * Infos je Dienstgruppe, die sich ändern (E6-4): Gruppe → neuer Text, leer = Info löschen. Nur die genannten Gruppen
   * werden geschrieben – je Gruppe einzeln (`…/servicegroups/{gruppe}`, gemessen E6-4-0), die übrigen bleiben.
   */
  infos?: Record<number, string>;
}

/**
 * Ändert Felder eines Ablaufpunkts. Liest den Punkt frisch, überschreibt nur die übergebenen Felder
 * und sendet alle übrigen unverändert mit. Lied-Verknüpfung bleibt über top-level `arrangementId`
 * erhalten.
 */
export async function punktAendern(
  s: CtSchreiber,
  ziel: AblaufZiel,
  itemId: number,
  fields: PunktAenderung,
  /**
   * Was das Fenster beim Öffnen gesehen hat (E6-3c). Steht in einem Feld, das hier geschrieben wird, inzwischen etwas
   * anderes, hat es jemand geändert: 412 statt still zu überschreiben. Ohne = „Trotzdem speichern“.
   */
  gesehen?: PunktStand,
): Promise<void> {
  const { items } = await ablaufLesen(s, ziel);
  const it = items.find((i) => i.id === itemId);
  if (!it) throw s.fehler(404, 'Ablaufpunkt nicht gefunden.');
  const { infos, ...felder } = fields;
  // Wie beim Anlegen: ChurchTools nähme Infos an einer Überschrift in einer Vorlage mit 204 an und speicherte nichts.
  // Löschen (leerer Text) ist harmlos und bleibt erlaubt.
  if (
    istVorlage(ziel) &&
    isHeaderType(it.type) &&
    Object.values(infos ?? {}).some((t) => t.trim() !== '')
  ) {
    throw s.fehler(400, KEINE_INFOS_AN_UEBERSCHRIFT);
  }
  if (gesehen) {
    // Die Zeitzone spielt für die verglichenen Felder keine Rolle (die Uhrzeit wird nicht verglichen).
    const frisch = punktStand(ablaufZeileAus(it, terminIdVon(ziel), 'UTC'));
    const infoGeaendert = Object.keys(infos ?? {}).some(
      (g) => (frisch.infos?.[Number(g)] ?? '') !== (gesehen.infos?.[Number(g)] ?? ''),
    );
    if (infoGeaendert || geschriebeneFelder(felder).some((f) => frisch[f] !== gesehen[f])) {
      throw s.fehler(412, PUNKT_GEAENDERT);
    }
  }

  // Nur die Infos geändert: den Punkt selbst nicht anfassen.
  if (Object.keys(felder).length > 0) await punktSchreiben(s, ziel, it, felder);
  for (const [gruppe, text] of Object.entries(infos ?? {})) {
    await gruppenInfoSchreiben(s, ziel, itemId, Number(gruppe), text);
  }
}

/**
 * **Eine Info je Dienstgruppe schreiben** (E6-4, gemessen E6-4-0): `PUT …/servicegroups/{gruppe}` `{note}` legt an und
 * ändert, `DELETE` löscht (auch ohne vorhandene Info 204). Leer oder nur Leerzeichen → löschen (ChurchTools nähme es mit
 * 400 nicht an). Recht = Ablauf-Regel; abgeschlossen → 423 wie beim Punkt.
 */
async function gruppenInfoSchreiben(
  s: CtSchreiber,
  ziel: AblaufZiel,
  itemId: number,
  gruppe: number,
  text: string,
): Promise<void> {
  const pfad = `${ablaufBasis(ziel)}/items/${itemId}/servicegroups/${gruppe}`;
  const note = text.trim();
  const verweigert = verweigertFuer(ziel);
  await ablaufSchreibe(
    s,
    ziel,
    pfad,
    note
      ? { method: 'PUT', json: { note }, verweigert, fehler: 'Info speichern fehlgeschlagen' }
      : { method: 'DELETE', verweigert, fehler: 'Info löschen fehlgeschlagen' },
  );
}

/** Den Punkt selbst schreiben (alles außer den Infos je Dienstgruppe). */
async function punktSchreiben(
  s: CtSchreiber,
  ziel: AblaufZiel,
  it: CtAgendaItem,
  fields: Omit<PunktAenderung, 'infos'>,
): Promise<void> {
  const body = agendaItemWritePayload(it, {
    // Beim Aufheben der Lied-Verknüpfung den Titel leeren (der Liedtitel soll nicht als Text
    // zurückbleiben) – es sei denn, im selben Auftrag kommt ein neuer Titel mit (Kombi-Speichern
    // aus dem Bearbeiten-Dialog: aufheben + umbenennen in EINEM Schreibvorgang).
    title: fields.unlink ? (fields.title ?? '') : fields.title,
    note: fields.note,
    arrangementId: fields.arrangementId,
    unlink: fields.unlink,
    responsible: fields.responsible,
    durationSec: fields.durationMin !== undefined ? fields.durationMin * 60 : undefined,
  });
  await ablaufSchreibe(s, ziel, `${ablaufBasis(ziel)}/items/${it.id}`, {
    method: 'PUT',
    json: body,
    verweigert: verweigertFuer(ziel),
    fehler: 'Ablaufpunkt ändern fehlgeschlagen',
  });
}

/** Welche Felder des Punkt-Stands eine Änderung schreibt – nur die werden auf Konflikt geprüft (E6-3c). */
function geschriebeneFelder(f: Omit<PunktAenderung, 'infos'>): (keyof PunktStand)[] {
  const felder: (keyof PunktStand)[] = [];
  if (f.title !== undefined) felder.push('title');
  if (f.responsible !== undefined) felder.push('responsibleText');
  if (f.durationMin !== undefined) felder.push('durationMin');
  if (f.note !== undefined) felder.push('note');
  if (f.arrangementId !== undefined || f.unlink) felder.push('lied');
  return felder;
}

/**
 * Was „Rückgängig" nach dem Löschen braucht (Alwin, 12.10.2026): der Punkt, wie ChurchTools ihn beim
 * Anlegen nimmt, und wo er stand.
 *
 * Gemessen an der Test-Instanz (12.10.2026): Ein neu angelegter Punkt bekommt Titel, Dauer, Notiz,
 * Zuständige (ChurchTools ordnet die Personen über die Dienst-Platzhalter neu zu) und die Notizen je
 * Dienstgruppe vollständig zurück; die Stelle stellt danach das Umsortieren her. Der Punkt hat danach eine neue
 * ID. Das Auge („an diesem Termin weglassen“) kennt das Anlegen nicht – seit E6-3b (#652) wird es danach über
 * `hide` wieder gesetzt (`weggelassen`); vorher ging es beim Zurückholen verloren.
 */
export interface GeloeschterPunkt {
  felder: {
    type: 'header' | 'text' | 'song';
    title: string;
    note: string;
    /** In Sekunden, wie ChurchTools sie speichert – nicht in gerundeten Minuten der Oberfläche. */
    duration: number;
    responsible: string;
    serviceGroupNotes: { serviceGroupId: number; note: string }[];
    arrangementId?: number;
  };
  /** Der Punkt, hinter dem er stand – `null` = ganz vorne. */
  nachId: number | null;
  vorBeginn: boolean;
  /** War der Punkt an diesem Termin weggelassen (Auge)? Fehlt bei Merkzetteln von vor E6-3b. */
  weggelassen?: boolean;
}

/**
 * Löscht einen Ablaufpunkt und gibt zurück, was zum Wiederherstellen nötig ist. Dafür wird der Ablauf
 * vorher frisch gelesen – der Stand des Geräts kann veraltet sein. `null`, wenn der Punkt schon weg war.
 */
export async function punktLoeschen(
  s: CtSchreiber,
  ziel: AblaufZiel,
  itemId: number,
): Promise<GeloeschterPunkt | null> {
  // Lässt sich der Ablauf gerade nicht lesen, wird trotzdem gelöscht – nur ohne „Rückgängig". Gewollt
  // ist das Löschen; der Merkzettel ist eine Zugabe und darf es nicht verhindern.
  const agenda = await ablaufLesen(s, ziel).then(
    (a) => a,
    () => null,
  );
  const items = agenda?.items ?? [];
  const stelle = items.findIndex((i) => i.id === itemId);
  const it = stelle >= 0 ? items[stelle] : undefined;
  await ablaufSchreibe(s, ziel, `${ablaufBasis(ziel)}/items/${itemId}`, {
    method: 'DELETE',
    verweigert: verweigertFuer(ziel),
    fehler: 'Ablaufpunkt löschen fehlgeschlagen',
    okBei404: true, // schon weg ist auch weg
  });
  if (!it || !agenda) return null;
  // Die Beginn-Grenze zieht ChurchTools NICHT mit (gemessen 12.10.2026): Fehlt ein Vorlauf-Punkt, rutschte
  // sonst der erste Punkt des Gottesdienstes in den Vorlauf – samt verschobener Uhrzeiten.
  const grenze = agenda.eventStartPosition ?? 0;
  if ((it.position ?? stelle) < grenze) {
    await ablaufSchreibe(s, ziel, ablaufBasis(ziel), {
      method: 'PUT',
      json: { ...ablaufKopf(ziel, agenda), eventStartPosition: grenze - 1 },
      verweigert: verweigertFuer(ziel),
      fehler: 'Gottesdienstbeginn nach dem Löschen nachziehen fehlgeschlagen',
    });
  }
  return merkzettelAus(agenda, ziel, itemId);
}

/**
 * Der **Merkzettel** eines Punkts, wie er im (frisch gelesenen) Ablauf steht – `null`, wenn er dort fehlt. Eine Stelle
 * für „Rückgängig“ nach dem Löschen (`punktLoeschen`) und das Übertragen in einen anderen Termin (E6-6b,
 * `punktUebertragen`); gemessen E6-6-0: Lied, Notiz, Dauer, Zuständig und Gruppen-Infos kommen damit mit.
 */
export function merkzettelAus(
  agenda: CtAgenda,
  ziel: AblaufZiel,
  itemId: number,
): GeloeschterPunkt | null {
  const { items } = agenda;
  const stelle = items.findIndex((i) => i.id === itemId);
  if (stelle < 0) return null;
  const it = items[stelle];
  // Derselbe Payload wie beim Ändern – sonst fehlte hier ein Feld, das dort schon gelernt ist.
  const p = agendaItemWritePayload(it);
  return {
    felder: {
      // Anlegen kennt nur diese drei Arten (OpenAPI der Test-Instanz); alles andere ist ein Textpunkt.
      type: p.type === 'header' || p.type === 'song' ? p.type : 'text',
      title: text(p.title),
      note: text(p.note),
      duration: typeof p.duration === 'number' ? p.duration : 0,
      responsible: text(p.responsible),
      serviceGroupNotes: dienstgruppenNotizen(it),
      ...(typeof p.arrangementId === 'number' ? { arrangementId: p.arrangementId } : {}),
    },
    nachId: stelle > 0 ? items[stelle - 1].id : null,
    vorBeginn: it.isBeforeEvent ?? false,
    // Eine Vorlage kennt das Auge nicht (E10-0): `terminIdVon` ist dort 0, `startTimes` leer – nie weggelassen.
    weggelassen: istWeggelassen(it, terminIdVon(ziel)),
  };
}

/** Ein Textfeld aus dem Payload – `sonst`, wenn es keins ist. */
function text(v: unknown, sonst = ''): string {
  return typeof v === 'string' ? v : sonst;
}

/**
 * Legt einen gelöschten Punkt wieder an – an seiner alten Stelle und im alten Vorlauf-Zustand.
 *
 * Drei Schritte, jeder mit den vorhandenen Regeln: anlegen, an die Stelle schieben und den Vorlauf richten
 * (`anDieStelle` – dieselbe Regel wie „… dahinter einfügen“). Ob der neue Punkt **wirklich** da ist, wird am
 * frisch gelesenen Ablauf geprüft, nicht an der Antwort des Anlegens (Lehre vom 11.08.2026). Ist der
 * Vorgänger inzwischen auch weg, landet der Punkt am Ende. Liefert die ID des neuen Punkts (für „Rückgängig“ nach dem
 * Übertragen, E6-6b).
 */
export async function punktWiederherstellen(
  s: CtSchreiber,
  ziel: AblaufZiel,
  g: GeloeschterPunkt,
): Promise<number> {
  const f = g.felder;
  const body: Record<string, unknown> =
    f.type === 'header'
      ? { type: 'header', title: f.title }
      : {
          type: f.arrangementId ? 'song' : f.type,
          title: f.title,
          note: f.note,
          duration: f.duration,
          responsible: f.responsible,
          serviceGroupNotes: f.serviceGroupNotes,
          // Ein Lied ohne Arrangement braucht das Feld trotzdem (`null`) – sonst 400 (wie in `agendaPayload`).
          ...(f.arrangementId
            ? { arrangementId: f.arrangementId }
            : f.type === 'song'
              ? { arrangementId: null }
              : {}),
        };
  const antwort = await ablaufSchreibe(s, ziel, `${ablaufBasis(ziel)}/items`, {
    method: 'POST',
    json: body,
    verweigert: verweigertFuer(ziel),
    fehler: 'Ablaufpunkt wiederherstellen fehlgeschlagen',
  });
  const { id: neuId, agenda } = await angelegtePruefen(
    s,
    ziel,
    antwort,
    'Der Punkt wurde nicht wieder angelegt.',
  );
  // An die alte Stelle, im alten Vorlauf-Zustand – dieselbe Regel wie „… dahinter einfügen“.
  await anDieStelle(s, ziel, agenda, neuId, g.nachId, g.vorBeginn);
  if (g.weggelassen && !istVorlage(ziel)) await weglassenSetzen(s, ziel, neuId, true);
  return neuId;
}

/**
 * Einen Punkt **an diesem Termin weglassen** – oder wieder zeigen (Auge in ChurchTools, Bauplan E6-3b).
 * Gemessen an der Test-Instanz (E6-3-0, 19.10.2026): `POST /events/{termin}/agenda/items/{punkt}/hide` bzw.
 * `…/unhide` → 204. Der Punkt bleibt im Ablauf, `startTimes[termin]` wird `null`, und die Folgepunkte rücken vor –
 * ChurchTools rechnet seine Zeit nicht mehr mit. Gilt nur für diesen Termin, auch wenn sich mehrere den Ablauf
 * teilen.
 *
 * Frisch gelesen wie beim Ändern: Fehlt der Punkt, kommt 404 (sonst meldete ChurchTools nur „fehlgeschlagen“); steht
 * er schon so, wird nichts geschrieben.
 */
export async function weglassenSetzen(
  s: CtSchreiber,
  eventId: number,
  itemId: number,
  weglassen: boolean,
): Promise<void> {
  const { items } = await s.agenda(eventId);
  const it = items.find((i) => i.id === itemId);
  if (!it) throw s.fehler(404, 'Ablaufpunkt nicht gefunden.');
  if (istWeggelassen(it, eventId) === weglassen) return;
  await ablaufSchreibe(
    s,
    eventId,
    `/events/${eventId}/agenda/items/${itemId}/${weglassen ? 'hide' : 'unhide'}`,
    {
      method: 'POST',
      json: {},
      verweigert: ABLAUF_VERWEIGERT,
      fehler: weglassen ? 'Punkt weglassen fehlgeschlagen' : 'Punkt wieder zeigen fehlgeschlagen',
    },
  );
}

/** Die ID aus der Antwort auf ein Anlegen (`POST …/agenda/items`, `POST /agendatemplates`; `{ data: { id } }`). */
export function neueId(antwort: unknown): number | null {
  const data = (antwort as { data?: { id?: unknown } } | null)?.data;
  return typeof data?.id === 'number' ? data.id : null;
}

/**
 * Legt fest, ob ein Ablaufpunkt VOR dem Beginn der Veranstaltung läuft (Vorlauf, #423) – **nur dieser Punkt wechselt
 * die Seite** und rückt direkt über bzw. unter „Beginn“ (Alwin, 30.10.2026; Regel in `vorlaufUmschalten`).
 *
 * Erst wird umsortiert (wie beim Ziehen, `ablaufUmsortieren`), dann **nur die Grenze** (`eventStartPosition`)
 * geschrieben, ohne `items`: Gemessen an der Test-Instanz (05.10.2026) bleiben die Punkte dabei unberührt – IDs,
 * Liedverknüpfungen, Dauern. Steht der Punkt schon an der Grenze, entfällt das Umsortieren.
 *
 * Gerechnet wird auf dem **frisch gelesenen** Ablauf, nie auf dem Stand des Geräts: Hat jemand
 * zwischendurch umsortiert, gehört die Grenze an die neue Stelle des Punkts.
 */
export async function vorBeginnSetzen(
  s: CtSchreiber,
  ziel: AblaufZiel,
  itemId: number,
  vorBeginn: boolean,
): Promise<void> {
  const agenda = await ablaufLesen(s, ziel);
  if (!agenda.items.some((i) => i.id === itemId)) throw s.fehler(409, ABLAUF_GEAENDERT);
  const neu = vorlaufUmschalten(agenda.items, agenda.eventStartPosition ?? 0, itemId, vorBeginn);
  if (neu === null) return; // steht schon so – nichts zu schreiben

  if (neu.reihenfolge) await ablaufUmsortieren(s, ziel, neu.reihenfolge);
  await ablaufSchreibe(s, ziel, ablaufBasis(ziel), {
    method: 'PUT',
    json: { ...ablaufKopf(ziel, agenda), eventStartPosition: neu.grenze },
    verweigert: verweigertFuer(ziel),
    fehler: 'Gottesdienstbeginn speichern fehlgeschlagen',
  });
}

// ── Arrangement ──────────────────────────────────────────────────────────────

/**
 * Ändert ein Arrangement (#396) – **lesen–ändern–schreiben.**
 *
 * `PUT` ersetzt in ChurchTools den ganzen Datensatz; was nicht mitkommt, ist danach `null`. Deshalb
 * wird das Arrangement frisch gelesen und der Payload daraus gebaut (`arrangementWritePayload`).
 */
export async function arrangementAendern(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
  overrides: ArrangementOverrides,
  /**
   * Eigene Meldungen für einen engeren Zweck – der Tempo-Weg sagt „das Tempo", nicht „Arrangements".
   * Der **Ablauf** bleibt derselbe: Wer hier einen zweiten Lese-Schreib-Zyklus danebenstellte,
   * hätte die gefährlichste Regel des Projekts in zweiter Fassung (`PUT` ersetzt alles).
   */
  meldungen?: { verweigert: string; fehler: string },
): Promise<void> {
  const arr = arrangementAus(await s.song(songId), arrangementId, (st, m) => s.fehler(st, m));
  await s.schreibe(`/songs/${songId}/arrangements/${arrangementId}`, {
    method: 'PUT',
    json: arrangementWritePayload(arr, overrides),
    verweigert:
      meldungen?.verweigert ?? 'Keine Berechtigung, Arrangements in ChurchTools zu ändern.',
    fehler: meldungen?.fehler ?? 'Arrangement speichern fehlgeschlagen',
  });
}

/**
 * Setzt das Tempo eines Arrangements – über denselben Lese-Schreib-Weg wie `arrangementAendern`,
 * nur mit Meldungen, die „das Tempo" sagen: Angetippt wird es vom Blatt, von jemandem, der nur das
 * Tempo meint.
 */
export function tempoSetzen(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
  tempo: number,
): Promise<void> {
  return arrangementAendern(
    s,
    songId,
    arrangementId,
    { tempo },
    {
      verweigert: 'Keine Berechtigung, das Tempo in ChurchTools zu ändern.',
      fehler: 'Tempo speichern fehlgeschlagen',
    },
  );
}
