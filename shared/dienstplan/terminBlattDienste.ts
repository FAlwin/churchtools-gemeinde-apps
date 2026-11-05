import type { BlattGruppe } from '../ct/terminBlatt';
import { diensteAus } from '../ct/dienste';
import { dienstgruppenAus } from '../ct/dienstgruppen';
import { siehtDienstGanz, type DienstRechte } from '../ct/dienstRechte';
import { gruppenName, planAus, type PlanGruppe } from './plan';
import type { RohTermin } from './termine';

/**
 * **Die Dienste eines Termins fürs Termin-Blatt** (E8-1) – aus dem Plan der Termin-Ansicht (eine Spalte), also mit
 * denselben Plätzen, die dort stehen: zugesagte und angefragte Personen mit Namen, freie Plätze gezählt. Verborgene
 * Namen bleiben verborgen (sie stehen weder als Person noch als frei da). Entwürfe sind nicht dabei – der Plan zeigt
 * nur, was ChurchTools kennt, also nur Gesendetes. Seit E8-1b in `shared/` – die Musik-App baut dasselbe Blatt.
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

/**
 * **Die Dienste eines Termins ohne den Dienstplaner** (E8-1b, Musik-App): aus den rohen Antworten von ChurchTools
 * (`/events/{id}?include=eventServices`, `/services`, `/servicegroups`) mit derselben Plan-Regel (`planAus`).
 *
 * Ein Dienst kommt nur aufs Blatt, wenn ChurchTools seine Plätze **vollständig** liefert (`siehtDienstGanz`, wie die
 * Matrix) – sonst stünden nur die eigenen Einträge da und kein „frei“. Ohne den Weg über geleitete Gruppen: Die
 * Musik-App liest die Gruppenleitungen nicht; im Zweifel fehlt ein Dienst, statt unvollständig dazustehen.
 */
export function terminDiensteAus(
  termin: RohTermin,
  rohDienste: unknown,
  rohDienstgruppen: unknown,
  rechte: DienstRechte,
  zeitzone: string,
): BlattGruppe[] {
  const dienste = diensteAus(rohDienste as Parameters<typeof diensteAus>[0]);
  const dienstgruppen = dienstgruppenAus(
    rohDienstgruppen as Parameters<typeof dienstgruppenAus>[0],
  );
  const plan = planAus([termin], {
    ichId: 0,
    dienste,
    dienstgruppen,
    zeitzone,
    planbar: () => false,
    ganzSichtbar: (d) =>
      siehtDienstGanz(
        rechte,
        d,
        dienstgruppen.find((g) => g.id === d.dienstgruppeId)?.fuerAlle === true,
        new Set(),
      ),
  });
  return blattGruppenAus(plan.gruppen);
}
