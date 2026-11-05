import type { BlattGruppe } from '@shared/ct/terminBlatt';
import { gruppenName, type PlanGruppe } from '@shared/dienstplan/plan';

/**
 * **Die Dienste eines Termins fürs Termin-Blatt** (E8-1) – aus dem Plan der Termin-Ansicht (eine Spalte), also mit
 * denselben Plätzen, die dort stehen: zugesagte und angefragte Personen mit Namen, freie Plätze gezählt. Verborgene
 * Namen bleiben verborgen (sie stehen weder als Person noch als frei da). Entwürfe sind nicht dabei – der Plan zeigt
 * nur, was ChurchTools kennt, also nur Gesendetes.
 */
export function blattGruppenAus(gruppen: readonly PlanGruppe[]): BlattGruppe[] {
  return gruppen.map((g) => ({
    id: g.gruppe?.id ?? null,
    name: gruppenName(g),
    dienste: g.zeilen.flatMap((z) => {
      const plaetze = z.zellen[0];
      if (!plaetze) return [];
      return [
        {
          name: z.dienst.name,
          personen: plaetze.flatMap((p) =>
            p.art !== 'frei' && p.name && !p.verborgen
              ? [{ name: p.name, angefragt: p.art === 'angefragt' }]
              : [],
          ),
          frei: plaetze.filter((p) => p.art === 'frei').length,
        },
      ];
    }),
  }));
}
