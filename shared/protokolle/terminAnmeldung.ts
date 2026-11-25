/**
 * **Anmeldung zum Termin** (W15-5, Reiter „Anmeldung“ im Fenster „In Kalender eintragen“) – die Regeln ohne ChurchTools:
 * Vorgaben, welche Gruppentypen zur Wahl stehen, welche Gruppen ChurchTools beim Anlegen **sofort** erzeugt, was als
 * `signup` an `POST …/appointments` geht und was nach dem Anlegen zu den Gruppen zu sagen ist. Gemessen 25.11.2026
 * (`protokolle-planung/docs/messung-w15-0-2026-11-23.md`, „Nachtrag W15-5 Anmeldung“).
 *
 * - **ChurchTools legt sofort echte Gruppen an:** je Einzeltermin, der zwischen **heute** und **heute + Tage im Voraus**
 *   liegt (am 25.11. mit 14 Tagen: 26.11. und 03.12., nicht 10.12.), eine Gruppe „<Titel> – TT.MM.JJJJ, HH:MM“ (Ortszeit).
 *   Die Vorschau im Fenster, die Zahl im Fuß und das Nachlesen rechnen alle mit `anmeldungTermine` – **eine** Funktion.
 *   Verglichen wird der **Ortstag** (`JJJJ-MM-TT`), nicht die Uhrzeit: Sommerzeit ist egal. Der Tag „heute + N“ gehört
 *   dazu, „heute + N + 1“ nicht (gemessen 25.11.2026 in der Vorschau des CT-Dialogs: 09.12. ja, 10.12. nein).
 * - Die Rechnung der Einzeltermine steht in `terminReihe.ts` (höchstens 200) – bei „täglich“ mit 365 Tagen im Voraus
 *   zählt die Vorschau darum zu wenig; ChurchTools legt dann mehr an.
 * - **Der Name hat zwei Formate, nicht verwechseln:** Die Vorschau zeigt „– 30.11.2026 14:00“ (`vorschauText`), der Name
 *   der Gruppe ist „<Titel> – 30.11.2026, 14:00“ (`gruppenName`, mit Komma). Ganztägig hat die Gruppe nur das Datum (nicht
 *   gemessen; das Nachlesen prüft dann nur den Namensanfang).
 */
import type { Eintrag } from './termine';
import { einzeltermine } from './terminReihe';
import { plusTage, tagPunkt } from '../ct/datum';

/** Die Auswahl „Wie viele Tage im Voraus …“ und „… nach dem Termin …“ (wie im ChurchTools-Dialog). */
export const ANMELDUNG_TAGE: readonly number[] = [1, 7, 14, 30, 90, 365];
/** Vorgabe „Tage im Voraus“. */
export const ANMELDUNG_VORGABE_TAGE = 14;
/** ChurchTools stellt „Kleingruppe“ ein – die Nummer 1. */
export const ANMELDUNG_VORGABE_TYP = 1;

/** Der Schalter „Gruppen für Anmeldung erstellen“ ist an: `Eintrag.anmeldung` ist dann nicht `null`. */
export interface Anmeldung {
  /** Gruppentyp – `null`, solange keiner wählbar ist. */
  typ: number | null;
  /** Wie viele Tage im Voraus Gruppen erstellt und aktiviert werden. */
  tage: number;
  /** „Gruppe als Kopiervorlage“ – `null`: keine (ChurchTools legt eine neue Gruppe an). */
  vorlage: number | null;
  /** Wie viele Tage nach dem Termin Gruppen beendet werden – `null`: gar nicht. */
  beenden: number | null;
}

/** Ein Gruppentyp aus `GET /group/grouptypes` (Nummer und Name). */
export interface Gruppentyp {
  id: number;
  name: string;
}

/** Eine Gruppe aus `GET /groups` (Nummer und Name). */
export interface Gruppe {
  id: number;
  name: string;
}

/**
 * **Der Schalter wird angeschaltet:** Gruppentyp wie ChurchTools „Kleingruppe“ (1), wenn erlaubt, sonst der erste erlaubte
 * (in der Reihenfolge von ChurchTools); 14 Tage im Voraus, keine Kopiervorlage, nie beenden.
 */
