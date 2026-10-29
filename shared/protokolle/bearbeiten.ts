/**
 * **Eine Sitzung bearbeiten** (Bauplan K2b, entschieden 29.10.2026) – die Regeln ohne ChurchTools: was sich geändert
 * hat, wer welche Mail bekommt, wie der Termin zurückgeschrieben wird und was beim Absagen aus dem Protokoll wird.
 * Geschrieben wird in `protokolle/src/bearbeiten.ts`. Gemessen: `protokolle-planung/docs/messung-k2b-2026-10-29.md`.
 *
 * Was ChurchTools mailt (gemessen 29.10.2026, je Eingeladenem außer dem, der ändert):
 * - Termin-`PUT` **ohne** Einladungsliste – nie; Zusagen bleiben.
 * - `PUT` **mit** Liste und neuer Zeit – „Termin geändert“, Zusagen gehen auf offen zurück („Alle neu einladen“).
 * - Einladen – „Neue Besprechungsanfrage“; Ausladen und Termin löschen – „Termin gelöscht“.
 */
import { plusTage, tageBis } from '../ct/datum';
import { ortszeitAus, tagAusIso, utcAus } from '../ct/zeit';
import { minute, type Sitzung } from './sitzungen';
import { OHNE_VORBILD, type Planung } from './planen';
import type { ProtokollKopf } from './speicher';

/** Was im Fenster steht, aus der Sitzung, wie sie ist (Dauer aus dem Termin, sonst zwei Stunden). */
export function planungVon(
  s: Pick<Sitzung, 'titel' | 'beginn' | 'ende'>,
  zeitzone: string,
): Planung {
  const lokal = ortszeitAus(s.beginn, zeitzone);
  const minuten = s.ende ? Math.round((Date.parse(s.ende) - Date.parse(s.beginn)) / 60_000) : 0;
  return {
    titel: s.titel,
    tag: lokal.slice(0, 10),
    uhrzeit: lokal.slice(11, 16),
    dauer: minuten > 0 ? minuten : OHNE_VORBILD.dauer,
  };
}

export interface Aenderung {
  titel: boolean;
  /** Beginn oder Ende (Dauer) – nur dann fragt das Fenster „Alle neu einladen?“. */
  zeit: boolean;
  dazu: number[];
  weg: number[];
}

/** **Was hat sich geändert?** Eingeladene als Personen-IDs, vorher (aus dem Termin) und nachher (im Fenster). */
export function aenderungVon(q: {
  alt: { titel: string; beginn: string; ende?: string };
  neu: { titel: string; beginn: string; ende: string };
  vorher: readonly number[];
  nachher: readonly number[];
}): Aenderung {
  const vorher = new Set(q.vorher);
  const nachher = new Set(q.nachher);
  return {
    titel: q.neu.titel.trim() !== q.alt.titel.trim(),
    zeit:
      minute(q.neu.beginn) !== minute(q.alt.beginn) ||
      (q.alt.ende !== undefined && minute(q.neu.ende) !== minute(q.alt.ende)),
    dazu: [...nachher].filter((p) => !vorher.has(p)),
    weg: [...vorher].filter((p) => !nachher.has(p)),
  };
}

export const istLeer = (a: Aenderung): boolean =>
  !a.titel && !a.zeit && !a.dazu.length && !a.weg.length;

/** Wie viele Mails ChurchTools verschickt – wer selbst ändert, bekommt keine (gemessen 28./29.10.2026). */
export function mailsVon(
  a: Aenderung,
  q: { nachher: readonly number[]; neuEinladen: boolean; ich: number },
): { geaendert: number; eingeladen: number; ausgeladen: number } {
  const andere = (liste: readonly number[]) => liste.filter((p) => p !== q.ich).length;
  const dazu = new Set(a.dazu);
  return {
    geaendert: a.zeit && q.neuEinladen ? andere(q.nachher.filter((p) => !dazu.has(p))) : 0,
    eingeladen: andere(a.dazu),
    ausgeladen: andere(a.weg),
  };
}

/**
 * Die Grundfelder eines Termins, die ein `PUT` braucht. **Ein `PUT` ersetzt sie alle** – was fehlt, wird geleert
 * (gemessen 29.10.2026: Untertitel, Beschreibung, Ort, Link). Darum wird der gelesene Termin unverändert zurückgeschickt
 * (Rundreise gemessen: nur der Titel änderte sich) und nur Titel und Zeit ersetzt. Raumbuchungen bleiben ohne Feld
 * stehen; Einladungen nur, solange `meetingrequests` fehlt.
 */
export const TERMIN_FELDER = [
  'title',
  'subtitle',
  'description',
  'link',
  'address',
  'isInternal',
  'startDate',
  'endDate',
  'repeatId',
  'repeatFrequency',
  'repeatUntil',
  'repeatOption',
  'additionals',
  'exceptions',
  'onBehalfOfPid',
] as const;

