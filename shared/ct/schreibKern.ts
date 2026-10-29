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
import { agendaItemWritePayload, beginnPositionFuer, dienstgruppenNotizen } from './agendaPayload';
import { arrangementWritePayload, type ArrangementOverrides } from './arrangementPayload';
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

/**
 * Jeder Schreibvorgang am Ablauf geht hier durch: Verweigert ChurchTools, wird **am Ablauf nachgesehen**
 * (gemessen 09.10.2026: abgeschlossen → `isLocked: true`, Ändern/Löschen → 403). Ist er abgeschlossen,
 * kommt die richtige Meldung (423); sonst bleibt es bei „Keine Berechtigung". Lässt sich der Ablauf gerade
 * nicht lesen, bleibt der ursprüngliche Fehler – geraten wird nicht.
 */
export async function ablaufSchreibe(
  s: CtSchreiber,
  eventId: number,
  pfad: string,
  auftrag: SchreibAuftrag,
): Promise<unknown> {
  try {
    return await s.schreibe(pfad, auftrag);
  } catch (e) {
    if (!(e instanceof Error && e.message === ABLAUF_VERWEIGERT)) throw e;
    let abgeschlossen = false;
    try {
      abgeschlossen = (await s.agenda(eventId)).isLocked === true;
    } catch {
      throw e;
    }
    if (abgeschlossen) throw s.fehler(423, ABLAUF_ABGESCHLOSSEN);
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
  eventId: number,
  orderedItemIds: number[],
  /** Die Reihenfolge vor dem Ziehen (E6-3c) – weicht die frische ab, hat jemand anderes umsortiert: 412. */
  gesehen?: readonly number[],
): Promise<void> {
  const { items } = await s.agenda(eventId);
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

  await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda`, {
    method: 'PUT',
    json: { items: payload },
    verweigert: ABLAUF_VERWEIGERT,
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
}

/** Der Titel eines neuen Punkts, wenn keiner mitkommt. */
export function standardTitel(type: NeuerPunkt['type']): string {
  return type === 'header' ? 'Überschrift' : type === 'song' ? 'Lied' : 'Neuer Punkt';
}

/** Legt einen neuen Ablaufpunkt an (am Ende). Für Lieder ist `arrangementId` Pflicht. */
export async function punktAnlegen(
  s: CtSchreiber,
  eventId: number,
  data: NeuerPunkt,
): Promise<void> {
  const body: Record<string, unknown> = {
    type: data.type,
    title: data.title ?? standardTitel(data.type),
  };
  // Lied-Verknüpfung MUSS als top-level arrangementId gesendet werden (siehe `agendaPayload`).
  if (data.type === 'song' && data.arrangementId) body.arrangementId = data.arrangementId;
  if (data.responsible) body.responsible = data.responsible;
  if (data.note) body.note = data.note;
  // CT erwartet die Dauer in Sekunden (Feld `duration`), die UI arbeitet in Minuten.
  if (data.durationMin !== undefined) body.duration = data.durationMin * 60;
  await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda/items`, {
    method: 'POST',
    json: body,
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablaufpunkt anlegen fehlgeschlagen',
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
}

/**
 * Ändert Felder eines Ablaufpunkts. Liest den Punkt frisch, überschreibt nur die übergebenen Felder
 * und sendet alle übrigen unverändert mit. Lied-Verknüpfung bleibt über top-level `arrangementId`
 * erhalten.
 */
export async function punktAendern(
  s: CtSchreiber,
  eventId: number,
  itemId: number,
  fields: PunktAenderung,
  /**
   * Was das Fenster beim Öffnen gesehen hat (E6-3c). Steht in einem Feld, das hier geschrieben wird, inzwischen etwas
   * anderes, hat es jemand geändert: 412 statt still zu überschreiben. Ohne = „Trotzdem speichern“.
   */
  gesehen?: PunktStand,
): Promise<void> {
  const { items } = await s.agenda(eventId);
  const it = items.find((i) => i.id === itemId);
  if (!it) throw s.fehler(404, 'Ablaufpunkt nicht gefunden.');
  if (gesehen) {
    // Die Zeitzone spielt für die verglichenen Felder keine Rolle (die Uhrzeit wird nicht verglichen).
    const frisch = punktStand(ablaufZeileAus(it, eventId, 'UTC'));
    if (geschriebeneFelder(fields).some((f) => frisch[f] !== gesehen[f])) {
      throw s.fehler(412, PUNKT_GEAENDERT);
    }
  }

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
  await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    json: body,
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablaufpunkt ändern fehlgeschlagen',
  });
}

