/**
 * **Wer darf die Website bearbeiten – und was?** (Bauplan Website W3a-1 §3.3, W3b-1 E-W19/E-W21/E-W22, W3b-4b E-W31)
 *
 * - **Admin** = Recht „Gruppen verwalten“ (`administer groups` in `GET /permissions/global` → `churchdb`) – dieselbe Regel
 *   wie im Anmelde-Tool (`verwaltetGruppen`). Der Admin darf alles, was die Leitung der Website darf.
 * - **Leitung** und **Redakteur** ergeben sich aus den **eigenen Rechten** der Person am Modul (`GET /permissions/global` →
 *   Block `website`, z. B. `create custom data: [104, 107]`) – nicht daraus, ob sie die Gruppe leitet. „Schreiben“ heißt wie
 *   überall (`modulRechteAus`): anlegen, ändern **und** löschen. Fremde Kategorien zählen nicht. Wer nicht in „Entwürfe“
 *   schreibt, hat keinen Zugang – der Editor arbeitet in „Entwürfe“.
 *
 * **Bereiche (W3b-4b):** Jede Seite gehört der Gruppe „Website“ oder einer ihrer Untergruppen (`Seite.bereich`, `bereichVon`).
 * Der Zugang sagt darum zweierlei – **welche Seiten man sieht** (`sieht`) und **wo man freigibt** (`leitet`), je als „alle“
 * oder als Liste von Untergruppen:
 *
 * | Wer                                                              | `sieht`                    | `leitet`       |
 * |------------------------------------------------------------------|----------------------------|----------------|
 * | Admin; schreibt in Entwürfe **und** „Veröffentlicht“ der Website  | alle                       | alle           |
 * | schreibt in Entwürfe und in die Kategorie von Untergruppen        | ihre + Mitgliedschaften    | diese          |
 * | schreibt nur in Entwürfe, Mitglied der Gruppe „Website“           | alle                       | –              |
 * | schreibt nur in Entwürfe, Mitglied eingerichteter Untergruppen    | diese                      | –              |
 * | schreibt nur in Entwürfe, in keiner dieser Gruppen                | **keine** (Hinweis)        | –              |
 *
 * Bei den Mitgliedschaften (`GET /persons/{ich}/groups`, Messung W3b-4-0 c) **geht die Website vor**: Wer Mitglied der Gruppe
 * „Website“ ist, sieht alle Seiten, auch wenn er zusätzlich in einer Untergruppe ist. Ein Fehler beim Lesen der
 * Mitgliedschaften wird **nicht** zu „kein Bereich“: `ladeIch` wirft dann, und der Start zeigt „Erneut versuchen“.
 *
 * **Das ist die Regel der Oberfläche, nicht der Schutz der Daten.** Den Schutz bilden die Rechte an den Kategorien in
 * ChurchTools (alle Entwürfe liegen in EINER Kategorie, E-W19); die Oberfläche zeigt nur, was die Person auch tun darf. Jede
 * Regel steht hier genau einmal – die Oberfläche fragt nur diese Funktionen.
 */
import { verwaltetGruppen } from '../anmeldung/rechte';
import { meineGruppen, type RohMitgliedschaft } from '../ct/gruppen';
import { modulRechteAus } from '../ct/modulRechte';
import type { UntergruppenKategorie } from './einrichten';
import type { Seite } from './modell';
import { MODUL_KUERZEL } from './rechte';

/** Für welche Seiten etwas gilt: `'alle'` = die ganze Website, sonst nur die Seiten dieser Untergruppen (Gruppen-IDs). */
export type Bereiche = 'alle' | readonly number[];

/**
 * **Der Zugang einer Person** – `null` (an den Aufrufern): keiner. `sieht`: welche Seiten in Seitenliste, „Im Menü“ und
 * „Freigaben“ stehen; `leitet`: wo die Person freigibt. `leitet: 'alle'` ist die **Leitung der Website** (oder der Admin) – nur
 * sie ändert Aussehen, Einstellungen, Menü, eigenes HTML, Startseite und den Bereich einer Seite.
 */
export interface Zugang {
  sieht: Bereiche;
  leitet: Bereiche;
}

