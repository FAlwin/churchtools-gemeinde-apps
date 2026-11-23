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
 *   Ist eins davon unbekannt (Einstellung von vor W16, nicht gelesen, Mitgliedschaft nicht sichtbar), bleibt es bei der
 *   Regel von vorher – wer schreibt, ist Leitung. Vor W16 gab es „Schreibt mit“ nicht, also trifft es dann niemanden falsch.
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
  g: Pick<ProtokollGruppe, 'protokolle' | 'rolle'>,
  schreibbar: readonly number[],
  stufen: readonly RollenStufe[] | null | undefined,
): boolean {
  if (!darfSchreibenIn(g, schreibbar)) return false;
  const rolle = g.rolle;
  if (rolle === null || rolle === undefined || !stufen) return true;
  return !stufen.some((s) => s.typ === rolle && s.stufe === 'schreibtMit');
}
