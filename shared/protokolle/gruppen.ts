/**
 * **Meine Gruppen in den Protokollen** (Bauplan S1, Startseite) – welche Gruppen die angemeldete Person sieht und
 * ob sie eingerichtet sind.
 *
 * Zwei Quellen, weil eine allein nicht reicht (S0, 22.10.2026):
 * - die **sichtbaren Kategorien** `protokolle-g<ID>` – die einzige Quelle für Teilnehmer **versteckter**
 *   Gruppen (ChurchTools zeigt ihnen die eigene Gruppe nicht, 403). Den Namen trägt die Kategorie
 *   („Protokolle · Leitungsteam“, beim Einrichten gesetzt);
 * - die **aktiven Mitgliedschaften** (`/persons/{id}/groups`) – für Gruppen, die noch nicht eingerichtet sind.
 *
 * Eingerichtet heißt: Die Protokoll-Kategorie der Gruppe ist sichtbar. Fehlt nur die Mitarbeit-Kategorie,
 * stimmt etwas nicht – das zeigt die Startseite als „unvollständig eingerichtet“.
 */
import { aktiveMitgliedschaften, type RohMitgliedschaft } from '../ct/gruppen';
import { kuerzelLesen } from './speicher';

export interface ProtokollGruppe {
  id: number;
  name: string;
  lage: 'eingerichtet' | 'unvollstaendig' | 'nicht-eingerichtet';
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
      lage: 'nicht-eingerichtet',
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

  for (const g of gruppen.values()) {
    g.lage =
      g.protokolle !== null
        ? g.mitarbeit !== null
          ? 'eingerichtet'
          : 'unvollstaendig'
        : 'nicht-eingerichtet';
    if (!g.name) g.name = `Gruppe ${g.id}`;
  }
  const rang = { eingerichtet: 0, unvollstaendig: 1, 'nicht-eingerichtet': 2 } as const;
  return [...gruppen.values()].sort(
    (a, b) => rang[a.lage] - rang[b.lage] || a.name.localeCompare(b.name, 'de'),
  );
}
