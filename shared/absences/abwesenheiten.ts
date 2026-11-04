/**
 * **Eigene Abwesenheiten – direkt aus der Erweiterung** (Bauplan Dienstplaner E7-2a, Alwin 04.11.2026). Der Kern für
 * beide Apps: Er spricht ChurchTools über einen `AbwesenheitPort` an, ohne eigenen Server. Die Regeln stehen nur hier;
 * der NAS-Server der Musik-App (`server/src/services/absences.ts`) bleibt, wie er ist, und fällt später weg.
 *
 * Gemessen 04.11.2026 als Spike (kein Admin, `dienstplaner-planung/docs/messung-e7.md`):
 * - **Nur das eigene Konto.** Fremde Personen → 403; eine fremde ID über den eigenen Pfad → 404 (lesen, ändern).
 * - **Doppelt anlegen legt zwei Einträge an** – die Sperre macht dieser Kern (`gleicherZeitraum`).
 * - **Ändern = `PUT`, dieselbe ID, ersetzt ganz:** Was fehlt, ist danach leer (Kommentar) bzw. weg (Uhrzeit).
 * - **Mit Uhrzeit nur die Uhrzeit schicken:** `startDate` + `startTime` zusammen → 400 („endDate darf nicht vor
 *   startTime liegen“); ChurchTools leitet die Tage selbst aus der Uhrzeit ab.
 * - **`DELETE` meldet immer 204** – auch wenn es den Eintrag nicht gibt oder er einer anderen Person gehört. Ob er
 *   weg ist, zeigt erst das Nachlesen.
 * - Die Gründe stehen in `GET /event/masterdata` (`absenceReasons`, mit deutschem `nameTranslated`).
 *
 * **Kein Kennzeichen mehr** (Alwin 04.11.2026): Neue Einträge sehen aus wie in ChurchTools gemacht; ein altes
 * „[Musikteam]“ wird beim Anzeigen weiter ausgeblendet (`markerFreitext`) und verschwindet beim nächsten Ändern.
 */
import type { CtAbsence } from '../ct/typen';
import { ctId } from '../ct/ctId';
import { tagAusIso } from '../ct/zeit';
import type { Absence, AbsenceReason, NeueAbsence } from '../types/index';
import { grundLesbar, istMarkerEintrag, markerFreitext } from './index';

/** Der Weg zu ChurchTools – im Browser `abwesenheitPort` (`@ui/ct/abwesenheitPort`), im Test ein Nachbau. */
export interface AbwesenheitPort {
  /** `GET /persons/{p}/absences?from&to` – die Liste, sonst wirft er. */
  liste(personId: number, von: string, bis: string): Promise<CtAbsence[]>;
  /** `GET /persons/{p}/absences/{id}` – `null`, wenn es ihn (für diese Person) nicht gibt (404). */
  einer(personId: number, id: number): Promise<CtAbsence | null>;
  /** `POST` – liefert, was ChurchTools zurückgibt (den Eintrag). */
  anlegen(personId: number, rumpf: CtRumpf): Promise<unknown>;
  /** `PUT` – liefert, was ChurchTools zurückgibt (den Eintrag). */
  ersetzen(personId: number, id: number, rumpf: CtRumpf): Promise<unknown>;
  /** `DELETE` – sagt nichts darüber, ob etwas gelöscht wurde (immer 204, gemessen). */
  loeschen(personId: number, id: number): Promise<void>;
  /** `GET /event/masterdata` – roh. */
  stammdaten(): Promise<unknown>;
}

/** Was an ChurchTools geht: ganztägig mit Tagen ODER mit Uhrzeit – nie beides (gemessen: 400). */
export type CtRumpf = (
  | { startDate: string; endDate: string }
  | { startTime: string; endTime: string }
) & { absenceReasonId: number; comment: string };

export type AbwesenheitErgebnis =
  | { ok: true; absence: Absence; neu?: boolean }
  | {
      ok: false;
      /**
       * `ungueltig` = die Eingabe passt nicht (`text` sagt, warum); `doppel` = denselben Zeitraum gibt es schon;
       * `weg` = den Eintrag gibt es nicht mehr; `unklar` = geschrieben, aber die Antwort zeigt nicht, was entstand;
       * `nicht-geloescht` = nach dem Löschen steht er noch da.
       */
      grund: 'ungueltig' | 'doppel' | 'weg' | 'unklar' | 'nicht-geloescht';
      text?: string;
    };

