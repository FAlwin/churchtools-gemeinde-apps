/**
 * **Wer darf die Website bearbeiten – und was?** (Bauplan Website W3a-1 §3.3, W3b-1 E-W19/E-W21/E-W22)
 *
 * - **Admin** = Recht „Gruppen verwalten“ (`administer groups` in `GET /permissions/global` → `churchdb`) – dieselbe Regel
 *   wie im Anmelde-Tool (`verwaltetGruppen`).
 * - **Leitung** und **Redakteur** ergeben sich aus den **eigenen Rechten** der Person am Modul (`GET /permissions/global` →
 *   Block `website`, z. B. `create custom data: [104, 107]`) – nicht mehr daraus, ob sie die Gruppe leitet. Der Grund: Wer die
 *   Gruppe leitet, aber keine Rechte hat, bekam den Editor gezeigt, und Speichern scheiterte. Jetzt gilt: Wer in
 *   „Entwürfe“ **und** in „Veröffentlicht“ schreiben darf → `leitung`; nur in „Entwürfe“ → `redakteur`; sonst keiner.
 *   „Schreiben“ heißt wie überall (`modulRechteAus`): anlegen, ändern **und** löschen – Speichern legt Teile an, ändert den
 *   Kopf und löscht alte Teile; mit einem davon allein scheiterte es mittendrin. Fremde Kategorien zählen nicht.
 *   Wer nur in „Veröffentlicht“ schreiben darf (kein Recht an „Entwürfe“), hat keinen Zugang – der Editor arbeitet in „Entwürfe“.
 * - Die Stufen vergibt der Admin beim Einrichten und später unter Einstellungen → „Wer darf was“ (`./rechte`).
 *
 * **Das ist die Regel der Oberfläche, nicht der Schutz der Daten.** Den Schutz bilden die Rechte an den Kategorien in
 * ChurchTools; die Oberfläche zeigt nur, was die Person auch tun darf.
 */
import { verwaltetGruppen } from '../anmeldung/rechte';
import { meineGruppen, type RohMitgliedschaft } from '../ct/gruppen';
import { modulRechteAus } from '../ct/modulRechte';
import { MODUL_KUERZEL } from './rechte';

export type Zugang = 'admin' | 'leitung' | 'redakteur';

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

/**
 * Der Zugang der Person zur Website – `null`: keiner. `schreibt` = `schreibtIn(...)`. Vor der Einrichtung gibt es keine
 * Kategorien (`null`), also nur den Admin. Der Admin hat Vorrang.
 */
export function zugangFuer(
  admin: boolean,
  schreibt: readonly number[],
  kategorien: { entwuerfe: number | null; veroeffentlicht: number | null } | null,
): Zugang | null {
  if (admin) return 'admin';
  if (!kategorien || kategorien.entwuerfe === null || !schreibt.includes(kategorien.entwuerfe))
    return null;
  return kategorien.veroeffentlicht !== null && schreibt.includes(kategorien.veroeffentlicht)
    ? 'leitung'
    : 'redakteur';
}

/**
 * Darf die Person den Baustein „Eigenes HTML“ einfügen und ändern? **Eigenes HTML wird unverändert auf die Website
 * übernommen** (E-W12) – darum nur Leitung und Admin, nie ein Redakteur.
 *
 * **Auch das ist die Regel der Oberfläche, nicht der Schutz der Daten.**
 */
export function darfEigenesHtml(zugang: Zugang | null): boolean {
  return zugang === 'admin' || zugang === 'leitung';
}

/**
 * Darf die Person **Aussehen** (Farben, Schriften, eigenes CSS), das Fenster **Einstellungen** und das **Menü** ändern?
 * (E-W22) – nur Leitung und Admin. Das eigene CSS wird unverändert übernommen, die Einstellungen gelten für die ganze Website.
 */
export function darfAussehenUndMenue(zugang: Zugang | null): boolean {
  return zugang === 'admin' || zugang === 'leitung';
}

/**
 * Darf die Person **freigeben** (Seiten, Menü, Einstellungen nach „Veröffentlicht“), **direkt veröffentlichen**, „Löschen
 * angefragt“ bestätigen und Seiten **löschen**? (W3b-2, E-W23) – nur Leitung und Admin; ein Redakteur reicht ein und fragt das
 * Löschen an. Das spiegelt die Rechte an den Kategorien (nur die Leitung schreibt in „Veröffentlicht“); **geschützt sind die
 * Daten allein durch diese Rechte**, nicht durch die Oberfläche. W3b-4 ergänzt hier den Bereich (Untergruppe).
 *
 * **Zwischenstand W3b-4a (bis W3b-4b):** Rollen einer eingerichteten Untergruppe schreiben in „Entwürfe“, aber nicht in
 * „Veröffentlicht“ der Website – `zugangFuer` macht sie deshalb zu **„redakteur“ für die ganze Website** (sie sehen alle
 * Seiten, reichen ein, geben nicht frei). Auch die Leitung einer Untergruppe ist hier Redakteur, obwohl sie in ihre eigene
 * Kategorie schreiben darf. Erst W3b-4b bringt den Bereich je Seite, gefilterte Listen und Freigeben je Bereich.
 */
export function darfFreigeben(zugang: Zugang | null): boolean {
  return zugang === 'admin' || zugang === 'leitung';
}
