/**
 * **Ablaufvorlagen anlegen, umbenennen, löschen, aus einem Termin füllen** (E10-V1, gemessen E10-0 am 17.11.2026,
 * Protokoll `dienstplaner-planung/docs/messung-e10-0.md`).
 *
 * Die einzelnen Punkte einer Vorlage bearbeitet der Schreib-Kern (`schreibKern.ts`, Ziel `{ vorlageId }`) – hier stehen
 * nur die Vorgänge **an der Vorlage als Ganzem**. Gemessen: `POST`/`PUT` mit der ganzen Punkteliste sind **ganz oder
 * gar nicht** (ungültiger Punkt → 400, nichts ändert sich). Deshalb genügt für „als neue Vorlage speichern“ **ein**
 * `POST` und für „Vorlage damit ersetzen“ **ein** `PUT` – keine halbe Vorlage, kein Neuanlegen und Löschen.
 *
 * Wie überall im Schreib-Kern: Ein Erfolgssignal ist kein Beleg. Nach jedem Schreiben der ganzen Liste wird frisch
 * gelesen und nachgezählt (Lehre vom 11.08.2026).
 */
import { agendaItemWritePayload } from './agendaPayload';
import {
  ablaufSchreibe,
  neueId,
  VORLAGE_GESPERRT,
  VORLAGE_VERWEIGERT,
  type CtSchreiber,
} from './schreibKern';
import type { CtAgenda, CtAblaufVorlage } from './typen';

/** Wie lang ein Vorlagenname höchstens sein darf – die eine Zahl für Eingabefeld und Prüfung. */
export const VORLAGE_NAME_MAX = 100;

/** Die Meldung, wenn sich jemand anderes an der Vorlage zu schaffen gemacht hat (412, wie beim Ablauf). */
export const VORLAGE_GEAENDERT =
  'Die Ablaufvorlage wurde eben woanders geändert. Bitte neu laden und erneut versuchen.';

/**
 * Was am Namen einer Vorlage nicht stimmt – `null`, wenn er passt. **Die eine Stelle für die Namensregel** (leer nach
 * dem Kürzen, zu lang): die Oberfläche kann damit schon beim Tippen warnen, der Kern prüft vor jedem Schreiben.
 */
export function vorlageNameFehler(name: string): string | null {
  const n = name.trim();
  if (n === '') return 'Bitte einen Namen für die Vorlage eingeben.';
  if (n.length > VORLAGE_NAME_MAX) {
    return `Der Name darf höchstens ${VORLAGE_NAME_MAX} Zeichen lang sein.`;
  }
  return null;
}

/** Der geprüfte, getrimmte Name – oder 400 mit der Meldung von `vorlageNameFehler`. */
function geprueftenNamen(s: CtSchreiber, name: string): string {
  const fehler = vorlageNameFehler(name);
  if (fehler) throw s.fehler(400, fehler);
  return name.trim();
}

/**
 * **Die Punkte einer Vorlage aus dem Ablauf eines Termins** – rein, ohne Netz. Je Punkt der volle Schreib-Payload
 * (`agendaItemWritePayload`, sonst würde ChurchTools weggelassene Felder zurücksetzen), aber ohne `id`, `position` und
 * `isBeforeEvent`: Die Vorlage bekommt neue Punkte, die Reihenfolge ist die der Liste, den Vorlauf bestimmt allein die
 * Grenze.
 *
 * - **Typ:** nur Überschrift, Lied und Text. Termin-Abläufe kennen auch `normal` (siehe `merkzettelAus`) – das lehnt das
 *   Anlegen mit 400 ab, gemessen E10-0.
 * - **Überschrift:** nur Typ, Titel, Dauer. Infos je Dienstgruppe an Überschriften meldet ChurchTools mit Erfolg und
 *   verwirft sie (E10-0), also schicken wir sie gar nicht erst mit.
 * - **Lied:** verlangt das Feld `arrangementId`, auch ohne Arrangement (dann `null`) – fehlt das Feld, kommt 400.
 * - **Weggelassene Punkte (Auge) kommen mit:** Das Auge gilt nur für einen bestimmten Termin (`startTimes[termin]`);
 *   eine Vorlage hat keinen. Der Punkt gehört zum Ablauf, nur diesen einen Termin hat jemand ausgeblendet.
 * - **Grenze:** Anzahl der Vorlauf-Punkte (`position`, sonst Listenplatz, unter `eventStartPosition`) – dadurch nie
 *   größer als die Anzahl der Punkte: ChurchTools nähme eine größere Zahl an und machte alles zum Vorlauf (E10-0).
 */
