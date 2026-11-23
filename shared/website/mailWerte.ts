/**
 * **Zwei kleine Werte für die Mails im Freigabe-Weg** (Bauplan Website W3b-3, E-W20, Alwins Entscheidung 23.11.2026). Beide
 * liegen – wie Status (`status.ts`) und Sperre (`sperre.ts`) – als **eigener Wert** in „Entwürfe“, nicht in einer Einheit:
 *
 * - **`website-leitung`** – welche Rollen der Website-Gruppe die **Leitung** sind (`rollen` = Rollen-IDs). Die Stufe je Rolle
 *   steht sonst nur in den ChurchTools-Rechten, die nur ein Admin lesen kann; ein Redakteur, der einreicht, muss aber wissen,
 *   wen er benachrichtigt. **Einziger Schreiber: der Admin, wo er die Stufen festlegt** (Einrichten, „Wer darf was“), nach
 *   erfolgreichem Setzen der Rechte. Fehlt der Wert (bestehende Installationen), gilt die Vorbelegung (`vorschlag` in
 *   `rechte.ts`, siehe `mail.ts`). **Je Gruppe ein Wert (W3b-4a):** Der Wert der Gruppe „Website“ trägt **kein** `gruppe` (so
 *   war er seit W3b-3 und so bleibt er – abwärtskompatibel); der Wert einer Untergruppe trägt `gruppe` = deren Gruppen-ID.
 *   Die Rollen sind `group_role`-IDs der jeweiligen Gruppe (nicht `groupTypeRoleId`).
 * - **`website-mail`** – der Schalter „Mails im Freigabe-Weg“. **Kein Wert = an.** In „Entwürfe“ und nicht in der Einheit
 *   „Einstellungen“, weil die erst über „Freigeben“ online geht – der Schalter soll **sofort** wirken. Einziger Schreiber: die
 *   Leitung im Fenster „Einstellungen“.
 *
 * Wie überall: **vorher frisch lesen, nachher nachlesen** – ein `201` ist kein Beleg (Lehre vom 11.08.2026). Ein beschädigter
 * Wert gilt wie ein fehlender (die Vorgabe greift), wird aber beim Lesen der Website als Problem gemeldet und nie gelöscht;
 * das nächste Schreiben stellt ihn wieder her. Bei mehreren Werten gilt der mit der kleinsten Wert-ID (wie bei Köpfen,
 * Kategorien, Status und Sperre).
 */
import { z } from 'zod';
import { inhaltAus, werteLesen, wertAendern, wertAnlegen, type Wert } from '../ct/modulDaten';
import type { SpeicherOrt } from './speicher';

export const LEITUNG_ART = 'website-leitung';
export const MAIL_ART = 'website-mail';

export const leitungSchema = z.object({
  art: z.literal(LEITUNG_ART),
  fassung: z.literal(1),
  rollen: z.array(z.number().int()).max(200),
  /** Die Untergruppe, zu der die Rollen gehören (W3b-4a) – fehlt: die Gruppe „Website“ selbst. */
  gruppe: z.number().int().positive().optional(),
});
export type WebsiteLeitung = z.infer<typeof leitungSchema>;

export const mailSchema = z.object({
  art: z.literal(MAIL_ART),
  fassung: z.literal(1),
  an: z.boolean(),
});
export type WebsiteMail = z.infer<typeof mailSchema>;

const VERWEIGERT = 'Du darfst die Website nicht bearbeiten.';

/** Der gültige Inhalt – `null`, wenn der Wert keiner von dieser Art ist (oder beschädigt). */
function gueltig<T>(w: Wert, art: string, schema: z.ZodType<T>): T | null {
  const roh = inhaltAus<unknown>(w, art, 1);
  if (!roh) return null;
  const r = schema.safeParse(roh);
  return r.success ? r.data : null;
}

/** Ist das ein gültiger Leitungs-Wert? Das Lesen der Website überspringt ihn. */
export const istLeitungsWert = (w: Wert): boolean =>
  gueltig(w, LEITUNG_ART, leitungSchema) !== null;

/** Ist das ein gültiger Schalter-Wert? Das Lesen der Website überspringt ihn. */
export const istMailWert = (w: Wert): boolean => gueltig(w, MAIL_ART, mailSchema) !== null;

/**
 * Der Wert dieser Art mit der kleinsten Wert-ID – auch wenn er beschädigt ist (dann gilt „fehlt“, aber er wird überschrieben).
 * `gruppe` (nur `website-leitung`): `null` = der Wert der Gruppe „Website“ (ohne Feld `gruppe`), sonst der dieser Untergruppe.
 */