/** Welche Felder des Punkt-Stands eine Änderung schreibt – nur die werden auf Konflikt geprüft (E6-3c). */
function geschriebeneFelder(f: PunktAenderung): (keyof PunktStand)[] {
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
  eventId: number,
  itemId: number,
): Promise<GeloeschterPunkt | null> {
  // Lässt sich der Ablauf gerade nicht lesen, wird trotzdem gelöscht – nur ohne „Rückgängig". Gewollt
  // ist das Löschen; der Merkzettel ist eine Zugabe und darf es nicht verhindern.
  const agenda = await s.agenda(eventId).then(
    (a) => a,
    () => null,
  );
  const items = agenda?.items ?? [];
  const stelle = items.findIndex((i) => i.id === itemId);
  const it = stelle >= 0 ? items[stelle] : undefined;
  await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda/items/${itemId}`, {
    method: 'DELETE',
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablaufpunkt löschen fehlgeschlagen',
    okBei404: true, // schon weg ist auch weg
  });
  if (!it || !agenda) return null;
  // Die Beginn-Grenze zieht ChurchTools NICHT mit (gemessen 12.10.2026): Fehlt ein Vorlauf-Punkt, rutschte
  // sonst der erste Punkt des Gottesdienstes in den Vorlauf – samt verschobener Uhrzeiten.
  const grenze = agenda.eventStartPosition ?? 0;
  if ((it.position ?? stelle) < grenze) {
    await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda`, {
      method: 'PUT',
      json: { calendarId: agenda.calendarId, eventStartPosition: grenze - 1 },
      verweigert: ABLAUF_VERWEIGERT,
      fehler: 'Gottesdienstbeginn nach dem Löschen nachziehen fehlgeschlagen',
    });
  }
  return merkzettelAus(agenda, eventId, itemId);
}

/**
 * Der **Merkzettel** eines Punkts, wie er im (frisch gelesenen) Ablauf steht – `null`, wenn er dort fehlt. Eine Stelle
 * für „Rückgängig“ nach dem Löschen (`punktLoeschen`) und das Übertragen in einen anderen Termin (E6-6b,
 * `punktUebertragen`); gemessen E6-6-0: Lied, Notiz, Dauer, Zuständig und Gruppen-Infos kommen damit mit.
 */
export function merkzettelAus(
  agenda: CtAgenda,
  eventId: number,
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
    weggelassen: istWeggelassen(it, eventId),
  };
}

/** Ein Textfeld aus dem Payload – `sonst`, wenn es keins ist. */
function text(v: unknown, sonst = ''): string {
  return typeof v === 'string' ? v : sonst;
}

/**
 * Legt einen gelöschten Punkt wieder an – an seiner alten Stelle und im alten Vorlauf-Zustand.
 *
 * Drei Schritte, jeder mit den vorhandenen Regeln: anlegen, per `ablaufUmsortieren` an die Stelle
 * schieben, den Vorlauf richten (Grenze mitziehen bzw. `vorBeginnSetzen`). Ob der neue Punkt **wirklich** da ist, wird am
 * frisch gelesenen Ablauf geprüft, nicht an der Antwort des Anlegens (Lehre vom 11.08.2026). Ist der
 * Vorgänger inzwischen auch weg, landet der Punkt am Ende. Liefert die ID des neuen Punkts (für „Rückgängig“ nach dem
 * Übertragen, E6-6b).
 */
