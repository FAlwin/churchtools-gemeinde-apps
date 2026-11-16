/**
 * **Reiter „Wechseltage“ im Organigramm** (Bauplan O9-4, Entwurf `kj-gruppenwechsel-v1`, O9-F8 entschieden 16.11.2026) – die
 * Rechnungen und Texte ohne Oberfläche: welche Wechseltage in den Regeln von ChurchTools stehen (**einzige Quelle: die
 * Regeln selbst, kein Speicher-Feld**), die Erinnerung „läuft aus“ und der Text für die Leitungen.
 *
 * Nichts davon rechnet Daten neu: Wechseljahre, Wechseltage und Fenster kommen aus `gruppenwechsel.ts` (das Fenster
 * aus `kinderFenster`, dem Baustein, aus dem auch die Regeln geschrieben werden), die Zahl der Wechsler aus
 * `gruppenwechselSicht.ts` (dieselbe wie in der Übersicht).
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

// ── Was in den Regeln von ChurchTools steht ────────────────────────────────────────────────────────────────────

/**
 * Wie ein Jahr in den Regeln der Wechsel-Gruppen steht:
 * - `eingetragen`: sein Fenster steht in den Regeln **jeder** Wechsel-Gruppe,
 * - `unvollstaendig`: nur in einem Teil – `fehlend` nennt die Übergänge, in denen es fehlt,
 * - `fehlt`: in keiner.
 */
export type JahrStand =
  | { art: 'eingetragen' }
  | { art: 'unvollstaendig'; fehlend: string[] }
  | { art: 'fehlt' };

/** Die Regel-Liste einer Wechsel-Gruppe, so wie ChurchTools sie liefert (keine Regeln = leere Liste). */
export interface GruppenRegeln {
  uebergang: Uebergang;
  regeln: unknown;
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
 * **Welche Jahre in den Regeln stehen** – gegen den Erzeuger geprüft: Das Fenster eines Jahres ist genau das, was
 * `kinderFenster` baut (derselbe Baustein wie in `wechselGruppenRegeln`). Ein von Hand geschriebenes Fenster, das ihm
 * nicht entspricht, zählt nicht. Ohne Wechsel-Gruppen gibt es nichts zu prüfen – dann ist jedes Jahr „fehlt“.
 */
export function jahrStaende(
  gruppen: readonly GruppenRegeln[],
  jahre: readonly Wechseljahr[],
): { jahr: number; stand: JahrStand }[] {
  return jahre.map((j) => {
    const fehlend = gruppen
      .filter((g) => !kommtVor(g.regeln, kinderFenster(g.uebergang, j)))
      .map((g) => wechselGruppenName(g.uebergang));
    const stand: JahrStand =
      fehlend.length === 0 && gruppen.length > 0
        ? { art: 'eingetragen' }
        : fehlend.length < gruppen.length
          ? { art: 'unvollstaendig', fehlend }
          : { art: 'fehlt' };
    return { jahr: j.jahr, stand };
  });
}

/**
 * **Bis wohin die Regeln reichen** – das letzte Jahr einer lückenlosen Kette „eingetragen“ ab dem nächsten Wechsel
 * (`staende` aufsteigend, ab dem nächsten Jahr). Ist schon das nächste Jahr nicht eingetragen (auch nicht
 * vollständig), reichen sie nur bis davor: `naechstesJahr - 1`.
 */
export function regelnReichenBis(
  staende: readonly { jahr: number; stand: JahrStand }[],
  naechstesJahr: number,
): number {
  let bis = naechstesJahr - 1;
  for (const s of staende) {
    if (s.jahr < naechstesJahr) continue;
    if (s.stand.art !== 'eingetragen' || s.jahr !== bis + 1) break;
    bis = s.jahr;
  }
  return bis;
}

// ── Erinnerung „läuft aus“ ─────────────────────────────────────────────────────────────────────────────────────

/**
 * - `unbekannt`: Die Regeln ließen sich nicht lesen (oder man darf es nicht) – keine Erinnerung.
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
 * `regelnBis` kommt aus den Regeln (`regelnReichenBis`); `undefined` = nicht prüfbar.
 */
export function wechseltageStand(regelnBis: number | undefined, naechstesJahr: number): TageStand {
  if (regelnBis === undefined) return { art: 'unbekannt' };
  if (regelnBis < naechstesJahr) return { art: 'fehlt', bis: regelnBis, ab: naechstesJahr };
  if (regelnBis === naechstesJahr) return { art: 'baldAus', bis: regelnBis };
  return { art: 'ok', bis: regelnBis };
}

/** Der gelbe Hinweis: `titel` (fett) und der Rest – auf der Seite ausführlich, in der Übersicht kurz. `null`: nichts zu sagen. */
export interface TageHinweis {
  titel: string;
  /** Auf der Seite „Wechseltage“. */
  text: string;
  /** In der Übersicht. */
  kurz: string;
}

const MEHR = 'Mehr unter „Wechseltage“.';

export function tageHinweis(stand: TageStand, ferienkalender: string): TageHinweis | null {
  if (stand.art === 'baldAus')
    return {
      titel: 'Wechseltage fehlen bald.',
      text: `Die Regeln reichen nur noch bis ${stand.bis}.`,
      kurz: `Die Regeln reichen nur noch bis ${stand.bis}. ${MEHR}`,
    };
  if (stand.art === 'fehlt')
    return {
      titel: `Ab ${stand.ab} fehlen Wechseltage in den Regeln.`,
      text: `Die Sommerferien dafür stehen schon im Kalender „${ferienkalender}“ – rechtzeitig nachtragen.`,
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