/** Admin oder Leitung der Website: alles. */
export const WEBSITE_LEITUNG: Zugang = { sieht: 'alle', leitet: 'alle' };
/** Redakteur der Website (Mitglied der Gruppe „Website“): alle Seiten, nichts freigeben. */
export const WEBSITE_REDAKTEUR: Zugang = { sieht: 'alle', leitet: [] };

/** Ist die Person Admin? Aus `GET /permissions/global` (ausgepackt). */
export function istAdmin(global: unknown): boolean {
  const churchdb = (global as { churchdb?: Record<string, unknown> } | null | undefined)?.churchdb;
  return verwaltetGruppen(churchdb);
}

/**
 * **In welchen Kategorien darf die Person schreiben?** (anlegen + ändern + löschen) – die IDs aus dem Block des Moduls in
 * `GET /permissions/global`. Fehlt der Block, sind es keine.
 */
export function schreibtIn(global: unknown): number[] {
  const block = (global as Record<string, unknown> | null | undefined)?.[MODUL_KUERZEL];
  return modulRechteAus(block).aendern;
}

/** Leitet die Person diese Gruppe? (Nur noch für den Hinweis „Rechte fehlen“ – den Zugang bestimmen die Rechte.) */
export function leitetGruppe(
  mitgliedschaften: readonly RohMitgliedschaft[] | null | undefined,
  rollen: readonly { id?: unknown; isLeader?: unknown }[] | null | undefined,
  gruppe: number,
): boolean {
  return meineGruppen(
    mitgliedschaften ? [...mitgliedschaften] : [],
    rollen ? [...rollen] : [],
  ).some((g) => g.id === gruppe && g.leitung);
}

/** Die IDs der eigenen Gruppen (aktive Mitgliedschaften) – ausgewertet mit `meineGruppen`, nicht nachgebaut. */
export function meineGruppenIds(
  mitgliedschaften: readonly RohMitgliedschaft[],
  rollen: readonly { id?: unknown; isLeader?: unknown }[],
): number[] {
  return meineGruppen([...mitgliedschaften], [...rollen]).map((g) => g.id);
}

export interface ZugangsAngaben {
  admin: boolean;
  /** `schreibtIn(...)`. */
  schreibt: readonly number[];
  /** Die Website, wie sie eingerichtet ist (`einrichtungAus`) – `null`: nicht eingerichtet oder nicht sichtbar. */
  website: { gruppe: number; entwuerfe: number | null; veroeffentlicht: number | null } | null;
  /** Die **eingerichteten** Untergruppen, die die Person sieht (ihre Veröffentlicht-Kategorie steht in ihrer Liste). */
  untergruppen: readonly UntergruppenKategorie[];
  /** Die IDs der eigenen Gruppen (`meineGruppenIds`). */
  meineGruppen: readonly number[];
}

/**
 * **Der Zugang der Person zur Website** – `null`: keiner. Die Regeln stehen in der Tabelle oben; der Admin hat Vorrang. Vor der
 * Einrichtung gibt es keine Kategorien, also nur den Admin.
 */
export function zugangFuer(a: ZugangsAngaben): Zugang | null {
  if (a.admin) return WEBSITE_LEITUNG;
  const w = a.website;
  if (!w || w.entwuerfe === null || !a.schreibt.includes(w.entwuerfe)) return null;
  if (w.veroeffentlicht !== null && a.schreibt.includes(w.veroeffentlicht)) return WEBSITE_LEITUNG;
  const leitet = a.untergruppen
    .filter((u) => a.schreibt.includes(u.kategorie))
    .map((u) => u.gruppe);
  // Die Website geht vor: Mitglied der Gruppe „Website“ sieht alle Seiten.
  if (a.meineGruppen.includes(w.gruppe)) return { sieht: 'alle', leitet };
  const mitglied = a.untergruppen
    .filter((u) => a.meineGruppen.includes(u.gruppe))
    .map((u) => u.gruppe);
  return { sieht: [...new Set([...leitet, ...mitglied])], leitet };
}

