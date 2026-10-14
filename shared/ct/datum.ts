/**
 * **Wie Tage in den Apps heißen** – „Sa, 14.11.2026“, die Datumskachel „14 NOV“, Monatsüberschriften.
 * Tage kommen als `YYYY-MM-DD` in Ortszeit der Gemeinde (`ortszeitAus`/`tagAusIso` in `zeit.ts`).
 *
 * Für alle Apps (Dienstplaner E3-2); die Anmeldungen reichen sie über `anmeldungen/src/anzeige.ts` weiter.
 */

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/**
 * **Die Monatsnamen – einmal für alle Apps.** Standen bis 14.10.2026 viermal von Hand da (hier, in
 * `client/src/utils/monate.ts`, `client/src/pages/Agenda.tsx` und `shared/ct/mapEvent.ts`).
 */
export const MONATE = [
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
] as const;

/**
 * Kurzform für Monatsleiste, Raster und Terminkarten: „Jan“, „Mär“, „Okt“ – bei allen zwölf Monaten genau
 * die ersten drei Buchstaben, deshalb abgeleitet statt einer zweiten Liste.
 */
export const MONATE_KURZ: readonly string[] = MONATE.map((m) => m.slice(0, 3));

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
  return { tag: String(d.getUTCDate()), monat: MONATE_KURZ[d.getUTCMonth()].toUpperCase() };
}

/** Monatsüberschrift: „November 2026“; ohne Datum „Ohne Datum“. */
export function monatTitel(tag: string | null): string {
  if (!tag) return 'Ohne Datum';
  return `${MONATE[datum(tag).getUTCMonth()]} ${tag.slice(0, 4)}`;
}

/** Der Monat eines Tages ausgeschrieben: „November“ („3× im November“ bei „Wer kann?“). */
export function monatName(tag: string): string {
  return MONATE[datum(tag).getUTCMonth()];
}

/** Tage von `heute` bis `tag` (beide `YYYY-MM-DD`). */
export function tageBis(heute: string, tag: string): number {
  return Math.round((datum(tag).getTime() - datum(heute).getTime()) / 86_400_000);
}

// ── Rechnen mit Tagen und Monaten (aus der Musik-App, 14.10.2026 hierher – auch der Dienstplaner braucht sie) ──
// Gerechnet wird auf `YYYY-MM-DD` / `YYYY-MM` in UTC, damit nichts an einer Sommerzeit hängt.

/** `2026-10-04` + 3 → `2026-10-07`; negative Werte gehen zurück. */
export function plusTage(tag: string, n: number): string {
  return new Date(datum(tag).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** `2026-10` + 3 → `2027-01`; negative Werte gehen zurück. */
export function monatPlus(monat: string, n: number): string {
  const jahr = Number(monat.slice(0, 4));
  const idx = Number(monat.slice(5, 7)) - 1 + n;
  const j = jahr + Math.floor(idx / 12);
  const m = ((idx % 12) + 12) % 12;
  return `${j}-${String(m + 1).padStart(2, '0')}`;
}

/** Letzter Tag des Monats als `YYYY-MM-DD` – Schaltjahre inklusive (UTC, wie alles hier). */
export function letzterTag(monat: string): string {
  const jahr = Number(monat.slice(0, 4));
  const m = Number(monat.slice(5, 7));
  const tage = new Date(Date.UTC(jahr, m, 0)).getUTCDate();
  return `${monat}-${String(tage).padStart(2, '0')}`;
}