export function vorlagePunkteAus(agenda: CtAgenda): {
  items: Record<string, unknown>[];
  eventStartPosition: number;
} {
  const items = agenda.items.map((it) => {
    const p = agendaItemWritePayload(it);
    const typ = p.type === 'header' || p.type === 'song' ? p.type : 'text';
    if (typ === 'header') return { type: 'header', title: p.title, duration: p.duration };
    return {
      type: typ,
      title: p.title,
      note: p.note,
      duration: p.duration,
      responsible: p.responsible,
      serviceGroupNotes: p.serviceGroupNotes,
      ...(typ === 'song' ? { arrangementId: p.arrangementId ?? null } : {}),
    };
  });
  const grenze = agenda.eventStartPosition ?? 0;
  const vorlauf = agenda.items.filter((it, k) => (it.position ?? k) < grenze).length;
  // Gezählt, nicht übernommen: Die Zahl kann nie größer sein als die Anzahl der Punkte.
  return { items, eventStartPosition: vorlauf };
}

/** Die Titel der Punkte, zum Vergleichen von Geschriebenem und Nachgelesenem (ohne Rand-Leerzeichen). */
function titelFolge(items: readonly { title?: unknown }[]): string[] {
  return items.map((i) => (typeof i.title === 'string' ? i.title.trim() : ''));
}

/**
 * Eine **leere** Vorlage anlegen. Liefert ihre ID. Nach dem Anlegen wird nachgelesen: Meldet ChurchTools Erfolg, aber die
 * Vorlage ist nicht zu finden, wird nichts behauptet (502) – ein Erfolgssignal ist kein Beleg.
 */
export async function vorlageAnlegen(
  s: CtSchreiber,
  daten: { name: string; kalenderId: number },
): Promise<number> {
  const name = geprueftenNamen(s, daten.name);
  const antwort = await s.schreibe('/agendatemplates', {
    method: 'POST',
    json: { name, calendarId: daten.kalenderId, series: null, eventStartPosition: 0, items: [] },
    verweigert: VORLAGE_VERWEIGERT,
    fehler: 'Ablaufvorlage anlegen fehlgeschlagen',
  });
  const id = neueId(antwort);
  if (id === null || (await vorlageLesen(s, id)) === null) {
    throw s.fehler(502, 'Die Ablaufvorlage wurde nicht angelegt. Bitte die Liste neu laden.');
  }
  return id;
}

/** Die Vorlage frisch lesen – `null`, wenn es sie nicht gibt oder sie sich nicht lesen lässt. */
async function vorlageLesen(s: CtSchreiber, id: number): Promise<CtAblaufVorlage | null> {
  try {
    return await s.vorlage(id);
  } catch {
    return null;
  }
}

/**
 * Eine Vorlage **umbenennen** (`PUT` ohne `items`: Gemessen E10-0 bleiben die Punkte dann stehen). Frisch gelesen, weil
 * das `PUT` den Kalender mitbringen muss und eine gesperrte Vorlage eine eigene Meldung verdient (423).
 */
export async function vorlageUmbenennen(
  s: CtSchreiber,
  vorlageId: number,
  name: string,
): Promise<void> {
  const neuerName = geprueftenNamen(s, name);
  const v = await s.vorlage(vorlageId);
  if (v.isLocked === true) throw s.fehler(423, VORLAGE_GESPERRT);
  await ablaufSchreibe(s, { vorlageId }, `/agendatemplates/${vorlageId}`, {
    method: 'PUT',
    json: { name: neuerName, calendarId: v.calendarId },
    verweigert: VORLAGE_VERWEIGERT,
    fehler: 'Ablaufvorlage umbenennen fehlgeschlagen',
  });
}

/**
 * Eine Vorlage **löschen**. Es gibt keinen Papierkorb (und `dryRun` löscht trotzdem, E10-0) – die Nachfrage gehört der
 * Oberfläche. „Schon weg“ ist kein Fehler. Gemessen E10-0: Niemand verweist auf eine Vorlage, Löschen bricht nichts.
 */
export async function vorlageLoeschen(s: CtSchreiber, vorlageId: number): Promise<void> {
  await ablaufSchreibe(s, { vorlageId }, `/agendatemplates/${vorlageId}`, {
    method: 'DELETE',
    verweigert: VORLAGE_VERWEIGERT,
    fehler: 'Ablaufvorlage löschen fehlgeschlagen',
    okBei404: true,
  });
}

