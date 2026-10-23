/**
 * **Meine Gruppen in den Protokollen** (Bauplan S1, Startseite) – in welchen Gruppen die angemeldete Person
 * Protokolle sehen darf.
 *
 * Zwei Quellen, weil eine allein nicht reicht (S0, 22.10.2026):
 * - die **sichtbaren Kategorien** `protokolle-g<ID>` – die einzige Quelle für Teilnehmer **versteckter**
 *   Gruppen (ChurchTools zeigt ihnen die eigene Gruppe nicht, 403). Den Namen trägt die Kategorie
 *   („Protokolle · Leitungsteam“, beim Einrichten gesetzt);
 * - die **aktiven Mitgliedschaften** (`/persons/{id}/groups`) – nur noch für den Namen, wenn die Kategorie keinen
 *   trägt.
 *
 * **Gezeigt wird nur, wo die Protokoll-Kategorie sichtbar ist** (S2-4, Alwin 22.10.2026): Ohne sie lässt sich
 * „nicht eingerichtet“ nicht von „kein Zugriff“ unterscheiden – ein Mitglied ohne Zugriff sah seine eingerichtete
 * Gruppe als „nicht eingerichtet“. Den Stand aller Gruppen sehen Admins in der Verwaltung. Fehlt nur die
 * Mitarbeit-Kategorie, stimmt etwas nicht – das zeigt die Startseite als „unvollständig eingerichtet“.
 */
import { aktiveMitgliedschaften, type RohMitgliedschaft } from '../ct/gruppen';
import { kuerzelLesen } from './speicher';

export interface ProtokollGruppe {
  id: number;
  name: string;
  lage: 'eingerichtet' | 'unvollstaendig';
  protokolle: number | null;
  mitarbeit: number | null;
}

/** Trenner im Namen einer Kategorie: „Protokolle · Leitungsteam“. */
export const NAMENS_TRENNER = ' · ';

export function kategorieName(art: 'Protokolle' | 'Mitarbeit', gruppe: string): string {
  return `${art}${NAMENS_TRENNER}${gruppe}`;
}

function gruppenNameAus(kategorieName: string | undefined): string | null {
  if (!kategorieName) return null;
  const i = kategorieName.indexOf(NAMENS_TRENNER);
  const name = i >= 0 ? kategorieName.slice(i + NAMENS_TRENNER.length).trim() : '';
  return name || null;
}

export function protokollGruppen(
  mitgliedschaften: readonly RohMitgliedschaft[] | null | undefined,
  kategorien: readonly { id: number; shorty: string; name?: string }[],
): ProtokollGruppe[] {
  const gruppen = new Map<number, ProtokollGruppe>();
  const hole = (id: number, name: string): ProtokollGruppe => {
    const g = gruppen.get(id) ?? {
      id,
      name,
      lage: 'unvollstaendig',
      protokolle: null,
      mitarbeit: null,
    };
    if (!g.name && name) g.name = name;
    gruppen.set(id, g);
    return g;
  };

  const aktiv = new Set(
    aktiveMitgliedschaften(mitgliedschaften ? [...mitgliedschaften] : []).map((m) => m.groupId),
  );
  for (const r of mitgliedschaften ?? []) {
    const id = Number(r.group?.domainIdentifier);
    if (aktiv.has(id)) hole(id, typeof r.group?.title === 'string' ? r.group.title : '');
  }

  // Bei gleichem Kürzel gilt die kleinste ID (wie `kategorieAusListe`).
  for (const k of [...kategorien].sort((a, b) => a.id - b.id)) {
    const z = kuerzelLesen(k.shorty);
    if (!z) continue;
    const g = hole(z.gruppe, gruppenNameAus(k.name) ?? '');
    if (z.art === 'protokolle' && g.protokolle === null) g.protokolle = k.id;
    if (z.art === 'mitarbeit' && g.mitarbeit === null) g.mitarbeit = k.id;
  }

  const sichtbar = [...gruppen.values()].filter((g) => g.protokolle !== null);
  for (const g of sichtbar) {
    g.lage = g.mitarbeit !== null ? 'eingerichtet' : 'unvollstaendig';
    if (!g.name) g.name = `Gruppe ${g.id}`;
  }
  const rang = { eingerichtet: 0, unvollstaendig: 1 } as const;
  return sichtbar.sort((a, b) => rang[a.lage] - rang[b.lage] || a.name.localeCompare(b.name, 'de'));
}
