/**
 * **Wie Tage in den Apps heißen** – „Sa, 14.11.2026“, die Datumskachel „14 NOV“, Monatsüberschriften.
 * Tage kommen als `YYYY-MM-DD` in Ortszeit der Gemeinde (`ortszeitAus`/`tagAusIso` in `zeit.ts`).
 *
 * Für alle Apps (Dienstplaner E3-2); die Anmeldungen reichen sie über `anmeldungen/src/anzeige.ts` weiter.
 */

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONAT = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** Ein Kalendertag ohne Zeitzonen-Fallen: gerechnet wird in UTC, der Tag selbst ist schon Ortszeit. */
function datum(tag: string): Date {
  return new Date(`${tag}T00:00:00Z`);
}

/** „Sa, 14.11.2026“ */
export function datumText(tag: string): string {
  return `${tagKurz(tag)}${tag.slice(0, 4)}`;
}

/** „Sa, 14.11.“ – ohne Jahr, für Listen, in denen der Monat darüber steht. */
export function tagKurz(tag: string): string {
  return `${WOCHENTAG[datum(tag).getUTCDay()]}, ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
}

/** Für die Datumskachel: „14“ und „NOV“. */
export function kachel(tag: string): { tag: string; monat: string } {
  const d = datum(tag);
  return { tag: String(d.getUTCDate()), monat: MONAT[d.getUTCMonth()].slice(0, 3).toUpperCase() };
}

/** Monatsüberschrift: „November 2026“; ohne Datum „Ohne Datum“. */
export function monatTitel(tag: string | null): string {
  if (!tag) return 'Ohne Datum';
  return `${MONAT[datum(tag).getUTCMonth()]} ${tag.slice(0, 4)}`;
}

/** Tage von `heute` bis `tag` (beide `YYYY-MM-DD`). */
export function tageBis(heute: string, tag: string): number {
  return Math.round((datum(tag).getTime() - datum(heute).getTime()) / 86_400_000);
}