function ersterDerArt(
  werte: readonly Wert[],
  art: string,
  gruppe: number | null = null,
): Wert | null {
  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    try {
      const roh = JSON.parse(w.value) as { art?: unknown; gruppe?: unknown } | null;
      if (roh?.art === art && (roh.gruppe ?? null) === gruppe) return w;
    } catch {
      // kein JSON – nicht unser Wert
    }
  }
  return null;
}

/**
 * Die Rollen-IDs der Leitung, wie der Admin sie gesetzt hat – `null`, wenn es keinen (gültigen) Wert gibt: dann gilt die
 * Vorbelegung. `gruppe`: `null` (Vorgabe) = die Gruppe „Website“; sonst die Untergruppe (W3b-4a). Ein Wert einer Untergruppe
 * gilt nie für die Website und umgekehrt.
 */
export function leitungAusWerten(
  werte: readonly Wert[],
  gruppe: number | null = null,
): number[] | null {
  const w = ersterDerArt(werte, LEITUNG_ART, gruppe);
  return w ? (gueltig(w, LEITUNG_ART, leitungSchema)?.rollen ?? null) : null;
}

/** Sind die Mails im Freigabe-Weg an? **Kein (gültiger) Wert = an.** */
export function mailAnAusWerten(werte: readonly Wert[]): boolean {
  const w = ersterDerArt(werte, MAIL_ART);
  return w ? (gueltig(w, MAIL_ART, mailSchema)?.an ?? true) : true;
}

/**
 * Einen Wert dieser Art schreiben: frisch lesen, den vorhandenen (kleinste ID) ändern oder einen neuen anlegen, **nachlesen** –
 * nur was danach so dasteht, gilt. Wirft bei jedem Fehler; ein Fehler ändert den bisherigen Wert nicht.
 */
async function schreiben(
  o: SpeicherOrt,
  art: string,
  text: string,
  steht: (werte: readonly Wert[]) => boolean,
  scheitert: string,
  /** Steht es schon genau so da, wird nichts geschrieben (Rechte erneut setzen ändert dann nichts). */
  nurWennAnders = false,
  /** Welcher Wert dieser Art gemeint ist (nur `website-leitung`, W3b-4a) – `null`: der der Gruppe „Website“. */
  gruppe: number | null = null,
): Promise<void> {
  const vorher = await werteLesen(o.p, o.modul, o.kategorie);
  if (nurWennAnders && steht(vorher)) return;
  const da = ersterDerArt(vorher, art, gruppe);
  if (da) await wertAendern(o.p, o.modul, o.kategorie, da.id, text, VERWEIGERT);
  else await wertAnlegen(o.p, o.modul, o.kategorie, text, VERWEIGERT);
  const nachher = await werteLesen(o.p, o.modul, o.kategorie);
  if (!steht(nachher)) throw o.p.fehler(502, scheitert);
}

/**
 * **Die Leitung festhalten** (nur der Admin, nach dem Setzen der Rechte): die Rollen-IDs mit Stufe Leitung. Steht es schon so
 * da, wird nichts geschrieben. `gruppe`: `null` (Vorgabe) = die Gruppe „Website“ – ihr Wert bleibt ohne Feld `gruppe`; sonst
 * die Untergruppe (W3b-4a), je Gruppe ein eigener Wert.
 */
export async function leitungSetzen(
  o: SpeicherOrt,
  rollen: readonly number[],
  gruppe: number | null = null,
): Promise<void> {
  const soll = [...new Set(rollen)].sort((a, b) => a - b);
  const inhalt: WebsiteLeitung =
    gruppe === null
      ? { art: LEITUNG_ART, fassung: 1, rollen: soll }
      : { art: LEITUNG_ART, fassung: 1, rollen: soll, gruppe };
  const text = JSON.stringify(leitungSchema.parse(inhalt) satisfies WebsiteLeitung);
  await schreiben(
    o,
    LEITUNG_ART,
    text,
    (w) => {
      const jetzt = leitungAusWerten(w, gruppe);
      return (
        jetzt !== null && JSON.stringify([...jetzt].sort((a, b) => a - b)) === JSON.stringify(soll)
      );
    },
    'ChurchTools hat nicht übernommen, wer die Leitung ist.',
    true,
    gruppe,
  );
}

/** **Den Schalter „Mails im Freigabe-Weg“ setzen** (nur die Leitung, wirkt sofort). */
export async function mailSchalterSetzen(o: SpeicherOrt, an: boolean): Promise<void> {
  const text = JSON.stringify(
    mailSchema.parse({ art: MAIL_ART, fassung: 1, an }) satisfies WebsiteMail,
  );
  await schreiben(
    o,
    MAIL_ART,
    text,
    (w) => ersterDerArt(w, MAIL_ART) !== null && mailAnAusWerten(w) === an,
    'ChurchTools hat den Schalter für die Mails nicht übernommen.',
  );
}