export function anmeldungVorgabe(typen: readonly Gruppentyp[]): Anmeldung {
  const typ = typen.find((t) => t.id === ANMELDUNG_VORGABE_TYP) ?? typen[0];
  return { typ: typ?.id ?? null, tage: ANMELDUNG_VORGABE_TAGE, vorlage: null, beenden: null };
}

/** Die Gruppentypen, die zur Wahl stehen: die aus `GET /group/grouptypes`, die man anlegen darf – in der Reihenfolge von ChurchTools. */
export function gruppentypenAus(roh: unknown, erlaubt: ReadonlySet<number>): Gruppentyp[] {
  return (Array.isArray(roh) ? roh : []).flatMap((r): Gruppentyp[] => {
    const o = r as { id?: unknown; nameTranslated?: unknown; name?: unknown } | null;
    const id = typeof o?.id === 'number' && Number.isInteger(o.id) ? o.id : null;
    if (id === null || !erlaubt.has(id)) return [];
    const name = [o?.nameTranslated, o?.name].find((n) => typeof n === 'string' && n.trim() !== '');
    return [{ id, name: typeof name === 'string' ? name : `Gruppentyp ${id}` }];
  });
}

/** Die Gruppen aus der Antwort (`data` = Liste) – ohne Einträge ohne Nummer, nach Name sortiert. */
export function gruppenAus(roh: unknown): Gruppe[] {
  return (Array.isArray(roh) ? roh : [])
    .flatMap((r): Gruppe[] => {
      const o = r as { id?: unknown; name?: unknown } | null;
      return typeof o?.id === 'number' && Number.isInteger(o.id)
        ? [{ id: o.id, name: typeof o.name === 'string' ? o.name : `Gruppe ${o.id}` }]
        : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Die Tage zur Auswahl – die festen und, wenn eine Vorlage einen anderen Wert mitbringt, dieser (keine unsichtbare Wahl). */
export const tageOptionen = (aktuell: number | null): number[] =>
  aktuell === null || ANMELDUNG_TAGE.includes(aktuell)
    ? [...ANMELDUNG_TAGE]
    : [...ANMELDUNG_TAGE, aktuell].sort((a, b) => a - b);

/** Ein Einzeltermin, für den ChurchTools eine Gruppe anlegt. */
export interface AnmeldungTermin {
  /** `JJJJ-MM-TT`. */
  tag: string;
  /** `HH:MM` Ortszeit – leer bei ganztägigen Terminen. */
  zeit: string;
}

/**
 * **Für welche Einzeltermine legt ChurchTools beim Speichern sofort Gruppen an?** Alle Einzeltermine der Reihe von `heute`
 * bis `heute + tage` (Ortstage, beide einschließlich). `heute` kommt von außen (`heuteImKalender`) – so läuft die Rechnung
 * im Test mit fester Uhr. Ohne Schalter: keine.
 */
export function anmeldungTermine(
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
  >,
  anmeldung: Pick<Anmeldung, 'tage'> | null,
  heute: string,
): AnmeldungTermin[] {
  if (!anmeldung) return [];
  const bis = plusTage(heute, anmeldung.tage);
  return einzeltermine(e)
    .tage.filter((t) => t >= heute && t <= bis)
    .map((tag) => ({ tag, zeit: e.ganztaegig ? '' : e.von }));
}

/** Die Zeile der Vorschau: „– 30.11.2026 14:00“ (ganztägig nur das Datum). */
export const vorschauText = (t: AnmeldungTermin): string =>
  `– ${tagPunkt(t.tag)}${t.zeit ? ` ${t.zeit}` : ''}`;

/** Der Name der Gruppe, den ChurchTools vergibt: „<Titel> – 30.11.2026, 14:00“ (gemessen). Ganztägig ohne Uhrzeit. */
export const gruppenName = (titel: string, t: AnmeldungTermin): string =>
  `${titel.trim()} – ${tagPunkt(t.tag)}${t.zeit ? `, ${t.zeit}` : ''}`;

/** Der Satz unter dem Schalter – Einzahl bei genau einem Einzeltermin, sonst mit dem Zusatz zur Wiederholung. */
export const anmeldungErklaerung = (einzeltermineZahl: number): string =>
  einzeltermineZahl === 1
    ? 'Für einen Kalendereintrag wird automatisch eine Gruppe erstellt. Dies hat keine Auswirkung auf bereits erstellte Gruppen.'
    : 'Für einen Kalendereintrag wird automatisch eine Gruppe erstellt. Dies hat keine Auswirkung auf bereits erstellte Gruppen. Für jede Wiederholung wird eine separate Gruppe erstellt.';

/** Die Beschriftung des Schalters. */
export const anmeldungSchalterText = (einzeltermineZahl: number): string =>
  einzeltermineZahl === 1 ? 'Gruppe für Anmeldung erstellen' : 'Gruppen für Anmeldung erstellen';

/** Der Fuß vor dem Speichern: ChurchTools legt die Gruppen **sofort** an – `null`, wenn keine entstehen. */
export function anmeldungFuss(anzahl: number): string | null {
  if (anzahl <= 0) return null;
  return anzahl === 1
    ? 'Beim Speichern legt ChurchTools sofort 1 Gruppe an.'
    : `Beim Speichern legt ChurchTools sofort ${anzahl} Gruppen an.`;
}

/** Der Rumpf `signup` für `POST …/appointments` – leere Auswahlen fehlen. `null` ohne Schalter oder ohne Gruppentyp. */
export function signupRumpf(a: Anmeldung | null): Record<string, number> | null {
  if (!a || a.typ === null) return null;
  return {
    signupGroupTypeId: a.typ,
    signupDaysForwardNo: a.tage,
    ...(a.vorlage !== null ? { signupTemplateGroupId: a.vorlage } : {}),
    ...(a.beenden !== null ? { signupDaysArchiveGroupNo: a.beenden } : {}),
  };
}

/** Was ChurchTools am gelesenen Termin als `signup` zeigt: Gruppentyp und Tage im Voraus (die Rechenwerte stehen darin). */
export interface SignupGelesen {
  typ: number | null;
  tage: number | null;
}

/** `signup` des gelesenen Termins – `null`, wenn es fehlt (keine Anmeldung). Liest auch den veralteten Doppelgänger `singupDaysForwardNo`. */
export function signupAus(roh: unknown): SignupGelesen | null {
  if (roh === null || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  const zahl = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return {
    typ: zahl(o.signupGroupTypeId),
    tage: zahl(o.signupDaysForwardNo) ?? zahl(o.singupDaysForwardNo),
  };
}

/** Das Ergebnis des Nachlesens (`terminEintragen.ts`): `signup` gespeichert? Welche angekündigten Gruppen fehlen? */
export interface AnmeldungErgebnis {
  /** `true`: am Termin steht keine (passende) Anmeldung. */
  signupFehlt: boolean;
  /** Namen der angekündigten Gruppen, die gelesen nicht da sind. */
  fehlend: string[];
  /** Das Lesen der Gruppen ist gescheitert – dann wissen wir es nicht. */
  unklar: boolean;
}

/**
 * **Was nach dem Anlegen zur Anmeldung zu sagen ist** – `null`, wenn alles da ist. `unklar` (Lesefehler) ist nicht
 * „fehlt“: vorübergehend ist nicht ungültig. Der Termin steht in jedem Fall.
 */
export function anmeldungHinweis(r: AnmeldungErgebnis): string | null {
  if (r.signupFehlt)
    return 'ChurchTools hat die Anmeldung am Termin nicht gespeichert – bitte im Termin in ChurchTools nachsehen und die Gruppen bei Bedarf einrichten. Der Termin selbst steht im Kalender.';
  if (r.unklar)
    return 'Ob die Gruppen für die Anmeldung angelegt wurden, ließ sich nicht nachlesen. Bitte in ChurchTools nachsehen – der Termin selbst steht im Kalender.';
  if (!r.fehlend.length) return null;
  const liste = r.fehlend.map((n) => `„${n}“`).join(', ');
  return r.fehlend.length === 1
    ? `Die Gruppe ${liste} wurde nicht angelegt – bitte in ChurchTools nachsehen. Der Termin selbst steht im Kalender.`
    : `Diese Gruppen wurden nicht angelegt: ${liste} – bitte in ChurchTools nachsehen. Der Termin selbst steht im Kalender.`;
}
