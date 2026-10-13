/**
 * **Wie Daten und Stände auf der Startseite heißen** (A2, #480) – an einer Stelle, damit Liste, Hinweise
 * und Kacheln dasselbe sagen. Tage kommen als `YYYY-MM-DD` (Ortszeit der Gemeinde, siehe `TerminAngabe`).
 */
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import type { Anmeldestand, Veranstaltung } from '@shared/anmeldung/uebersicht';

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
  const d = datum(tag);
  return `${WOCHENTAG[d.getUTCDay()]}, ${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}`;
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

export const STAND_TEXT: Record<Anmeldestand, string> = {
  offen: 'Anmeldung offen',
  bald: 'Anmeldung noch nicht offen',
  geschlossen: 'Anmeldeschluss vorbei',
  voll: 'Ausgebucht',
};

/**
 * „Anmeldeschluss 7.11. (noch 26 Tage)“ – nur solange die Anmeldung offen ist. Der Anmeldeschluss kommt
 * von ChurchTools als Zeitpunkt in UTC; angezeigt wird sein Tag in der Zeitzone des Geräts.
 */
export function schlussText(v: Veranstaltung, heute: string, zeitzone: string): string | null {
  if (v.anmeldung !== 'offen' || !v.anmeldungBis) return null;
  const tag = new Intl.DateTimeFormat('sv-SE', { timeZone: zeitzone }).format(
    new Date(v.anmeldungBis),
  );
  const rest = tageBis(heute, tag);
  const wann = rest === 0 ? 'heute' : rest === 1 ? 'morgen' : `noch ${rest} Tage`;
  return `Anmeldeschluss ${Number(tag.slice(8, 10))}.${Number(tag.slice(5, 7))}. (${wann})`;
}

/** Ein Wort für „1 Veranstaltung“ / „3 Veranstaltungen“. */
export function anzahlText(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

/** „Wer meldet sich an?“ – Name und Erklärung (A3). */
export const WER_TEXT: Record<OeffentlicheEinstellungen['wer'], [string, string]> = {
  familie: ['Familien', 'Erwachsene und Kinder in einer Anmeldung'],
  einzeln: ['Einzelpersonen', 'Jede Person meldet sich selbst an'],
  kinder: ['Nur Kinder', 'Eltern geben ihre Kontaktdaten an, angemeldet werden die Kinder'],
};