/** Der gelesene Termin (`GET …/appointments/{id}` → `data.appointment`). */
export type TerminRoh = Partial<Record<(typeof TERMIN_FELDER)[number], unknown>> & {
  signup?: unknown;
};

/**
 * **Was am Termin besonders ist:** eine Anmeldung (die bleibt in ChurchTools – das Fenster ändert den Termin nicht) oder
 * eine Serie (K2b-2: das Fenster fragt „nur diese“ / „ab dieser“). Anmeldung geht vor.
 */
export function terminSperre(t: TerminRoh): 'serie' | 'anmeldung' | null {
  if (t.signup !== null && t.signup !== undefined) return 'anmeldung';
  if (typeof t.repeatId === 'number' && t.repeatId !== 0) return 'serie';
  return null;
}

/** Alle Grundfelder wie gelesen – die eine Stelle dafür (ändern, teilen, auslassen, beenden). */
function wieGelesen(t: TerminRoh): Record<string, unknown> {
  const rumpf: Record<string, unknown> = {};
  for (const k of TERMIN_FELDER) if (t[k] !== undefined) rumpf[k] = t[k];
  rumpf.isInternal ??= false;
  return rumpf;
}

/** Der Rumpf für den `PUT`: alles wie gelesen, nur Titel, Beginn und Ende neu; Einladungsliste nur, wenn angegeben. */
export function terminRumpf(
  t: TerminRoh,
  neu: { titel: string; beginn: string; ende: string },
  einladen?: readonly number[],
): Record<string, unknown> {
  const rumpf = wieGelesen(t);
  rumpf.title = neu.titel.trim();
  rumpf.startDate = neu.beginn;
  rumpf.endDate = neu.ende;
  if (einladen) rumpf.meetingrequests = einladen.map((inviteeId) => ({ inviteeId }));
  return rumpf;
}

/**
 * **Was beim Absagen aus dem Protokoll wird** (entschieden 29.10.2026): Ein nur geplantes verschwindet mit dem Termin;
 * ein begonnenes bleibt als Entwurf ohne Termin und Treffen. Ein freigegebenes wird nicht angefasst (dort gibt es kein
 * Absagen).
 */
export function kopfNachAbsage(kopf: ProtokollKopf): 'loeschen' | ProtokollKopf | null {
  if (kopf.status === 'geplant') return 'loeschen';
  if (kopf.status === 'entwurf') return { ...kopf, termin: null, treffen: null };
  return null;
}

// ── Serien (Bauplan K2b-2, entschieden 29.10.2026; gemessen `messung-k2b2-2026-10-29.md`) ──────────────────────────
//
// Einladungen gelten in ChurchTools für die ganze Serie – Ein-/Ausladen bleibt deshalb immer bei der Serie. Titel oder
// Zeit einer Sitzung ändern: „Nur diese“ oder „Ab dieser“. Beides **teilt** den Termin (`POST …/appointments/{id}` mit
// `splitDate`). Geteilt wird **ohne** Einladungsliste – mit Liste mailt ChurchTools irreführend „Wöchentlicher Termin …
// bis <altes Ende> wurde geändert“. Der neue Termin hat dann keine Einladungen; jeder wird einzeln eingeladen (Mail
// „Neue Besprechungsanfrage … am <Datum>“) – Pflicht, sonst fiele die Sitzung aus der Liste. „Ab dieser“ am ersten
// Termin lehnt ChurchTools ab (422) – dort ist es eine Änderung der ganzen Serie wie in K2b-1.

export type Umfang = 'diese' | 'ab';
/** Absagen bei einer Serie: nur diese (Ausnahme, still), ab hier beenden (still), ganze Serie löschen (Mail). */
export type SerienAbsage = 'diese' | 'ab' | 'serie';
/** Wie eine Änderung von Titel oder Zeit bei einer Serie geschrieben wird. */
export type SerienWeg = 'teilen-diese' | 'teilen-ab' | 'serie';

/** Der Tag der Sitzung in Ortszeit der Gemeinde – so meint ChurchTools `splitDate` und `exceptions`. */
export const serienTag = (beginn: string, zeitzone: string): string => tagAusIso(beginn, zeitzone);

/** **Ist das der erste Termin der Serie?** Dann geht „ab dieser“ nicht per Teilen (gemessen: 422). */
export function ersterDerSerie(t: TerminRoh, beginn: string, zeitzone: string): boolean {
  return (
    typeof t.startDate === 'string' &&
    serienTag(beginn, zeitzone) <= serienTag(t.startDate, zeitzone)
  );
}

/** Welcher Weg – `null`, wenn sich nur die Eingeladenen ändern (dann bleibt alles bei der Serie). */
export function serienWeg(
  a: Pick<Aenderung, 'titel' | 'zeit'>,
  umfang: Umfang,
  erster: boolean,
): SerienWeg | null {
  if (!a.titel && !a.zeit) return null;
  if (umfang === 'diese') return 'teilen-diese';
  return erster ? 'serie' : 'teilen-ab';
}

