/**
 * **Reiter „Wechseltage“ im Organigramm** (Bauplan O9-4, Entwurf `kj-gruppenwechsel-v1`, entschieden 16.11.2026) – die
 * Rechnungen und Texte ohne Oberfläche: bis wann die Wechseltage in ChurchTools stehen, die Erinnerung „läuft aus“, der
 * Text für die Leitungen und der Abgleich der Regeln in ChurchTools mit „eingetragen bis“.
 *
 * Nichts davon rechnet Daten neu: Wechseljahre, Wechseltage und Fenster kommen aus `gruppenwechsel.ts`, die Zahl der
 * Wechsler aus `gruppenwechselSicht.ts` (dieselbe wie in der Übersicht).
 */
import { tagKurz, tagPunkt } from '../ct/datum';
import {
  kinderFenster,
  wechselGruppenName,
  type Uebergang,
  type Wechseljahr,
} from './gruppenwechsel';
import { wechslerZahl, type GruppenSicht } from './gruppenwechselSicht';

/** „Fische“ aus „Fische 7–9“ – der erste Teil des Namens (Kacheln, Chips, Text für die Leitungen). */
export const kurz = (name: string): string => name.split(' ')[0];

/** „Mo, 06.09.2027“ – der Wechseltag mit Wochentag (Entwurf v3). */
export const wechseltagText = (tag: string): string =>
  `${tagKurz(tag).split(',')[0]}, ${tagPunkt(tag)}`;

// ── Bis wann stehen die Wechseltage in ChurchTools ─────────────────────────────────────────────────────────────

/**
 * - `unbekannt`: Die Einrichtung kennt „eingetragen bis“ nicht (erst „Einrichten“ schreibt es) – kein Hinweis.
 * - `ok`: Es steht mehr als das nächste Jahr drin.
 * - `baldAus`: Genau das nächste Jahr ist das letzte – danach fehlt es.
 * - `fehlt`: Das nächste Jahr steht schon nicht mehr drin (`ab`).
 */
export type TageStand =
  | { art: 'unbekannt' }
  | { art: 'ok'; bis: number }
  | { art: 'baldAus'; bis: number }
  | { art: 'fehlt'; bis: number; ab: number };

/**
 * **Läuft das Eingetragene aus?** Die EINE Regel für den Hinweis in der Übersicht und auf der Seite „Wechseltage“.
 * `naechstesJahr` ist das Jahr des nächsten Wechsels – das aktuelle Wechseljahr des Reiters, nicht neu gerechnet.
 */
export function wechseltageStand(
  eingetragenBis: number | undefined,
  naechstesJahr: number,
): TageStand {
  if (eingetragenBis === undefined) return { art: 'unbekannt' };
  if (eingetragenBis < naechstesJahr)
    return { art: 'fehlt', bis: eingetragenBis, ab: naechstesJahr };
  if (eingetragenBis === naechstesJahr) return { art: 'baldAus', bis: eingetragenBis };
  return { art: 'ok', bis: eingetragenBis };
}

/** Status eines Jahres in der Tabelle. */
export type JahrStatus = 'eingetragen' | 'fehlt' | 'unbekannt';

export const jahrStatus = (eingetragenBis: number | undefined, jahr: number): JahrStatus =>
  eingetragenBis === undefined ? 'unbekannt' : jahr <= eingetragenBis ? 'eingetragen' : 'fehlt';

/** Der gelbe Hinweis: `titel` (fett) und der Rest – auf der Seite ausführlich, in der Übersicht kurz. `null`: nichts zu sagen. */
export interface TageHinweis {
  titel: string;
  /** Auf der Seite „Wechseltage“. */
  text: string;
  /** In der Übersicht. */
  kurz: string;
}

const ADMIN_BESCHEID = 'Bitte einem Admin Bescheid geben – er trägt sie mit einem Klick nach.';
const MEHR = 'Mehr unter „Wechseltage“.';

export function tageHinweis(stand: TageStand, ferienkalender: string): TageHinweis | null {
  if (stand.art === 'baldAus')
    return {
      titel: 'Wechseltage fehlen bald.',
      text: `Eingetragen sind sie nur noch bis ${stand.bis}. ${ADMIN_BESCHEID}`,
      kurz: `Eingetragen sind sie nur noch bis ${stand.bis}. ${MEHR}`,
    };
  if (stand.art === 'fehlt')
    return {
      titel: `Ab ${stand.ab} fehlen Wechseltage.`,
      text: `Die Sommerferien dafür stehen schon im Kalender „${ferienkalender}“. ${ADMIN_BESCHEID}`,
      kurz: MEHR,
    };
  return null;
}

// ── Text für die Leitungen ─────────────────────────────────────────────────────────────────────────────────────

