/**
 * **Jede Person einmal** (Präsentation, abgenommen 19.10.2026): Eine Obergruppe wie „Technik“ listet alle
 * Personen ihres ganzen Teilbaums – Stream, Ton, Kamera … – und zwar jede genau einmal. Zuerst die Leitung der
 * Gruppe selbst (Leiter vor Co-Leiter), dann alle übrigen alphabetisch. Wer nur in einer Untergruppe leitet, ist
 * hier „übrig“; seine Leitung zeigt die Untergruppe.
 */
import { nachfahren, type Knoten } from './gruppen';

export interface Mitglied {
  personId: number;
  /** Rollenname in dieser Gruppe, z. B. „Leiter“ – `null` bei Personen, die nur über Untergruppen dazukommen. */
  rolle: string | null;
}

/**
 * Rang der Leitungsrollen; alles andere zählt nicht als Leitung. ChurchTools benennt die Rollen je Gruppentyp
 * verschieden (gemessen live 19.10.2026: Dienst/Kleingruppe „Leiter“/„Co-Leiter“, Veranstaltung und Verteiler
 * englisch „leader“) – alle drei stehen hier, damit keine Gruppe „ohne Leitung“ erscheint, nur weil ihr Typ
 * anders spricht.
 */
export const LEITUNGS_RANG: Readonly<Record<string, number>> = {
  Leiter: 0,
  leader: 0,
  'Co-Leiter': 1,
};

export const istLeitung = (rolle: string | null): boolean =>
  rolle !== null && rolle in LEITUNGS_RANG;

export function teilbaumPersonen(
  knoten: Knoten,
  mitglieder: ReadonlyMap<number, readonly Mitglied[]>,
  name: (personId: number) => string,
): Mitglied[] {
  const rolle = new Map<number, string | null>();
  for (const m of mitglieder.get(knoten.gruppe.id) ?? []) rolle.set(m.personId, m.rolle);
  for (const id of nachfahren(knoten)) {
    for (const m of mitglieder.get(id) ?? [])
      if (!rolle.has(m.personId)) rolle.set(m.personId, null);
  }
  const rang = (r: string | null) => (r !== null && r in LEITUNGS_RANG ? LEITUNGS_RANG[r] : 9);
  return [...rolle]
    .map(([personId, r]) => ({ personId, rolle: r }))
    .sort(
      (a, b) =>
        rang(a.rolle) - rang(b.rolle) ||
        name(a.personId).localeCompare(name(b.personId), 'de') ||
        a.personId - b.personId,
    );
}
