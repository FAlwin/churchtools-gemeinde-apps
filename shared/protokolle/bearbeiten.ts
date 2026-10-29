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
import { ortszeitAus } from '../ct/zeit';
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

/** Eine Serie (oder eine Anmeldung am Termin) ändert K2b noch nicht – das kommt mit K2b-2 bzw. bleibt in ChurchTools. */
export function terminSperre(t: TerminRoh): 'serie' | 'anmeldung' | null {
  if (typeof t.repeatId === 'number' && t.repeatId !== 0) return 'serie';
  if (t.signup !== null && t.signup !== undefined) return 'anmeldung';
  return null;
}

/** Der Rumpf für den `PUT`: alles wie gelesen, nur Titel, Beginn und Ende neu; Einladungsliste nur, wenn angegeben. */
export function terminRumpf(
  t: TerminRoh,
  neu: { titel: string; beginn: string; ende: string },
  einladen?: readonly number[],
): Record<string, unknown> {
  const rumpf: Record<string, unknown> = {};
  for (const k of TERMIN_FELDER) if (t[k] !== undefined) rumpf[k] = t[k];
  rumpf.title = neu.titel.trim();
  rumpf.startDate = neu.beginn;
  rumpf.endDate = neu.ende;
  rumpf.isInternal ??= false;
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
