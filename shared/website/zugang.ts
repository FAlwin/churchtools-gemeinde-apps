/**
 * **Wer darf die Website bearbeiten?** (Bauplan Website W3a-1, §3.3) – in dieser Scheibe nur **Admins** und die
 * **Leitung der gewählten Gruppe „Website“**. Redakteure, Untergruppen und die Freigabe kommen mit W3b.
 *
 * **Das ist die Regel der Oberfläche, nicht der Schutz der Daten.** Den Schutz bilden die Rechte an den Kategorien in
 * ChurchTools (W3b setzt sie an die Gruppenrollen). Bis dahin vergibt die Verwaltung sie von Hand
 * (`docs/betrieb/WEBSITE.md`); die Oberfläche zeigt den Editor zusätzlich nur diesen beiden Gruppen von Personen.
 *
 * - **Admin** = Recht „Gruppen verwalten“ (`administer groups` in `GET /permissions/global` → `churchdb`) – dieselbe
 *   Regel wie im Anmelde-Tool (`verwaltetGruppen`).
 * - **Leitung** = aktive Mitgliedschaft in der Gruppe mit einer Rolle, die in ChurchTools als Leitung gilt (`isLeader`,
 *   `meineGruppen`). Die Rechteabfrage `GET /permissions/internal/groups/{id}` taugt dafür nicht: Sie meldet einzelne
 *   Rechte (`+create group` …), die auch Organisatoren haben, die keine Leitung sind.
 */
import { verwaltetGruppen } from '../anmeldung/rechte';
import { meineGruppen, type RohMitgliedschaft } from '../ct/gruppen';

export type Zugang = 'admin' | 'leitung';

/** Ist die Person Admin? Aus `GET /permissions/global` (ausgepackt). */
export function istAdmin(global: unknown): boolean {
  const churchdb = (global as { churchdb?: Record<string, unknown> } | null | undefined)?.churchdb;
  return verwaltetGruppen(churchdb);
}

/** Leitet die Person diese Gruppe? */
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

/** Der Zugang der Person zur Website – `null`: keiner. Vor der Einrichtung gibt es keine Gruppe, also nur den Admin. */
export function zugangFuer(admin: boolean, leitung: boolean): Zugang | null {
  if (admin) return 'admin';
  return leitung ? 'leitung' : null;
}

/**
 * Darf die Person den Baustein „Eigenes HTML“ einfügen und ändern? **Eigenes HTML wird unverändert auf die Website
 * übernommen** (E-W12) – darum nur die Leitung. In W3a haben ohnehin nur Admins und die Leitung der Gruppe Zugang, also
 * gilt es für alle, die den Editor sehen; die Abfrage steht trotzdem schon hier, damit W3b (Redakteure) nur die Rolle
 * einspeist und nicht jede Stelle der Oberfläche sucht.
 *
 * **Auch das ist die Regel der Oberfläche, nicht der Schutz der Daten** – den bilden die Rechte an den Kategorien (W3b).
 */
export function darfEigenesHtml(zugang: Zugang | null): boolean {
  return zugang === 'admin' || zugang === 'leitung';
}