export async function punktWiederherstellen(
  s: CtSchreiber,
  eventId: number,
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
          ...(f.arrangementId ? { arrangementId: f.arrangementId } : {}),
        };
  const antwort = await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda/items`, {
    method: 'POST',
    json: body,
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablaufpunkt wiederherstellen fehlgeschlagen',
  });
  const neuId = neueId(antwort);
  const angelegt = await s.agenda(eventId);
  const { items } = angelegt;
  if (neuId === null || !items.some((i) => i.id === neuId)) {
    throw s.fehler(502, 'Der Punkt wurde nicht wieder angelegt. Bitte den Ablauf neu laden.');
  }

  const rest = items.map((i) => i.id).filter((id) => id !== neuId);
  const nach = g.nachId === null ? -1 : rest.indexOf(g.nachId);
  const ziel = g.nachId === null ? 0 : nach >= 0 ? nach + 1 : rest.length;
  const reihenfolge = [...rest.slice(0, ziel), neuId, ...rest.slice(ziel)];
  if (reihenfolge.some((id, k) => items[k]?.id !== id)) {
    await ablaufUmsortieren(s, eventId, reihenfolge);
  }
  // Die Grenze ist eine Platznummer (#700, gemessen E6-6-0): Ein Vorlauf-Punkt an oder vor ihr schöbe die übrigen
  // Vorlauf-Punkte hinaus – sie rückt deshalb um eins mit. (Angelegt wird hinten, das ließ sie unberührt.) Sonst gilt
  // die Regel von `vorBeginnSetzen`.
  const grenze = angelegt.eventStartPosition ?? 0;
  if (g.vorBeginn && ziel <= grenze) {
    await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda`, {
      method: 'PUT',
      json: { calendarId: angelegt.calendarId, eventStartPosition: grenze + 1 },
      verweigert: ABLAUF_VERWEIGERT,
      fehler: 'Gottesdienstbeginn nach dem Zurückholen nachziehen fehlgeschlagen',
    });
  } else {
    await vorBeginnSetzen(s, eventId, neuId, g.vorBeginn);
  }
  if (g.weggelassen) await weglassenSetzen(s, eventId, neuId, true);
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

/** Die ID aus der Antwort auf `POST …/agenda/items` (`{ data: { id } }`). */
function neueId(antwort: unknown): number | null {
  const data = (antwort as { data?: { id?: unknown } } | null)?.data;
  return typeof data?.id === 'number' ? data.id : null;
}

/**
 * Legt fest, ob ein Ablaufpunkt VOR dem Beginn der Veranstaltung läuft (Vorlauf, #423).
 *
 * Geschrieben wird **nur die Grenze** (`eventStartPosition`), ohne `items`: Gemessen an der
 * Test-Instanz (05.10.2026) bleiben die Punkte dabei unberührt – IDs, Liedverknüpfungen, Dauern.
 * Die Liste mitzuschicken hieße, jeden Punkt neu zu schreiben, nur um eine Zahl zu ändern.
 *
 * Gerechnet wird auf dem **frisch gelesenen** Ablauf, nie auf dem Stand des Geräts: Hat jemand
 * zwischendurch umsortiert, gehört die Grenze an die neue Stelle des Punkts.
 */
export async function vorBeginnSetzen(
  s: CtSchreiber,
  eventId: number,
  itemId: number,
  vorBeginn: boolean,
): Promise<void> {
  const agenda = await s.agenda(eventId);
  const item = agenda.items.find((i) => i.id === itemId);
  if (!item) throw s.fehler(409, ABLAUF_GEAENDERT);
  const neu = beginnPositionFuer(item, agenda.eventStartPosition ?? 0, vorBeginn);
  if (neu === null) return; // steht schon so – nichts zu schreiben

  await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda`, {
    method: 'PUT',
    json: { calendarId: agenda.calendarId, eventStartPosition: neu },
    verweigert: ABLAUF_VERWEIGERT,
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
