/**
 * **Einen Ablauf in der App anlegen** (Alwin, 13.10.2026) – die Regeln für Server und Erweiterung.
 *
 * Vorher musste man für jede Veranstaltung ohne Ablauf in ChurchTools hinein, ihn dort anlegen und
 * erst dann in der App weiterarbeiten. Jetzt zeigt die Terminliste diese Veranstaltungen (welche,
 * regelt `brauchtAblauf`), und ein Ablauf entsteht direkt – aus einer Vorlage, als Kopie einer
 * anderen Veranstaltung oder leer.
 *
 * ChurchTools kann das mit EINEM Aufruf: `PUT /events/{id}/agenda` legt an oder ändert, mit
 * `?template_id=` aus einer Vorlage, mit `?event_id=` als Kopie (Schnittstellenbeschreibung der
 * Test-Instanz, 13.10.2026). Genau dieses „oder ändert" ist die Gefahr: Ein zweiter Aufruf auf eine
 * Veranstaltung, die inzwischen einen Ablauf hat, darf ihn nicht überschreiben. Deshalb wird vorher
 * nachgelesen – und hinterher auch, denn ein Erfolgssignal ist kein Beleg (Lehre 11.08.2026).
 */
import type {
  AblaufAnlegenRegel,
  AblaufQuelle,
  AblaufVorlage,
  Kalender,
  Service,
} from '../types/index';
import { ctId } from './ctId';
import { mapEventToService } from './mapEvent';
import { mapLimit } from './mapLimit';
import { istNichtGefunden, standardFenster, type CtLeser } from './setlistKern';
import { isoTag } from './zeit';
import type { CtSchreiber } from './schreibKern';
import type { CtAblaufVorlage, CtEvent, CtKalender } from './typen';

/**
 * Soll diese Veranstaltung in der Liste stehen, wenn sie keinen Ablauf hat? Nur aus den gewählten
 * Kalendern, und – wenn ein Suchwort gesetzt ist – nur, wenn ihr Name es enthält (Groß-/Kleinschreibung
 * egal). Das Suchwort gibt es, weil bei der ECG Gottesdienst und Gebetsabend im selben Kalender liegen.
 */
export function brauchtAblauf(ev: CtEvent, regel: AblaufAnlegenRegel | undefined): boolean {
  if (!regel || regel.kalenderIds.length === 0) return false;
  const kalender = ctId(ev.calendar?.domainIdentifier);
  if (kalender === null || !regel.kalenderIds.includes(kalender)) return false;
  const wort = regel.suchwort.trim().toLocaleLowerCase('de');
  return wort === '' || ev.name.toLocaleLowerCase('de').includes(wort);
}

/**
 * Das Zeitfenster für Termine ohne Ablauf: ab heute bis zum Ende der Terminliste. Vergangene
 * Veranstaltungen brauchen keinen Ablauf mehr – Server und Erweiterung fragen dasselbe Fenster ab.
 */
export function fensterOhneAblauf(jetzt: Date = new Date()): { from: string; to: string } {
  return { from: isoTag(jetzt), to: standardFenster(jetzt).to };
}

/**
 * Veranstaltungen im Zeitfenster, die `brauchtAblauf` erfüllen und **keinen** Ablauf haben.
 *
 * Gefragt wird nur bei den passenden Veranstaltungen – meist eine Handvoll Sonntage –, nicht bei
 * allen; die Terminliste mit Ablauf bleibt davon unberührt (eigene Abfrage, damit Offline-Vorrat,
 * Liederheft und Navigation weiter nur Termine mit Ablauf sehen).
 *
 * „Kein Ablauf" heißt ausschließlich 404. Bremst ChurchTools, wirft der ganze Lauf (#300) – eine
 * lückenhafte Liste sähe aus wie eine vollständige. Andere Fehler lassen die Veranstaltung weg: Ob sie
 * einen Ablauf hat, wissen wir dann nicht, und „Ablauf anlegen" anzubieten wäre geraten.
 */
