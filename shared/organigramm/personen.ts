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
import { istLeitung, type Mitglied, type Rolle } from './mitglieder';

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

/**
 * Die **Leitung** einer Gruppe (Rolle mit `isLeader`), in derselben Reihenfolge – EINE Regel für Baum und
 * Präsentation (vorher stand sie als Zeile im Baum).
 */
export function gruppenLeitung(
  mitglieder: readonly Mitglied[],
  rollen: ReadonlyMap<number, Rolle>,
  name: Name,
  rang: Rang,
): Mitglied[] {
  return gruppenPersonen(mitglieder, name, rang).filter((m) => istLeitung(rollen, m.rolleId));
}

/** Was ein Kästchen im Diagramm und eine Zeile der Liste an Personen zeigen (O7b-6): nichts, die Rollen oder alle. */
export type PersonenWahl = 'aus' | 'rollen' | 'alle';

/** Eine Rolle einer Gruppe mit ihren Personen – `nurZahl`: nur „6 Mitarbeiter“ statt der Namen. */
export interface RollenGruppe {
  rolle: string;
  namen: string[];
  nurZahl: boolean;
}

/**
 * **Die Personen EINER Gruppe nach Rollen** (O7b-6, Alwin 28.10.2026: „einfach ChurchTools abbilden … nichts weglassen
 * oder hinzufügen“): die Rollen mit ihren Namen aus ChurchTools, **Leitung zuerst** (`isLeader`), dann wie ChurchTools
 * sortiert (`sortKey`), die **Standardrolle** (`isDefault`, Mitarbeiter/Teilnehmer) zuletzt – bei „Rollen“ nur als Zahl.
 * Innerhalb einer Rolle alphabetisch. Auch eine in ChurchTools versteckte Rolle (`isHidden`, in der Test-Instanz
 * „Coach“) steht da – sie wird nur nicht mehr vergeben, die Personen sind trotzdem in der Gruppe. Eine Rolle, die
 * ChurchTools nicht (mehr) liefert, steht ganz hinten unter dem Namen, den `rollenAus` für Rollen ohne Namen nimmt.
 */
export function kastenRollen(
  mitglieder: readonly Mitglied[],
  rollen: ReadonlyMap<number, Rolle>,
  name: Name,
  wahl: PersonenWahl,
): RollenGruppe[] {
  if (wahl === 'aus') return [];
  const rang = (id: number | null) => {
    const r = id === null ? undefined : rollen.get(id);
    if (!r) return [3, 0] as const;
    return [r.leitung ? 0 : r.standard ? 2 : 1, r.sortKey] as const;
  };
  const je = new Map<number | null, number[]>();
  for (const m of mitglieder) {
    const id = m.rolleId !== null && rollen.has(m.rolleId) ? m.rolleId : null;
    je.set(id, [...(je.get(id) ?? []), m.personId]);
  }
  return [...je]
    .sort(([a], [b]) => {
      const [ga, sa] = rang(a);
      const [gb, sb] = rang(b);
      return ga - gb || sa - sb || (a ?? 0) - (b ?? 0);
    })
    .map(([id, personen]) => {
      const r = id === null ? undefined : rollen.get(id);
      return {
        rolle: r?.name ?? 'Mitglied',
        namen: personen
          .sort((a, b) => name(a).localeCompare(name(b), 'de') || a - b)
          .map((p) => name(p)),
        nurZahl: wahl === 'rollen' && r?.standard === true,
      };
    });
}

/** „6 Mitarbeiter“ – die Standardrolle bei „Rollen“ (O7b-6). Der Rollenname steht, wie ChurchTools ihn liefert. */
export const rollenZahl = (g: RollenGruppe): string => `${g.namen.length} ${g.rolle}`;
