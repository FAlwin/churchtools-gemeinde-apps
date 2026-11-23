/**
 * **Events zum Termin** (W15-3, Reiter „Events“ im Fenster „In Kalender eintragen“) – die Regeln ohne ChurchTools:
 * welche Eventvorlagen es gibt, welche Zeile welche Vorlage trägt, was als `events` an `POST …/appointments` geht und was
 * nach dem Anlegen zu den Events zu sagen ist. Gemessen 23.11.2026 (`protokolle-planung/docs/messung-w15-0-2026-11-23.md`,
 * „Nachtrag W15-3 Events“).
 *
 * - **Eine Zeile je Einzeltermin der Reihe** (`terminReihe.ts`); jede kann eine **Eventvorlage** tragen oder keine
 *   (= für diesen Termin kein Event). Gespeichert wird je Tag (`Eintrag.events`: Tag → Nummer der Vorlage).
 * - **Die Nummer 0 ist gültig** („Standard“, gemessen) – nie mit „keine“ verwechseln: „keine“ heißt, der Tag fehlt in
 *   `Eintrag.events`, nicht, die Nummer ist falsch.
 * - Ein Event hat den **exakten UTC-Beginn** seines Einzeltermins als `startDate` (`einzelterminBeginn`).
 */
import type { Eintrag } from './termine';
import { einzeltermine, einzelterminBeginn, type Reihe } from './terminReihe';
import { tagPunkt } from '../ct/datum';

/** Eine Eventvorlage aus `GET /eventtemplates` (Nummer und Name – nicht nach Kalender gefiltert, wie in ChurchTools). */
export interface EventVorlage {
  /** Auch `0` („Standard“) ist eine gültige Nummer. */
  id: number;
  name: string;
}

/** Die Eventvorlagen aus der Antwort (`data` = Liste) – ohne Einträge ohne ganzzahlige Nummer ≥ 0, in der Reihenfolge von ChurchTools. */
export function eventVorlagenAus(roh: unknown): EventVorlage[] {
  return (Array.isArray(roh) ? roh : []).flatMap((r): EventVorlage[] => {
    const o = r as { id?: unknown; templateName?: unknown } | null;
    const id = typeof o?.id === 'string' && o.id.trim() !== '' ? Number(o.id) : o?.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) return [];
    return [{ id, name: typeof o?.templateName === 'string' ? o.templateName : `Vorlage ${id}` }];
  });
}

/** Eine Zeile mit gewählter Vorlage: der Tag, der exakte UTC-Beginn und die Vorlage. */
export interface EventZeile {
  tag: string;
  startDate: string;
  eventTemplateId: number;
}

/**
 * **Die Events, die angelegt werden sollen** – nur Zeilen mit gewählter Vorlage, nur Tage, die es in der Reihe gibt
 * (wer nach der Wahl „Bis“ kürzt oder eine Ausnahme setzt, lässt nichts Veraltetes mitgehen).
 */
export function eventsFuer(
  e: Pick<
    Eintrag,
    | 'tag'
    | 'art'
    | 'frequenz'
    | 'option'
    | 'wiederBis'
    | 'weitere'
    | 'ausnahmen'
    | 'ganztaegig'
    | 'von'
    | 'events'
  >,
  zeitzone: string,
): EventZeile[] {
  return einzeltermine(e).tage.flatMap((tag): EventZeile[] => {
    const id = e.events[tag];
    return id === undefined
      ? []
      : [{ tag, startDate: einzelterminBeginn(e, tag, zeitzone), eventTemplateId: id }];
  });
}

/** Die Vorlage in allen Zeilen der Reihe setzen („für alle Termine übernehmen“). */
export function vorlageFuerAlle(e: Reihe, id: number): Eintrag['events'] {
  return Object.fromEntries(einzeltermine(e).tage.map((t) => [t, id]));
}

/** Die Vorlage in einer Zeile setzen – `null`: keine (die Zeile fällt aus `events`). */
export function vorlageFuerZeile(
  events: Eintrag['events'],
  tag: string,
  id: number | null,
): Eintrag['events'] {
  const { [tag]: _weg, ...rest } = events;
  return id === null ? rest : { ...rest, [tag]: id };
}

/**
 * **Was nach dem Anlegen zu den Events zu sagen ist** – `null`, wenn alle da sind. `fehlend` sind die Tage, für die
 * ChurchTools nach dem Anlegen kein Event zeigt; `unklar` heißt: das Nachlesen selbst ist gescheitert (dann wissen wir es
 * nicht – nicht „fehlt“, vorübergehend ist nicht ungültig).
 */
export function eventHinweis(ergebnis: {
  fehlend: readonly string[];
  unklar: boolean;
}): string | null {
  if (ergebnis.unklar)
    return 'Ob die Events angelegt wurden, ließ sich nicht nachlesen. Bitte in ChurchTools nachsehen und bei Bedarf anlegen – der Termin selbst steht im Kalender.';
  if (!ergebnis.fehlend.length) return null;
  const liste = ergebnis.fehlend.map(tagPunkt).join(', ');
  return ergebnis.fehlend.length === 1
    ? `Für den Termin am ${liste} wurde kein Event angelegt – bitte in ChurchTools anlegen. Der Termin selbst steht im Kalender.`
    : `Für diese Termine wurde kein Event angelegt: ${liste} – bitte in ChurchTools anlegen. Der Termin selbst steht im Kalender.`;
}

/** Mehrere Hinweise (Buchungen, Events) zu einer Meldung – `null`, wenn keiner da ist. Die eine Stelle dafür. */
export function hinweiseZusammen(hinweise: readonly (string | null)[]): string | null {
  const da = hinweise.filter((h): h is string => h !== null);
  return da.length ? da.join(' ') : null;
}
