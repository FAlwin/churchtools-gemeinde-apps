import { gruppenName, gruppenSchluessel, type Plan } from '@shared/dienstplan/plan';
import {
  dienstUmschalten,
  dienstAus,
  gruppenStand,
  gruppeUmschalten,
  type PlanAus,
} from '@shared/dienstplan/planFilter';
import type { FilterAbschnitt } from '@ui/bedienung/FilterKnopf';

/**
 * **Der Abschnitt „Gruppen“ im Filter von „Planen“** (Wunsch 10): je Gruppe ein Häkchen, darunter ihre Dienste – eine
 * Gruppe mit nur einem Dienst ohne Unterliste (Gruppe und Dienst wären dasselbe). Was angehakt heißt und wie sich
 * Gruppe und Dienste zueinander verhalten, steht in `planFilter.ts`; hier wird es nur zu Häkchen.
 */
export function gruppenAbschnitt(
  plan: Plan | null,
  aus: PlanAus,
  onAus: (aus: PlanAus) => void,
): FilterAbschnitt {
  const gruppen = plan?.gruppen ?? [];
  return {
    titel: 'Gruppen',
    optionen: gruppen.map((g) => ({
      wert: gruppenSchluessel(g),
      text: gruppenName(g),
      unter:
        g.zeilen.length > 1
          ? {
              teilweise: gruppenStand(g, aus) === 'teils',
              onAlle: () => onAus(gruppeUmschalten(g, aus)),
              punkte: g.zeilen.map((z) => ({
                text: z.dienst.name,
                an: !dienstAus(g, z.dienst.id, aus),
                onUmschalten: () => onAus(dienstUmschalten(g, z.dienst.id, aus)),
              })),
            }
          : undefined,
    })),
    // „Aus“ ist auch eine Gruppe, deren Dienste alle einzeln aus sind.
    aus: gruppen.filter((g) => gruppenStand(g, aus) === 'keine').map(gruppenSchluessel),
    onAus: (gruppenAus) => onAus({ gruppen: gruppenAus, dienste: aus.dienste }),
  };
}
