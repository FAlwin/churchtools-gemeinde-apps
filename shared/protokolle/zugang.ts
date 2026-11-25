/**
 * **Wer darf in einer Gruppe was?** (W16, Alwin 23.11.2026) – die EINE Stelle für Start, Sitzungen, To-Dos und Suche.
 *
 * Bis W16 galt „darf schreiben“ = „ist Leitung“ (`schreibbar.includes(g.protokolle)` an jeder Stelle). Seit es die Stufe
 * **„Schreibt mit“** gibt, sind das zwei Fragen:
 * - **`darfSchreiben`** – Protokoll-Entwürfe schreiben (Editor, Anwesenheit, Mit KI füllen, Bausteine; Protokoll beginnen,
 *   nachtragen, „Neues Protokoll“; Vorschläge übernehmen oder aufs nächste Mal). Kommt aus den **eigenen Rechten** in
 *   ChurchTools: anlegen, ändern und löschen in „Protokolle“ (`Start.schreibbar`, `modulRechteAus`) – Leitung und „Schreibt
 *   mit“ haben dieselben Datenrechte, die Schnittstelle prüft es ohnehin.
 * - **`istLeitung`** – zusätzlich Freigeben (auch zurücknehmen), Löschen, Sitzung festlegen/bearbeiten, Vorschläge ablehnen
 *   und die Leitungsrechte bei To-Dos (W9/W10). Wer schreiben darf, ist Leitung – **außer** die eigene Rolle steht in der
 *   Einstellung der Gruppe auf „Schreibt mit“. Die Rolle kommt aus der eigenen Mitgliedschaft (`ProtokollGruppe.rolle`,
 *   `groupTypeRoleId`), die Stufen aus der Einstellung (`RollenStufe.typ`, seit W16 beim Einrichten mitgeschrieben).
 *   Ohne Stufen (Einstellung von vor W16 oder nicht gelesen) oder ohne „Schreibt mit“ in den Stufen bleibt es bei der
 *   Regel von vorher – wer schreibt, ist Leitung.
 * - **Rolle unbekannt, aber „Schreibt mit“ eingestellt** (v1.6.1, gefunden im Handtest TF-PROT-33 am 25.11.2026): Verbirgt
 *   der Gruppentyp die Gruppe vor ihren Teilnehmern, fehlt die Mitgliedschaft in `/persons/{id}/groups` – v1.6.0 machte
 *   „Schreibt mit“ dann zur Leitung (Freigeben, Löschen, Neue Sitzung). Jetzt entscheidet, was ChurchTools für die Gruppe
 *   meldet: „Gruppentreffen pflegen“ (`ProtokollGruppe.treffenPflegen`, `+admin meetings`) oder Admin. Das gibt das
 *   Einrichten nur der Leitung (`sollRechte`); „Schreibt mit“ gibt es nur nach einem Einrichten mit W16, also hat die
 *   Leitung es dann. **Folge:** Nimmt jemand der Leitung dieses Recht von Hand weg, verliert sie bei unbekannter Rolle die
 *   Leitungsknöpfe; gibt jemand es einer „Schreibt mit“-Rolle von Hand, bekommt sie sie. Ist es nicht lesbar (`null`), gibt
 *   es keine Leitungsknöpfe – für Freigeben und Löschen ist die Oberfläche der einzige Schutz („Schreibt mit“ darf in
 *   „Protokolle“ löschen), und beim nächsten Laden stimmt es wieder.
 *
 * **Das ist die Regel der Oberfläche, nicht der Schutz der Daten** (wie `shared/website/zugang.ts`): Den Schutz bilden die
 * Rechte an den Kategorien in ChurchTools.
 */
import type { RollenStufe } from './einrichten';
import type { ProtokollGruppe } from './gruppen';

/** Darf man in dieser Gruppe Protokoll-Entwürfe schreiben? `schreibbar` = `Start.schreibbar`. */
export function darfSchreibenIn(
  g: Pick<ProtokollGruppe, 'protokolle'>,
  schreibbar: readonly number[],
): boolean {
  return g.protokolle !== null && schreibbar.includes(g.protokolle);
}

/**
 * Ist man in dieser Gruppe Leitung? `stufen` = die Rollen aus der Einstellung der Gruppe (`GruppenSitzungen.stufen`) –
 * `null`/fehlt: nicht bekannt (dann wie vor W16).
 */
export function istLeitungIn(
  g: Pick<ProtokollGruppe, 'protokolle' | 'rolle' | 'treffenPflegen'>,
  schreibbar: readonly number[],
  stufen: readonly RollenStufe[] | null | undefined,
): boolean {
  if (!darfSchreibenIn(g, schreibbar)) return false;
  if (!stufen || !stufen.some((s) => s.stufe === 'schreibtMit')) return true;
  const rolle = g.rolle;
  if (rolle === null || rolle === undefined) return g.treffenPflegen === true;
  return !stufen.some((s) => s.typ === rolle && s.stufe === 'schreibtMit');
}