/** `YYYY-MM-DD`. */
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Längster Zeitraum – ein Jahr; alles darüber ist ein Tippfehler (wie im Server). */
const MAX_TAGE = 366;
/** So lang darf der Kommentar in ChurchTools sein (`maxLength` der Schnittstelle). */
const MAX_KOMMENTAR = 255;
/** Der Grund, den neue Einträge vorgewählt bekommen – „Abwesend“ (ChurchTools sortiert „Krank“ nach vorn). */
const STANDARD_GRUND = 'absent.reason.absence';

/** Anzahl Tage zwischen zwei ISO-Tagen (einschließlich beider). */
function tageInklusive(start: string, ende: string): number {
  const ms = Date.parse(`${ende}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** ChurchTools-Eintrag → App-Sicht. */
export function zuAbwesenheit(a: CtAbsence): Absence {
  const grund = a.absenceReason;
  return {
    id: a.id,
    startDate: a.startDate,
    endDate: a.endDate,
    startTime: a.startTime ?? null,
    endTime: a.endTime ?? null,
    comment: markerFreitext(a.comment),
    // ChurchTools übersetzt selbst (`nameTranslated`); fehlt es, macht `grundLesbar` den Schlüssel lesbar.
    reason: grund?.nameTranslated?.trim() || grundLesbar(grund?.name),
    reasonId: ctId(grund?.id),
    vonApp: istMarkerEintrag(a.comment),
  };
}

/** Die Gründe der Gemeinde aus `/event/masterdata`, sortiert wie in ChurchTools; „Abwesend“ ist vorgewählt. */
export function gruendeAus(stammdaten: unknown): AbsenceReason[] {
  const roh = (stammdaten as { absenceReasons?: unknown } | null)?.absenceReasons;
  if (!Array.isArray(roh)) return [];
  const liste = (
    roh as { id?: unknown; name?: unknown; nameTranslated?: unknown; sortKey?: unknown }[]
  )
    .map((g) => ({
      id: ctId(g.id),
      schluessel: typeof g.name === 'string' ? g.name : '',
      name:
        (typeof g.nameTranslated === 'string' && g.nameTranslated.trim()) ||
        grundLesbar(typeof g.name === 'string' ? g.name : null),
      sort: Number(g.sortKey ?? 0),
    }))
    .filter(
      (g): g is { id: number; schluessel: string; name: string; sort: number } =>
        g.id !== null && !!g.name,
    )
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
  // Hat die Gemeinde „Abwesend“ gelöscht, wird der erste vorgewählt – lieber irgendeiner als keiner.
  const standard = liste.find((g) => g.schluessel === STANDARD_GRUND) ?? liste[0];
  return liste.map((g) => ({ id: g.id, name: g.name, standard: g === standard }));
}

/** Die eigenen Abwesenheiten von `von` bis `bis`, nach Beginn sortiert. */
export async function meineAbwesenheiten(
  port: AbwesenheitPort,
  ich: number,
  von: string,
  bis: string,
): Promise<Absence[]> {
  const liste = await ctAbwesenheiten(port, ich, von, bis);
  // Am selben Tag nach Uhrzeit (ganztägig zuerst) – sonst stünde 11 Uhr vor 9 Uhr, wie ChurchTools sie liefert.
  return liste
    .map(zuAbwesenheit)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        Date.parse(a.startTime ?? a.startDate) - Date.parse(b.startTime ?? b.startDate),
    );
}

/**
 * **Die eigenen Einträge von `von` bis `bis` (je einschließlich), wie ChurchTools sie liefert** – die eine Stelle, die
 * die Liste liest (auch die Startseite des Dienstplaners).
 *
 * ChurchTools nimmt `to` bei Einträgen **mit Uhrzeit** als Mitternacht am Anfang des Tages (gemessen 04.11.2026): Ein
 * Eintrag am 14. von 9 bis 10:30 Uhr fehlt bei `to=14`, erst `to=15` liefert ihn; ganztägige kommen auch bei `to=14`.
 * Ohne den Tag mehr fand die Doppel-Sperre ein Fenster am letzten Tag nie – und jedes erneute Abhaken legte es noch
 * einmal an (in der Probe gegen die Test-Instanz gefunden). Darum einen Tag weiter lesen und auf `bis` zuschneiden.
 */
export async function ctAbwesenheiten(
  port: AbwesenheitPort,
  ich: number,
  von: string,
  bis: string,
): Promise<CtAbsence[]> {
  const liste = await port.liste(ich, von, tagDanach(bis));
  return liste.filter((a) => a.startDate <= bis && a.endDate >= von);
}

/** Der Tag nach `tag` (`YYYY-MM-DD`). */
function tagDanach(tag: string): string {
  return new Date(Date.parse(`${tag}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Prüft den Wunsch und baut den Rumpf für ChurchTools – oder sagt in einem Satz, was nicht passt. Mit Uhrzeit gehen
 * nur die Uhrzeiten mit (ChurchTools leitet die Tage daraus ab); die Tage hier sind dann die in der Gemeinde.
 */
export function pruefen(
  neu: NeueAbsence & { reasonId: number },
  zeitzone: string,
):
  | { ok: true; rumpf: CtRumpf; tage: { startDate: string; endDate: string } }
  | { ok: false; text: string } {
  const nein = (text: string) => ({ ok: false as const, text });
  const kommentar = (neu.comment ?? '').trim();
  if (kommentar.length > MAX_KOMMENTAR)
    return nein(`Der Kommentar darf höchstens ${MAX_KOMMENTAR} Zeichen lang sein.`);
  const grund = { absenceReasonId: neu.reasonId, comment: kommentar };
  if (Boolean(neu.startTime) !== Boolean(neu.endTime))
    return nein('Zu einer Uhrzeit gehören Anfang und Ende.');
  if (neu.startTime && neu.endTime) {
    const von = Date.parse(neu.startTime);
    const bis = Date.parse(neu.endTime);
    if (Number.isNaN(von) || Number.isNaN(bis)) return nein('Bitte eine gültige Uhrzeit wählen.');
    if (bis <= von) return nein('Das Ende liegt vor dem Anfang.');
    const tage = {
      startDate: tagAusIso(neu.startTime, zeitzone),
      endDate: tagAusIso(neu.endTime, zeitzone),
    };
    if (tageInklusive(tage.startDate, tage.endDate) > MAX_TAGE)
      return nein('Ein Zeitraum darf höchstens ein Jahr lang sein.');
    return { ok: true, rumpf: { startTime: neu.startTime, endTime: neu.endTime, ...grund }, tage };
  }
  if (!ISO_TAG.test(neu.startDate) || !ISO_TAG.test(neu.endDate))
    return nein('Bitte ein gültiges Datum wählen.');
  if (neu.endDate < neu.startDate) return nein('Das Ende liegt vor dem Anfang.');
  if (tageInklusive(neu.startDate, neu.endDate) > MAX_TAGE)
    return nein('Ein Zeitraum darf höchstens ein Jahr lang sein.');
  const tage = { startDate: neu.startDate, endDate: neu.endDate };
  return { ok: true, rumpf: { ...tage, ...grund }, tage };
}

/** Derselbe Zeitpunkt? Als Zeitpunkte verglichen (`Z` und `+01:00` können denselben meinen), `null` = ganztägig. */
function gleicheZeit(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return Date.parse(a) === Date.parse(b);
}

/**
 * **Gibt es diesen Zeitraum schon?** – über ALLE eigenen Einträge (seit 04.11.2026 ohne Kennzeichen: Auch ein in
 * ChurchTools gemachter Eintrag ist ein Doppel). Das Zeitfenster gehört dazu: 9 Uhr und 11 Uhr am selben Tag sind zwei
 * Einträge, ganztägig und ein Fenster ebenso. `ausser` = der Eintrag, der gerade geändert wird.
 */
export function gleicherZeitraum(
  vorhanden: Absence[],
  rumpf: CtRumpf,
  tage: { startDate: string; endDate: string },
  ausser?: number,
): Absence | undefined {
  const start = 'startTime' in rumpf ? rumpf.startTime : null;
  const ende = 'endTime' in rumpf ? rumpf.endTime : null;
  return vorhanden.find(
    (a) =>
      a.id !== ausser &&
      a.startDate === tage.startDate &&
      a.endDate === tage.endDate &&
      gleicheZeit(a.startTime, start) &&
      gleicheZeit(a.endTime, ende),
  );
}

/** Die Antwort auf `POST`/`PUT` als Eintrag – nur, wenn sie einer IST (mit ID). Sonst ist unklar, was entstand. */
function antwortAlsEintrag(antwort: unknown): CtAbsence | null {
  const a = (antwort as { data?: unknown } | null)?.data ?? antwort;
  if (!a || typeof a !== 'object') return null;
  const e = a as Partial<CtAbsence>;
  return typeof e.id === 'number' &&
    typeof e.startDate === 'string' &&
    typeof e.endDate === 'string'
    ? (e as CtAbsence)
    : null;
}

/**
 * **Eintragen.** Gibt es denselben Zeitraum schon, wird nichts geschrieben – zurück kommt der vorhandene (`neu:
 * false`), damit die App ihn einfach zeigt. Der neue Eintrag zählt erst, wenn ChurchTools ihn mit ID zurückgibt.
 */
export async function abwesenheitAnlegen(
  port: AbwesenheitPort,
  ich: number,
  neu: NeueAbsence & { reasonId: number },
  zeitzone: string,
): Promise<AbwesenheitErgebnis> {
  const p = pruefen(neu, zeitzone);
  if (!p.ok) return { ok: false, grund: 'ungueltig', text: p.text };
  const vorhanden = await meineAbwesenheiten(port, ich, p.tage.startDate, p.tage.endDate);
  const doppel = gleicherZeitraum(vorhanden, p.rumpf, p.tage);
  if (doppel) return { ok: true, absence: doppel, neu: false };
  const eintrag = antwortAlsEintrag(await port.anlegen(ich, p.rumpf));
  // Nicht noch einmal schicken: Vielleicht steht er schon da – ein zweiter Versuch legte ihn doppelt an.
  if (!eintrag) return { ok: false, grund: 'unklar' };
  return { ok: true, absence: zuAbwesenheit(eintrag), neu: true };
}

/**
 * **Ändern** – derselbe Eintrag (`PUT`). Vorher frisch gelesen: Gibt es ihn nicht mehr (anderswo gelöscht) oder gehört
 * er nicht zum eigenen Konto, wird nichts geschrieben (`weg`).
 *
 * - **Grund:** fehlt er im Wunsch, bleibt der bisherige (ein „Urlaub“ bleibt Urlaub).
 * - **Uhrzeit:** Das Fenster „Abwesenheit ändern“ kennt nur Tage. Bleiben die Tage gleich, bleibt die Uhrzeit – sonst
 *   würde aus dem Vormittag beim bloßen Ändern des Kommentars ein ganzer Tag (Lehre aus dem Server, 22.09.2026).
 *   Wandern die Tage, entfällt sie.
 * - **Kommentar:** wird ganz ersetzt, ein altes „[Musikteam]“ fällt dabei weg (kein Kennzeichen mehr).
 */
export async function abwesenheitAendern(
  port: AbwesenheitPort,
  ich: number,
  id: number,
  neu: NeueAbsence,
  zeitzone: string,
): Promise<AbwesenheitErgebnis> {
  const roh = await port.einer(ich, id);
  if (!roh) return { ok: false, grund: 'weg' };
  const alt = zuAbwesenheit(roh);
  const reasonId = neu.reasonId ?? alt.reasonId;
  if (reasonId === null)
    return { ok: false, grund: 'ungueltig', text: 'Bitte einen Grund wählen.' };
  const fensterBleibt =
    !neu.startTime &&
    !neu.endTime &&
    neu.startDate === alt.startDate &&
    neu.endDate === alt.endDate &&
    !!alt.startTime &&
    !!alt.endTime;
  const p = pruefen(
    {
      ...neu,
      reasonId,
      ...(fensterBleibt ? { startTime: alt.startTime!, endTime: alt.endTime! } : {}),
    },
    zeitzone,
  );
  if (!p.ok) return { ok: false, grund: 'ungueltig', text: p.text };
  const vorhanden = await meineAbwesenheiten(port, ich, p.tage.startDate, p.tage.endDate);
  if (gleicherZeitraum(vorhanden, p.rumpf, p.tage, id)) return { ok: false, grund: 'doppel' };
  const eintrag = antwortAlsEintrag(await port.ersetzen(ich, id, p.rumpf));
  if (!eintrag || eintrag.id !== id) return { ok: false, grund: 'unklar' };
  return { ok: true, absence: zuAbwesenheit(eintrag) };
}

/**
 * **Löschen.** ChurchTools meldet immer 204 – auch ohne Wirkung. Darum: vorher nachsehen (gibt es ihn nicht mehr, ist
 * das Ziel schon erreicht) und nachher nachlesen. Steht er danach noch da, sagt das Ergebnis es (`nicht-geloescht`).
 */
export async function abwesenheitLoeschen(
  port: AbwesenheitPort,
  ich: number,
  id: number,
): Promise<{ ok: true; schonWeg: boolean } | { ok: false; grund: 'nicht-geloescht' }> {
  if (!(await port.einer(ich, id))) return { ok: true, schonWeg: true };
  await port.loeschen(ich, id);
  if (await port.einer(ich, id)) return { ok: false, grund: 'nicht-geloescht' };
  return { ok: true, schonWeg: false };
}