/**
 * **Der Text, den man den Leitungen schickt** (ChurchTools verschickt dazu nichts). Je Übergang die Zahl der Kinder, die
 * wechseln – ohne Ausnahmen, aus derselben Rechnung wie die Übersicht (`wechslerZahl`). Ist eine Stufe nicht lesbar,
 * steht dort keine erfundene Null.
 */
export function leitungenNachricht(jahr: Wechseljahr, sichten: readonly GruppenSicht[]): string {
  const zeilen = sichten
    .filter((s) => s.naechste)
    .map((s) => {
      const nach = kurz(s.naechste!.name);
      if (s.stand !== 'sichtbar')
        return `• ${kurz(s.stufe.name)} → ${nach}: Zahl gerade nicht lesbar`;
      const n = wechslerZahl(s);
      return `• ${kurz(s.stufe.name)} → ${nach}: ${n} ${n === 1 ? 'Kind' : 'Kinder'}`;
    });
  return [
    `Hallo zusammen, der Gruppenwechsel ist angekündigt: Wechseltag ist ${wechseltagText(jahr.wechseltag)}.`,
    'Bitte schaut in ChurchTools im Organigramm unter „Kinder & Jugend“ nach, wer aus eurer Gruppe wechselt. Soll ein Kind noch ein Jahr bleiben, tippt es an. Den Rest macht ChurchTools von selbst.',
    '',
    ...zeilen,
  ]
    .join('\n')
    .trim();
}

// ── Abgleich mit ChurchTools (nur Admins) ──────────────────────────────────────────────────────────────────────

/** Ein Jahr, in dem die Regeln in ChurchTools nicht zu „eingetragen bis“ passen. */
export interface RegelAbweichung {
  gruppeId: number;
  /** „Fische → Jungschar“ – so heißt die Wechsel-Gruppe (`wechselGruppenName`). */
  uebergang: string;
  jahr: number;
  /** `fehlt`: bis dahin eingetragen, aber nicht in der Regel · `zuviel`: darüber hinaus, aber in der Regel. */
  art: 'fehlt' | 'zuviel';
}

/** Gleicher Wert, Reihenfolge der Schlüssel egal (ChurchTools darf sie anders sortieren). */
function gleicherWert(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => gleicherWert(x, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) &&
        gleicherWert((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}

/** Kommt `gesucht` irgendwo in `wert` vor? So muss man die Gestalt der Antwort nicht kennen (Array, `data`, …). */
function kommtVor(wert: unknown, gesucht: unknown): boolean {
  if (gleicherWert(wert, gesucht)) return true;
  if (typeof wert !== 'object' || wert === null) return false;
  return Object.values(wert).some((x) => kommtVor(x, gesucht));
}

/**
 * **Passt die Regel-Liste einer Wechsel-Gruppe in ChurchTools zu „eingetragen bis“?** Geprüft wird gegen den Erzeuger
 * (`kinderFenster`, derselbe Baustein wie in `wechselGruppenRegeln`): Für jedes der übergebenen Jahre muss sein Fenster
 * in den Regeln stehen, wenn das Jahr ≤ `eingetragenBis` ist, und darf nicht dastehen, wenn es darüber liegt. Welche
 * Jahre übergeben werden, entscheidet der Aufrufer (der Reiter: das aktuelle Wechseljahr und alle späteren, die der
 * Ferienkalender kennt – ein vergangenes Jahr darf aus den Regeln gefallen sein).
 */
export function regelAbweichungen(
  u: Uebergang,
  gruppeId: number,
  jahre: readonly Wechseljahr[],
  eingetragenBis: number,
  regeln: unknown,
): RegelAbweichung[] {
  const aus: RegelAbweichung[] = [];
  for (const j of jahre) {
    const steht = kommtVor(regeln, kinderFenster(u, j));
    const soll = j.jahr <= eingetragenBis;
    if (steht !== soll)
      aus.push({
        gruppeId,
        uebergang: wechselGruppenName(u),
        jahr: j.jahr,
        art: soll ? 'fehlt' : 'zuviel',
      });
  }
  return aus;
}

/** „Die Regeln in ChurchTools passen nicht zu „eingetragen bis 2029“: Fische → Jungschar: 2029 fehlt.“ */
export function abweichungText(abweichungen: readonly RegelAbweichung[], bis: number): string {
  const jeUebergang = new Map<string, string[]>();
  for (const a of abweichungen) {
    const teile = jeUebergang.get(a.uebergang) ?? [];
    teile.push(a.art === 'fehlt' ? `${a.jahr} fehlt` : `${a.jahr} steht zusätzlich da`);
    jeUebergang.set(a.uebergang, teile);
  }
  const wo = [...jeUebergang].map(([name, teile]) => `${name}: ${teile.join(', ')}`).join('; ');
  return `Die Regeln in ChurchTools passen nicht zu „eingetragen bis ${bis}“: ${wo}.`;
}