/**
 * **Den Ablauf eines Termins als neue Vorlage speichern** – ein `POST` mit allen Punkten. Liefert die ID der Vorlage.
 *
 * Danach wird frisch gelesen und nachgezählt. Stimmt die Punktzahl nicht, ist die eben selbst angelegte Vorlage
 * unbrauchbar: Sie wird gelöscht, und es kommt 502 – keine halbe Vorlage in der Liste. Lässt sie sich gar nicht lesen
 * (Aussetzer), wird **nichts gelöscht**: Vorübergehend ist nicht ungültig, wir melden nur, dass wir es nicht belegen
 * konnten.
 */
export async function ablaufAlsVorlage(
  s: CtSchreiber,
  eventId: number,
  daten: { name: string; kalenderId: number },
): Promise<number> {
  const name = geprueftenNamen(s, daten.name);
  const agenda = await s.agenda(eventId);
  const { items, eventStartPosition } = vorlagePunkteAus(agenda);
  const antwort = await s.schreibe('/agendatemplates', {
    method: 'POST',
    json: { name, calendarId: daten.kalenderId, series: null, eventStartPosition, items },
    verweigert: VORLAGE_VERWEIGERT,
    fehler: 'Ablaufvorlage anlegen fehlgeschlagen',
  });
  const id = neueId(antwort);
  if (id === null) {
    throw s.fehler(502, 'Die Ablaufvorlage wurde nicht angelegt. Bitte die Liste neu laden.');
  }
  const neu = await vorlageLesen(s, id);
  if (neu === null) {
    throw s.fehler(
      502,
      'Die neue Ablaufvorlage konnte nicht geprüft werden. Bitte die Liste neu laden und nachsehen.',
    );
  }
  if ((neu.items ?? []).length !== items.length) {
    // Die eigene, unvollständige Vorlage wieder wegräumen – schlägt auch das fehl, steht es in der Meldung.
    const weg = await vorlageLoeschen(s, id).then(
      () => true,
      () => false,
    );
    throw s.fehler(
      502,
      weg
        ? 'Die Ablaufvorlage wurde nicht vollständig angelegt und wieder entfernt. Bitte noch einmal versuchen.'
        : 'Die Ablaufvorlage wurde nicht vollständig angelegt. Bitte in der Liste nachsehen und sie löschen.',
    );
  }
  return id;
}

/**
 * **Eine Vorlage mit dem Ablauf eines Termins ersetzen** – ein `PUT` mit Name, Kalender, Grenze und der ganzen Liste
 * (ohne Punkt-IDs, alle Punkte entstehen neu). Name und Kalender der Vorlage bleiben.
 *
 * Vorher: `gesehen` (der `meta.modifiedDate`, den die Oberfläche kannte) weicht vom frischen Stand ab → 412, ein
 * anderer hat sie inzwischen geändert; gesperrt → 423. Nachher wird frisch gelesen und Punktzahl **und** Titelfolge
 * verglichen. **Hier wird bei einer Abweichung nichts gelöscht** – es ist die Vorlage, die jemand schon hatte; wir
 * sagen nur, dass sie nicht vollständig ersetzt ist.
 */
export async function vorlageErsetzen(
  s: CtSchreiber,
  vorlageId: number,
  eventId: number,
  gesehen?: string,
): Promise<void> {
  const v = await s.vorlage(vorlageId);
  if (gesehen !== undefined && v.meta?.modifiedDate !== gesehen) {
    throw s.fehler(412, VORLAGE_GEAENDERT);
  }
  if (v.isLocked === true) throw s.fehler(423, VORLAGE_GESPERRT);
  const agenda = await s.agenda(eventId);
  const { items, eventStartPosition } = vorlagePunkteAus(agenda);
  await ablaufSchreibe(s, { vorlageId }, `/agendatemplates/${vorlageId}`, {
    method: 'PUT',
    json: { name: v.name ?? '', calendarId: v.calendarId, eventStartPosition, items },
    verweigert: VORLAGE_VERWEIGERT,
    fehler: 'Ablaufvorlage ersetzen fehlgeschlagen',
  });
  const nachher = await s.vorlage(vorlageId);
  const soll = titelFolge(items);
  const ist = titelFolge(nachher.items ?? []);
  if (ist.length !== soll.length || ist.some((t, k) => t !== soll[k])) {
    throw s.fehler(
      502,
      'Die Ablaufvorlage wurde nicht vollständig ersetzt. Bitte neu laden und nachsehen.',
    );
  }
}