/** Ist die Person Leitung der Website (oder Admin)? Nur sie ändert, was für die ganze Website gilt. */
export function leitetWebsite(zugang: Zugang | null): boolean {
  return zugang?.leitet === 'alle';
}

/** Gibt die Person irgendwo frei (Website oder mindestens eine Untergruppe)? Bestimmt, wie „Freigaben“ und der Zähler lesen. */
export function leitetEtwas(zugang: Zugang | null): boolean {
  return zugang !== null && (zugang.leitet === 'alle' || zugang.leitet.length > 0);
}

/**
 * **Redakteur ohne erkennbaren Bereich:** schreibt in Entwürfe, ist aber weder Mitglied der Gruppe „Website“ noch einer
 * eingerichteten Untergruppe – sieht **keine** Seiten und bekommt einen Hinweis (statt alles zu sehen).
 */
export function ohneBereich(zugang: Zugang | null): boolean {
  return zugang !== null && zugang.sieht !== 'alle' && zugang.sieht.length === 0;
}

/** Der Bereich einer Seite: `null` = die Gruppe „Website“, sonst die Untergruppe (W3b-4b). */
export function bereichVon(seite: Pick<Seite, 'bereich'>): number | null {
  return seite.bereich ?? null;
}

function enthaelt(b: Bereiche, bereich: number | null): boolean {
  return b === 'alle' || (bereich !== null && b.includes(bereich));
}

/** Sieht die Person Seiten dieses Bereichs? (E-W31: Untergruppen sehen nur ihre Seiten.) */
export function siehtBereich(zugang: Zugang | null, bereich: number | null): boolean {
  return zugang !== null && enthaelt(zugang.sieht, bereich);
}

/** Die Seiten, die in Seitenliste, „Im Menü“ und „Freigaben“ stehen – die Vorschau rendert trotzdem mit allen. */
export function sichtbareSeiten<T extends Pick<Seite, 'bereich'>>(
  seiten: readonly T[],
  zugang: Zugang | null,
): T[] {
  return seiten.filter((s) => siehtBereich(zugang, bereichVon(s)));
}

/**
 * **Die Bereiche, in denen eine neue Seite liegen kann** – `[null]`: sie gehört der Website (wer alle Seiten sieht; änderbar in
 * „Seite einstellen“). Wer nur über Untergruppen dabei ist, bekommt deren Bereich; bei mehreren wählt er im Fenster „Neue Seite“.
 */
export function bereicheFuerNeueSeite(zugang: Zugang | null): (number | null)[] {
  if (!zugang || zugang.sieht === 'alle') return [null];
  return [...zugang.sieht];
}

/**
 * Darf die Person den Baustein „Eigenes HTML“ einfügen und ändern? **Eigenes HTML wird unverändert auf die Website
 * übernommen** (E-W12) – darum nur die Leitung der Website und der Admin, nie ein Redakteur oder die Leitung einer Untergruppe.
 */
export function darfEigenesHtml(zugang: Zugang | null): boolean {
  return leitetWebsite(zugang);
}

/**
 * Darf die Person **Aussehen** (Farben, Schriften, eigenes CSS), das Fenster **Einstellungen**, das **Menü**, die
 * **Startseite** und den **Bereich** einer Seite ändern? (E-W22) – nur die Leitung der Website und der Admin: Das gilt für die
 * ganze Website (das eigene CSS wird unverändert übernommen).
 */
export function darfAussehenUndMenue(zugang: Zugang | null): boolean {
  return leitetWebsite(zugang);
}

/**
 * Darf die Person eine Seite dieses Bereichs **freigeben**, **direkt veröffentlichen**, zurückgeben, „Löschen angefragt“
 * bestätigen und **löschen**? (W3b-2, E-W23, W3b-4b) – die Leitung der Website und der Admin für alle Seiten, die Leitung einer
 * Untergruppe nur für Seiten **ihres** Bereichs. Ein Redakteur reicht ein und fragt das Löschen an. Menü und Einstellungen gibt
 * nur die Leitung der Website frei (`bereich` ist dort `null`).
 */
export function darfFreigeben(zugang: Zugang | null, bereich: number | null): boolean {
  return zugang !== null && enthaelt(zugang.leitet, bereich);
}
