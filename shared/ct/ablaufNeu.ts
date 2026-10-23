/**
 * **Einen bestehenden Ablauf neu aufsetzen** (Bauplan E6-5b, #691) – aus einer Vorlage, wie ein anderer Termin oder
 * leer. Die Regeln für beide Apps; die Oberfläche fragt vorher nach (entschieden mit Alwin 22.10.2026, kein
 * Rückgängig).
 *
 * Gemessen (E6-5b-0, Messprotokoll Teil 1–3): `PUT /events/{id}/agenda?template_id=` bzw. `?event_id=` auf einen
 * bestehenden Ablauf **ersetzt still** alle Punkte (neue IDs, Ablauf-ID bleibt), „leeren“ ist `PUT …/agenda` mit
 * `items: []`. Teilen sich mehrere Termine einen Ablauf, trifft beides **alle** – egal über welchen Termin. Nur
 * `DELETE /events/{id}/agenda` wirkt allein auf den einen: Es löst die Verbindung, die anderen behalten den Ablauf.
 * Abgeschlossen geht nichts davon (403).
 *
 * Darum hier:
 *  - **Vorher vergleichen**, was die Nachfrage gezeigt hat (`AblaufStand`) – hat jemand den Ablauf seitdem geändert,
 *    würde das Ersetzen auch seine Änderung wegwerfen: 412, nichts geschrieben.
 *  - **Nachher nachlesen**: Erst wenn die Zahl der Punkte stimmt und kein alter Punkt übrig ist, ist ersetzt. Ein
 *    200 allein ist kein Beleg (Lehre 11.08.2026).
 */
import type { AblaufQuelle } from '../types/index';
import { ablaufAnlegen } from './ablaufAnlegen';
import { istNichtGefunden } from './setlistKern';
import {
  ABLAUF_ABGESCHLOSSEN,
  ABLAUF_VERWEIGERT,
  ablaufSchreibe,
  type CtSchreiber,
} from './schreibKern';
import type { CtAgenda, CtEvent } from './typen';

/** Ein anderer Termin, der denselben Ablauf hat. `name`/`start` sind `null`, wenn er sich nicht lesen ließ. */
export interface VerbundenerTermin {
  id: number;
  name: string | null;
  start: string | null;
}

/** Was die Nachfrage zeigt: die Punkte, die ersetzt würden, und die Termine, die es mittrifft. */
export interface AblaufBestand {
  /** Die Punkt-IDs in ihrer Reihenfolge. */
  punkte: number[];
  /** `meta.modifiedDate` des Ablaufs (sekundengenau), `null`, wenn ChurchTools keins liefert. */
  geaendert: string | null;
  verbunden: VerbundenerTermin[];
}

/** Der Stand, auf dem die Nachfrage bestätigt wurde – damit vergleicht `ablaufNeuAufsetzen` vor dem Schreiben. */
export interface AblaufStand {
  punkte: number[];
  geaendert: string | null;
  /** Die IDs der verbundenen Termine, aufsteigend. */
  verbunden: number[];
}

/** Was `ablaufBestandLesen` braucht – frisch gelesen, wie beim Schreiben. */
export interface AblaufBestandLeser {
  agenda(eventId: number): Promise<CtAgenda>;
  termin(eventId: number): Promise<CtEvent>;
}

/**
 * Die **anderen** Termine, die diesen Ablauf teilen, aufsteigend. Erkennbar nur an den `startTimes`-Schlüsseln der
 * Punkte (je verbundenem Termin einer). Ein **leerer** geteilter Ablauf ist deshalb nicht erkennbar – ChurchTools
 * liefert keine Liste der Termine (gemessen E6-5b-0 Teil 3); verloren geht dort beim Ersetzen nichts.
 */
