/**
 * **Wiederholung eines Kalendertermins – die Regeln des ChurchTools-Dialogs „Termin erstellen“** (W15-1, gemessen
 * 23.11.2026, `protokolle-planung/docs/messung-w15-0-2026-11-23.md`). Ohne ChurchTools und ohne Oberfläche, damit Fenster,
 * Vorlagen und Tests dieselben Funktionen nutzen.
 *
 * - **Arten** (`repeatId`): 0 keine, 1 täglich, 7 wöchentlich, 31 monatlich nach Datum, 32 monatlich nach Wochentag,
 *   365 jährlich, 999 manuell. Die ersten fünf nach „keine“ sind **automatisch**: Sie brauchen „Bis“ und „Alle x …“.
 *   „Manuell“ kennt nur „Weitere Termine“ und „Ausnahmen“.
 * - **„Bis“-Vorgabe:** Wechselt die Art von „Keine Wiederholung“ auf eine automatische, setzt ChurchTools Bis = Beginn +
 *   `repeatId` Tage (1/7/31/32/365). Der Wechsel zwischen zwei Arten lässt „Bis“ stehen.
 * - **Monatlich nach Wochentag** (`repeatOption`): 1–5 = der erste bis fünfte Wochentag im Monat, 6 = der letzte.
 */
import { plusTage, wochentagName } from '../ct/datum';

export const WIEDERHOLUNG = {
  keine: 0,
  taeglich: 1,
  woechentlich: 7,
  monatlichDatum: 31,
  monatlichWochentag: 32,
  jaehrlich: 365,
  manuell: 999,
} as const;

/** Die Auswahl „Wiederholungen“ in der Reihenfolge von ChurchTools. */
export const WIEDERHOLUNGS_ARTEN: readonly { id: number; label: string }[] = [
  { id: WIEDERHOLUNG.keine, label: 'Keine Wiederholung' },
  { id: WIEDERHOLUNG.taeglich, label: 'Täglich' },
  { id: WIEDERHOLUNG.woechentlich, label: 'Wöchentlich' },
  { id: WIEDERHOLUNG.monatlichDatum, label: 'Monatlich nach Datum' },
  { id: WIEDERHOLUNG.monatlichWochentag, label: 'Monatlich nach Wochentag' },
  { id: WIEDERHOLUNG.jaehrlich, label: 'Jährlich' },
  { id: WIEDERHOLUNG.manuell, label: 'Manuell' },
];

/** Täglich, wöchentlich, monatlich (beide), jährlich – die Arten mit „Bis“ und „Alle x …“. */
export const istAutomatisch = (art: number): boolean =>
  art === WIEDERHOLUNG.taeglich ||
  art === WIEDERHOLUNG.woechentlich ||
  art === WIEDERHOLUNG.monatlichDatum ||
  art === WIEDERHOLUNG.monatlichWochentag ||
  art === WIEDERHOLUNG.jaehrlich;

/** Hinter „Alle x“: Tage, Woche(n), Monat(e), Jahr(e) – wie in ChurchTools. */
export function frequenzEinheit(art: number): string {
  if (art === WIEDERHOLUNG.taeglich) return 'Tage';
  if (art === WIEDERHOLUNG.woechentlich) return 'Woche(n)';
  if (art === WIEDERHOLUNG.jaehrlich) return 'Jahr(e)';
  return 'Monat(e)';
}

/** Der Wiederholungs-Teil eines Eintrags (`Eintrag` in `termine.ts` enthält ihn und `tag` = Beginn). */
export interface Wiederholung {
  /** `JJJJ-MM-TT` – der Beginn. */
  tag: string;
  art: number;
  /** „Alle x …“ (`repeatFrequency`), mindestens 1. */
  frequenz: number;
  /** `repeatOption` bei „Monatlich nach Wochentag“: 1–5 oder 6 (letzter). */
  option: number;
  /** „Bis“, `JJJJ-MM-TT` – leer, solange keines gewählt ist. */
  wiederBis: string;
  /** „Weitere Termine“ (`additionals`), `JJJJ-MM-TT`, sortiert. */
  weitere: string[];
  /** „Ausnahmen“ (`exceptions`), `JJJJ-MM-TT`, sortiert. */
  ausnahmen: string[];
}

/** Die Vorgabe für „Bis“: Beginn + `repeatId` Tage (gemessen). */
export const bisVorgabe = (tag: string, art: number): string => plusTage(tag, art);

/** Der wie vielte Wochentag im Monat dieser Tag ist: 1–5 (der 1.–7. ist der erste, der 29.–31. der fünfte). */
export const ordinalAusDatum = (tag: string): number => Math.ceil(Number(tag.slice(8, 10)) / 7);

/** Die Reihenfolge der Wörter in „Erster Montag im Monat“. */
const ORDINAL = ['Erster', 'Zweiter', 'Dritter', 'Vierter', 'Fünfter'];

/**
 * **Die zweite Auswahl bei „Monatlich nach Wochentag“**: „Erster … Fünfter <Wochentag> im Monat (wenn vorhanden)“ und
 * „Letzter <Wochentag> im Monat“; der Wochentag kommt aus dem Beginn.
 */
export function optionsAuswahl(tag: string): { wert: number; label: string }[] {
  const tagName = wochentagName(tag);
  return [
    ...ORDINAL.map((o, i) => ({
      wert: i + 1,
      label: `${o} ${tagName} im Monat${i === 4 ? ' (wenn vorhanden)' : ''}`,
    })),
    { wert: 6, label: `Letzter ${tagName} im Monat` },
  ];
}

/**
 * **Die Art wechseln.** Von „Keine Wiederholung“ (oder ohne „Bis“) auf eine automatische Art setzt „Bis“ auf die
 * Vorgabe; zwischen zwei Arten bleibt es stehen. „Monatlich nach Wochentag“ nimmt den Wochentag des Beginns (Ordinal aus
 * dem Datum). „Keine Wiederholung“ räumt alles Wiederholte weg – „Weitere Termine“ und „Ausnahmen“ gibt es dann nicht.
 */
export function artWechseln<T extends Wiederholung>(e: T, art: number): T {
  if (art === WIEDERHOLUNG.keine) {
    return { ...e, art, wiederBis: '', weitere: [], ausnahmen: [] };
  }
  const neuBis = istAutomatisch(art) && (e.art === WIEDERHOLUNG.keine || e.wiederBis === '');
  return {
    ...e,
    art,
    wiederBis: !istAutomatisch(art) ? '' : neuBis ? bisVorgabe(e.tag, art) : e.wiederBis,
    option: art === WIEDERHOLUNG.monatlichWochentag ? ordinalAusDatum(e.tag) : e.option,
  };
}

/** Eine Tagesliste um einen Tag ergänzt: ohne Doppelte, nach Datum. */
export const tagDazu = (liste: readonly string[], tag: string): string[] =>
  [...new Set([...liste, tag])].sort();

/** Eine Tagesliste ohne diesen Tag. */
export const tagWeg = (liste: readonly string[], tag: string): string[] =>
  liste.filter((t) => t !== tag);