const daten = (x: unknown): { date: string }[] =>
  Array.isArray(x)
    ? (x as unknown[]).filter(
        (d): d is { date: string } =>
          typeof d === 'object' && d !== null && typeof (d as { date?: unknown }).date === 'string',
      )
    : [];

/**
 * **Hat der Termin diesen Tag noch?** Vor dem Teilen und Absagen geprüft – ein zweiter Versuch legte sonst einen zweiten
 * Termin an. Bleibt von einer Serie nur ein Termin übrig, macht ChurchTools daraus selbst einen **Einzeltermin**
 * (`repeatId` 0, `repeatUntil` leer – gemessen 29.10.2026; beim Prüfen in der Test-Instanz gefunden: „Serie ab hier
 * beenden“ galt deshalb als „nicht übernommen“). Dann zählt nur sein eigener Tag.
 */
export function nochInSerie(t: TerminRoh, tag: string, zeitzone: string): boolean {
  if (typeof t.repeatId !== 'number' || t.repeatId === 0)
    return typeof t.startDate === 'string' && serienTag(t.startDate, zeitzone) === tag;
  if (daten(t.exceptions).some((d) => d.date === tag)) return false;
  return typeof t.repeatUntil !== 'string' || t.repeatUntil.slice(0, 10) >= tag;
}

/**
 * **Der Rumpf zum Teilen** – der gelesene Termin mit neuem Titel und neuer Zeit, ohne Einladungsliste. „Nur diese“ wird
 * ein Einzeltermin; „ab dieser“ behält die Wiederholung, Ausnahmen und Zusatztermine davor fallen weg.
 */
export function teilRumpf(
  t: TerminRoh,
  neu: { titel: string; beginn: string; ende: string },
  umfang: Umfang,
  tag: string,
): Record<string, unknown> {
  const rumpf = terminRumpf(t, neu);
  if (umfang === 'diese')
    return {
      ...rumpf,
      repeatId: 0,
      repeatFrequency: null,
      repeatUntil: null,
      exceptions: [],
      additionals: [],
      splitDate: tag,
      splitUntilEnd: false,
    };
  return {
    ...rumpf,
    exceptions: daten(t.exceptions).filter((d) => d.date >= tag),
    additionals: Array.isArray(t.additionals)
      ? (t.additionals as { date?: unknown }[]).filter(
          (d) => typeof d.date === 'string' && d.date >= tag,
        )
      : [],
    splitDate: tag,
    splitUntilEnd: true,
  };
}

/** „Nur diese“ absagen: der Tag als Ausnahme (gemessen: keine Mail). */
export function ausnahmeRumpf(t: TerminRoh, tag: string): Record<string, unknown> {
  return { ...wieGelesen(t), exceptions: [...daten(t.exceptions), { date: tag }] };
}

/** „Serie ab hier beenden“: Ende am Vortag (gemessen: keine Mail, Zusagen bleiben). */
export function endeRumpf(t: TerminRoh, tag: string): Record<string, unknown> {
  return { ...wieGelesen(t), repeatUntil: plusTage(tag, -1) };
}

/**
 * **Wohin ein späterer Termin der Serie rückt** („ab dieser“): um so viele Tage wie diese Sitzung, auf die neue Uhrzeit
 * und Dauer – in Ortszeit gerechnet, damit eine Zeitumstellung dazwischen nichts verschiebt.
 */
export function verschoben(
  beginn: string,
  q: { alt: string; neu: { beginn: string; ende: string } },
  zeitzone: string,
): { beginn: string; ende: string } {
  const tage = tageBis(serienTag(q.alt, zeitzone), serienTag(q.neu.beginn, zeitzone));
  const tag = plusTage(serienTag(beginn, zeitzone), tage);
  const b = utcAus(`${tag}T${ortszeitAus(q.neu.beginn, zeitzone).slice(11, 16)}`, zeitzone);
  const dauer = Date.parse(q.neu.ende) - Date.parse(q.neu.beginn);
  return { beginn: b, ende: new Date(Date.parse(b) + dauer).toISOString().replace('.000Z', 'Z') };
}

/**
 * **Mails bei einer Serie.** Geteilt bekommt jeder Eingeladene (außer mir) „Neue Besprechungsanfrage“ für den neuen
 * Termin; bei „nur diese“ gehen Ein-/Ausladen zusätzlich an die Serie. Ohne Teilen wie beim Einzeltermin.
 */
export function mailsSerie(
  a: Aenderung,
  weg: SerienWeg | null,
  q: { nachher: readonly number[]; neuEinladen: boolean; ich: number },
): { geaendert: number; eingeladen: number; ausgeladen: number } {
  if (weg === null || weg === 'serie') return mailsVon(a, q);
  const andere = q.nachher.filter((p) => p !== q.ich).length;
  return {
    geaendert: 0,
    eingeladen: andere,
    ausgeladen: weg === 'teilen-diese' ? a.weg.filter((p) => p !== q.ich).length : 0,
  };
}