export function verbundeneTermine(agenda: CtAgenda, eventId: number): number[] {
  const ids = new Set<number>();
  for (const p of agenda.items) {
    for (const schluessel of Object.keys(p.startTimes ?? {})) {
      const id = Number(schluessel);
      if (Number.isInteger(id) && id > 0 && id !== eventId) ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** Der Vergleichsstand zu einem Bestand. */
export function standAus(b: AblaufBestand): AblaufStand {
  return { punkte: b.punkte, geaendert: b.geaendert, verbunden: b.verbunden.map((t) => t.id) };
}

/**
 * Liest, was die Nachfrage zeigen soll. Die verbundenen Termine werden einzeln gelesen (meist keiner, selten mehr als
 * zwei); einer, der sich nicht lesen lässt, steht ohne Namen da – er wird trotzdem mit ersetzt und muss genannt werden.
 */
export async function ablaufBestandLesen(
  l: AblaufBestandLeser,
  eventId: number,
): Promise<AblaufBestand> {
  const agenda = await l.agenda(eventId);
  const verbunden = await Promise.all(
    verbundeneTermine(agenda, eventId).map(async (id): Promise<VerbundenerTermin> => {
      try {
        const t = await l.termin(id);
        return { id, name: t.name, start: t.startDate };
      } catch {
        return { id, name: null, start: null };
      }
    }),
  );
  return {
    punkte: agenda.items.map((p) => p.id),
    geaendert: agenda.meta?.modifiedDate ?? null,
    verbunden,
  };
}

/** Seit der Nachfrage geändert – Status 412, wie beim Konflikt im Punkt (E6-3c). */
export const ABLAUF_INZWISCHEN_GEAENDERT =
  'Der Ablauf wurde eben woanders geändert. Nichts ersetzt – die Liste ist neu geladen, bitte noch einmal ansehen.';

/** „Nur für diesen Termin“: gelöst, aber der neue Ablauf kam nicht zustande. */
export const GELOEST_OHNE_NEUEN =
  'Der neue Ablauf ließ sich nicht anlegen. Die Verbindung zu den anderen Terminen ist gelöst – sie behalten ihren Ablauf. Dieser Termin hat gerade keinen.';

const NICHT_ERSETZT = 'ChurchTools hat den Ablauf nicht ersetzt. Bitte neu laden und nachsehen.';

function gleich(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((x, k) => x === b[k]);
}

/**
 * Setzt den Ablauf neu auf. `nurDieser` (nur bei geteiltem Ablauf): erst die Verbindung lösen, dann einen eigenen
 * Ablauf anlegen – die anderen Termine behalten den bisherigen. Sonst wird der Ablauf ersetzt, bei einem geteilten für
 * alle verbundenen Termine.
 *
 * Wirft 412, wenn sich der Ablauf seit `gesehen` geändert hat (oder nicht mehr da ist), 423, wenn er abgeschlossen ist,
 * 400 bei einer Kopie aus sich selbst und 502, wenn das Nachlesen das Ersetzen nicht belegt.
 */
export async function ablaufNeuAufsetzen(
  s: CtSchreiber,
  eventId: number,
  kalenderId: number,
  quelle: AblaufQuelle,
  gesehen: AblaufStand,
  nurDieser: boolean,
): Promise<void> {
  // 1. Frisch lesen und mit der Nachfrage vergleichen.
  let ist: CtAgenda;
  try {
    ist = await s.agenda(eventId);
  } catch (e) {
    if (istNichtGefunden(e)) throw s.fehler(412, ABLAUF_INZWISCHEN_GEAENDERT);
    throw e;
  }
  if (ist.isLocked === true) throw s.fehler(423, ABLAUF_ABGESCHLOSSEN);
  const verbunden = verbundeneTermine(ist, eventId);
  const alteIds = ist.items.map((p) => p.id);
  const geaendert = ist.meta?.modifiedDate ?? null;
  if (
    !gleich(alteIds, gesehen.punkte) ||
    !gleich(verbunden, gesehen.verbunden) ||
    (geaendert !== null && gesehen.geaendert !== null && geaendert !== gesehen.geaendert)
  ) {
    throw s.fehler(412, ABLAUF_INZWISCHEN_GEAENDERT);
  }

  // 2. Wie viele Punkte danach dastehen müssen – frisch aus der Quelle.
  if (
    quelle.art === 'kopie' &&
    (quelle.eventId === eventId || verbunden.includes(quelle.eventId))
  ) {
    throw s.fehler(400, 'Ein Ablauf kann nicht aus sich selbst kopiert werden.');
  }
  const erwartet =
    quelle.art === 'leer'
      ? 0
      : quelle.art === 'kopie'
        ? (await s.agenda(quelle.eventId)).items.length
        : ((await s.vorlage(quelle.vorlageId)).items ?? []).length;

  // 3. Schreiben.
  if (nurDieser && verbunden.length > 0) {
    await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda`, {
      method: 'DELETE',
      verweigert: ABLAUF_VERWEIGERT,
      fehler: 'Verbindung zu den anderen Terminen lösen fehlgeschlagen',
    });
    try {
      await ablaufAnlegen(s, eventId, kalenderId, quelle);
    } catch {
      throw s.fehler(502, GELOEST_OHNE_NEUEN);
    }
  } else {
    const abfrage =
      quelle.art === 'vorlage'
        ? `?template_id=${quelle.vorlageId}`
        : quelle.art === 'kopie'
          ? `?event_id=${quelle.eventId}`
          : '';
    await ablaufSchreibe(s, eventId, `/events/${eventId}/agenda${abfrage}`, {
      method: 'PUT',
      json: quelle.art === 'leer' ? { items: [] } : {},
      verweigert: ABLAUF_VERWEIGERT,
      fehler:
        quelle.art === 'leer' ? 'Ablauf leeren fehlgeschlagen' : 'Ablauf ersetzen fehlgeschlagen',
    });
  }

  // 4. Nachlesen: Erst die richtige Zahl neuer Punkte belegt das Ersetzen.
  const nach = await s.agenda(eventId);
  const alt = new Set(alteIds);
  if (nach.items.length !== erwartet || nach.items.some((p) => alt.has(p.id))) {
    throw s.fehler(502, NICHT_ERSETZT);
  }
}
