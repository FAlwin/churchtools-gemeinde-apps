/**
 * **Wer welche Personen und Hinweise sieht** (Bauplan O3, Alwin 22.10.2026: „Leitung eines Bereichs“).
 *
 * - Gruppen-Admins (`administer groups`) sehen alles (`null` = keine Grenze).
 * - Sonst: jede Gruppe, die man **leitet** (Rolle mit `isLeader`), samt allen Untergruppen. Das ist genau die
 *   Richtung, in der ChurchTools selbst Rechte vererbt (gemessen O0 §5: Mitglieder einer Gruppe sehen deren
 *   Untergruppen, nicht die Obergruppe) – die Erweiterung zeigt also nie mehr, als ChurchTools ohnehin freigibt.
 * - Wer nichts leitet, bekommt eine leere Menge – Personen und Hinweise gibt es dann nicht.
 */
import { knotenNachId, nachfahren, type Knoten } from './gruppen';
import type { Mitglied } from './mitglieder';

export type Sichtbereich = ReadonlySet<number> | null;

export function sichtbereich(
  baum: readonly Knoten[],
  geleitet: Iterable<number>,
  admin: boolean,
): Sichtbereich {
  if (admin) return null;
  const knoten = knotenNachId(baum);
  const s = new Set<number>();
  for (const id of geleitet) {
    const k = knoten.get(id);
    if (!k) continue;
    s.add(id);
    for (const x of nachfahren(k)) s.add(x);
  }
  return s;
}

export const imBereich = (bereich: Sichtbereich, gruppeId: number): boolean =>
  bereich === null || bereich.has(gruppeId);

export const hatBereich = (bereich: Sichtbereich): boolean => bereich === null || bereich.size > 0;

export interface PersonImBereich {
  personId: number;
  /** Die Gruppen der Person im Bereich, mit Rolle. */
  gruppen: { gruppeId: number; rolleId: number | null }[];
}

/** Alle Personen in den sichtbaren Gruppen des Bereichs – jede einmal, mit ihren Gruppen. */
export function personenImBereich(
  mitglieder: ReadonlyMap<number, readonly Mitglied[]>,
  bereich: Sichtbereich,
): Map<number, PersonImBereich> {
  const m = new Map<number, PersonImBereich>();
  for (const [gruppeId, liste] of mitglieder) {
    if (!imBereich(bereich, gruppeId)) continue;
    for (const x of liste) {
      let p = m.get(x.personId);
      if (!p) m.set(x.personId, (p = { personId: x.personId, gruppen: [] }));
      p.gruppen.push({ gruppeId, rolleId: x.rolleId });
    }
  }
  return m;
}
