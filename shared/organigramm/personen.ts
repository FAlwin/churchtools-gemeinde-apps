/**
 * **Jede Person einmal** (Präsentation, abgenommen 19.10.2026): Eine Obergruppe wie „Technik“ listet alle
 * Personen ihres ganzen Teilbaums – Stream, Ton, Kamera … – und zwar jede genau einmal. Zuerst nach der Rolle IN
 * DIESER GRUPPE (Leitung zuerst, Rang aus ChurchTools – `rollenRang`), dann alphabetisch. Wer nur in einer
 * Untergruppe dabei ist (auch als deren Leitung), steht hier ohne Rolle; seine Leitung zeigt die Untergruppe.
 *
 * Seit O2 hängt die Reihenfolge an den Rollen von ChurchTools (`isLeader`, `sortKey`) statt an Rollennamen –
 * die Namensliste aus O1 („Leiter“, „leader“, „Co-Leiter“) ist damit weg.
 */
import { nachfahren, type Knoten } from './gruppen';
import type { Mitglied } from './mitglieder';

export type { Mitglied } from './mitglieder';

type Name = (personId: number) => string;
type Rang = (rolleId: number | null) => number;

/** Rolle (Rang), dann Name, dann ID – EINE Reihenfolge für Teilbaum und einzelne Gruppe. */
const reihenfolge = (name: Name, rang: Rang) => (a: Mitglied, b: Mitglied) =>
  rang(a.rolleId) - rang(b.rolleId) ||
  name(a.personId).localeCompare(name(b.personId), 'de') ||
  a.personId - b.personId;

export function teilbaumPersonen(
  knoten: Knoten,
  mitglieder: ReadonlyMap<number, readonly Mitglied[]>,
  name: Name,
  rang: Rang,
): Mitglied[] {
  const rolle = new Map<number, number | null>();
  for (const m of mitglieder.get(knoten.gruppe.id) ?? []) rolle.set(m.personId, m.rolleId);
  for (const id of nachfahren(knoten)) {
    for (const m of mitglieder.get(id) ?? [])
      if (!rolle.has(m.personId)) rolle.set(m.personId, null);
  }
  return [...rolle]
    .map(([personId, rolleId]) => ({ personId, rolleId }))
    .sort(reihenfolge(name, rang));
}

/** Die Mitglieder EINER Gruppe in derselben Reihenfolge (ohne Untergruppen) – fürs Gruppenfenster und den Baum. */
export function gruppenPersonen(
  mitglieder: readonly Mitglied[],
  name: Name,
  rang: Rang,
): Mitglied[] {
  return [...mitglieder].sort(reihenfolge(name, rang));
}