export async function termineOhneAblauf(
  leser: CtLeser,
  from: string,
  to: string,
  regel: AblaufAnlegenRegel | undefined,
): Promise<Service[]> {
  if (!regel || regel.kalenderIds.length === 0) return [];
  const kandidaten = (await leser.events(from, to)).filter((ev) => brauchtAblauf(ev, regel));
  const ohne: { service: Service; start: string }[] = [];
  let ueberlastung: unknown = null;
  await mapLimit(kandidaten, 8, async (ev) => {
    if (ueberlastung) return;
    try {
      await leser.agenda(ev.id);
    } catch (e) {
      if (leser.istUeberlastet(e)) ueberlastung ??= e;
      else if (istNichtGefunden(e)) {
        ohne.push({ service: mapEventToService(ev, 0, null, leser.zeitzone), start: ev.startDate });
      } else console.warn('[ablauf-anlegen] Ablauf nicht prüfbar (Termin weggelassen):', e);
    }
  });
  if (ueberlastung) {
    throw ueberlastung instanceof Error
      ? ueberlastung
      : leser.fehler(503, 'ChurchTools bremst gerade (zu viele Anfragen).');
  }
  return ohne.sort((a, b) => a.start.localeCompare(b.start)).map((r) => r.service);
}

/** Die Vorlagen aus `GET /agendatemplates`, nach Namen sortiert. Einträge ohne ID fallen weg. */
export function vorlagenAus(roh: CtAblaufVorlage[] | null | undefined): AblaufVorlage[] {
  return (roh ?? [])
    .flatMap((v) => {
      const id = ctId(v.id);
      if (id === null) return [];
      return [
        {
          id,
          name: (v.name ?? '').trim() || `Vorlage ${id}`,
          kalenderId: ctId(v.calendarId),
          punkte: Array.isArray(v.items) ? v.items.length : 0,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Die Kalender aus `GET /calendars`, nach Namen sortiert. */
export function kalenderAus(roh: CtKalender[] | null | undefined): Kalender[] {
  return (roh ?? [])
    .flatMap((k) => {
      const id = ctId(k.id);
      return id === null ? [] : [{ id, name: (k.name ?? '').trim() || `Kalender ${id}` }];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Meldung, wenn es schon einen Ablauf gibt – etwa weil jemand ihn gerade in ChurchTools angelegt hat. */
export const ABLAUF_SCHON_DA =
  'Für diese Veranstaltung gibt es schon einen Ablauf. Die Liste wird neu geladen.';

/**
 * Legt den Ablauf an. Wirft 409, wenn es schon einen gibt, und 502, wenn ChurchTools „angelegt"
 * meldet, beim Nachlesen aber keiner da ist.
 */
export async function ablaufAnlegen(
  schreiber: CtSchreiber,
  eventId: number,
  kalenderId: number,
  quelle: AblaufQuelle,
): Promise<void> {
  // 1. Gibt es schon einen? Dann NICHT schreiben – `PUT …/agenda` würde ihn ändern.
  if (await hatAblauf(schreiber, eventId)) throw schreiber.fehler(409, ABLAUF_SCHON_DA);

  // 2. Anlegen. Die Quelle steht in der Adresse, der Kalender im Rumpf (Pflichtfeld).
  const abfrage =
    quelle.art === 'vorlage'
      ? `?template_id=${quelle.vorlageId}`
      : quelle.art === 'kopie'
        ? `?event_id=${quelle.eventId}`
        : '';
  await schreiber.schreibe(`/events/${eventId}/agenda${abfrage}`, {
    method: 'PUT',
    json: { calendarId: kalenderId },
    verweigert: 'Keine Berechtigung, in ChurchTools einen Ablauf anzulegen.',
    fehler: 'Ablauf anlegen fehlgeschlagen',
  });

  // 3. Nachlesen: Erst ein Ablauf, den wir wieder lesen können, ist angelegt.
  if (!(await hatAblauf(schreiber, eventId))) {
    throw schreiber.fehler(
      502,
      'ChurchTools hat den Ablauf nicht angelegt. Bitte erneut versuchen.',
    );
  }
}

async function hatAblauf(schreiber: CtSchreiber, eventId: number): Promise<boolean> {
  try {
    await schreiber.agenda(eventId);
    return true;
  } catch (e) {
    if (istNichtGefunden(e)) return false;
    throw e;
  }
}
