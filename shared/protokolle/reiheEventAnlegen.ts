/**
 * **Events aus einer Reihe heraus anlegen** (Baustein „Reihe“, Scheibe 3) – die Regeln ohne ChurchTools und ohne Oberfläche:
 * welche Abende ein Event bekommen, welcher `Eintrag` für einen Abend entsteht (derselbe wie im Fenster „In Kalender
 * eintragen“, nur ohne Einladung, Ressourcen, Anmeldung und Bild), was dabei herauskommen kann und was die EINE
 * Zusammenfassung im Fenster „Reihe“ sagt.
 *
 * Die Eintrag-Vorbelegung, die Prüfung (`eintragFehler`) und die Events je Tag (`eventsFuer`) sind die vorhandenen – hier wird
 * nichts davon nachgebaut. **Die Eventvorlage mit der Nummer 0 („Standard“) ist gültig** – nur `null` heißt „keine gewählt“.
 */
import { tagPunkt } from '../ct/datum';
import { eintragFehler, eintragVorbelegung, type Eintrag } from './termine';
import { istTag, type ReiheEvent, type ReiheZeile } from './themenreihe';

/** Die Vorgabe für Beginn und Ende – ein Jugendabend (Entwurf `reihe-event-anlegen-s3-v1`). */
export const EVENT_BEGINN = '19:30';
export const EVENT_ENDE = '21:30';

/**
 * Die Kalender, in denen **beides** geht: Termine anlegen (`churchcal` „edit category“) **und** Events anlegen
 * (`churchservice` „edit events“) – der Termin entsteht im Kalender, das Event hängt an ihm.
 */
export function kalenderMitEvents(
  schreiben: readonly number[],
  events: readonly number[],
): number[] {
  const e = new Set(events);
  return schreiben.filter((k) => e.has(k));
}

/** Die Abende, die ein Event bekommen können: mit gültigem Datum und **ohne** Event. */
export const zeilenOhneEvent = (zeilen: readonly ReiheZeile[]): ReiheZeile[] =>
  zeilen.filter((z) => istTag(z.datum) && z.eventId === null);

/** Was im Fenster „Event anlegen“ eingegeben wird. */
export interface EventAnlegenEingabe {
  kalender: number | null;
  titel: string;
  von: string;
  bis: string;
  /** Die gewählte Eventvorlage – `0` („Standard“) ist gültig, `null` heißt: keine gewählt. */
  vorlage: number | null;
}

/**
 * **Der Eintrag für einen Abend:** die Vorbelegung des Reiters „Termine“ (`eintragVorbelegung`) mit Titel, Zeit und der einen
 * Eventvorlage für diesen Tag. Der Titel wird **nach** der Vorbelegung gesetzt – deren Text-Erkennung würde eine Uhrzeit im
 * Titel („Jugendabend 19:30“) als Zeit lesen.
 */
export function reiheEintrag(a: EventAnlegenEingabe, tag: string): Eintrag {
  return {
    ...eintragVorbelegung({ text: '', datum: tag }, a.kalender),
    titel: a.titel.trim(),
    ganztaegig: false,
    von: a.von,
    bis: a.bis,
    events: a.vorlage === null ? {} : { [tag]: a.vorlage },
  };
}

/** Was am Fenster „Event anlegen“ noch fehlt – `null`, wenn es losgehen kann. Prüft mit `eintragFehler`, wie das andere Fenster. */
export function eventAnlegenFehler(a: EventAnlegenEingabe, tag: string): string | null {
  const f = eintragFehler(reiheEintrag(a, tag));
  if (f) return f;
  return a.vorlage === null ? 'Bitte eine Eventvorlage wählen.' : null;
}

/** Was an **einem Abend** herauskam. `id` ist die Zeile der Reihe, `tag` ihr Datum. */
export type TagErgebnis = { id: string; tag: string } & (
  | { art: 'angelegt'; event: ReiheEvent }
  | { art: 'schonDa'; titel: string; kalender: string }
  /** Der Termin steht, das Event ließ sich nicht finden oder nicht nachlesen – die Zeile bleibt ohne Event. */
  | { art: 'ohneEvent' }
  /** ChurchTools hat nicht eindeutig geantwortet – ob der Termin steht, ist offen. `text` ist die Meldung dazu. */
  | { art: 'unklar'; text: string }
  /** Nichts angelegt (Prüfung oder Anlegen abgelehnt/gescheitert). */
  | { art: 'fehler'; text: string }
);

/** Der Satz zu einem Abend, an dem etwas zu sagen ist – `null` bei einem angelegten Event. */
export function tagMeldung(e: TagErgebnis): string | null {
  const tag = tagPunkt(e.tag);
  switch (e.art) {
    case 'angelegt':
      return null;
    case 'schonDa':
      return `Am ${tag} steht im Kalender „${e.kalender}“ schon „${e.titel}“. Dort wird nichts angelegt; ordne ihn über „Event wählen“ zu.`;
    case 'ohneEvent':
      return `Termin am ${tag} angelegt, das Event ließ sich nicht finden – bitte in ChurchTools nachsehen und über „Event wählen“ zuordnen.`;
    case 'unklar':
      return `Am ${tag}: ${e.text}`;
    case 'fehler':
      return `Am ${tag} wurde nichts angelegt: ${e.text}`;
  }
}

/** Die eine Zusammenfassung nach dem Anlegen: eine Kopfzeile und je Abend mit Besonderheit ein Satz. */
export function zusammenfassung(ergebnisse: readonly TagErgebnis[]): {
  kopf: string;
  meldungen: string[];
  speichern: boolean;
} {
  const n = ergebnisse.filter((e) => e.art === 'angelegt').length;
  const zahl = n === 0 ? 'Es wurde kein Event angelegt.' : n === 1 ? '1 Event angelegt.' : `${n} Events angelegt.`;
  return {
    kopf: n > 0 ? `${zahl} Jetzt die Reihe speichern.` : zahl,
    meldungen: ergebnisse.flatMap((e) => tagMeldung(e) ?? []),
    speichern: n > 0,
  };
}

/** Die Zeilen mit den neu angelegten Events – nur `angelegt` ändert eine Zeile (über `zeileMitEvent` im Aufrufer). */
export const angelegte = (ergebnisse: readonly TagErgebnis[]) =>
  ergebnisse.flatMap((e) => (e.art === 'angelegt' ? [{ id: e.id, event: e.event }] : []));
