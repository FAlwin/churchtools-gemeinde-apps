/**
 * **Welche Gruppen und Dienste der Filter von „Planen“ zeigt** (Wunsch 10, Alwin 16.11.2026: „Plane ich den
 * Technikdienst, kommen Bild, Ton und so weiter alle auf einmal – ich will nur Bild rausfiltern“).
 *
 * Eine Stelle für die Regel „ist ausgeblendet“: Matrix, „Personen“, „Wer wie oft?“, Handy-Zettel, Termin-Kopf,
 * Füllbalken, Teilen/PDF, Zauberstab und der blasse Hinweis „+ Bild“ in „Personen“ rechnen alle aus dem, was
 * `gezeigteGruppen` liefert – nichts davon zählt für sich.
 *
 * - Ein Dienst ist **ausgeblendet**, wenn seine Gruppe aus ist oder er selbst.
 * - Eine Gruppe, in der alle Dienste einzeln aus sind, **verhält sich wie „Gruppe aus“** (`gruppenStand` = `keine`).
 * - Das Filter-Menü schaltet über `gruppeUmschalten`/`dienstUmschalten`; beide halten den Satz so, dass er sich nicht
 *   widerspricht.
 */
import { gruppenFrei, gruppenSchluessel, type Plan, type PlanGruppe } from './plan';

/** Was der Filter ausblendet: ganze Gruppen (Schlüssel wie `gruppenSchluessel`) und einzelne Dienste (ID). */
export interface PlanAus {
  gruppen: readonly string[];
  dienste: readonly number[];
}

export type GruppenStand = 'alle' | 'teils' | 'keine';

const dienstIds = (g: PlanGruppe) => g.zeilen.map((z) => z.dienst.id);

/** Wie viel der Gruppe gezeigt wird: alle Dienste, einige oder keiner (Gruppe aus, oder jeder Dienst einzeln aus). */
export function gruppenStand(g: PlanGruppe, aus: PlanAus): GruppenStand {
  if (aus.gruppen.includes(gruppenSchluessel(g))) return 'keine';
  const gezeigt = g.zeilen.filter((z) => !aus.dienste.includes(z.dienst.id)).length;
  if (gezeigt === 0) return 'keine';
  return gezeigt === g.zeilen.length ? 'alle' : 'teils';
}

/** Ist dieser Dienst ausgeblendet – über seine Gruppe oder einzeln? */
export const dienstAus = (g: PlanGruppe, dienstId: number, aus: PlanAus): boolean =>
  aus.gruppen.includes(gruppenSchluessel(g)) || aus.dienste.includes(dienstId);

/** Die Gruppe mit nur den gezeigten Diensten – freie Plätze der Gruppe neu gezählt (aus denselben Zellen). */
function ohneAusgeblendete(g: PlanGruppe, aus: PlanAus): PlanGruppe {
  const zeilen = g.zeilen.filter((z) => !dienstAus(g, z.dienst.id, aus));
  if (zeilen.length === g.zeilen.length) return g;
  // Der Stand in ChurchTools (ohne Entwürfe) – wie `PlanGruppe.frei` überall; mit Entwürfen rechnet `gruppenFrei(g, i, entwurf)`.
  const gezeigt = { ...g, zeilen };
  return { ...gezeigt, frei: g.frei.map((_, i) => gruppenFrei(gezeigt, i)) };
}

/**
 * **Die gezeigten Gruppen** in der Reihenfolge des Plans: ohne ausgeblendete Gruppen, ohne ausgeblendete Dienste, mit
 * neu gezählten freien Plätzen. Unverändert (dasselbe Objekt), wo nichts wegfällt.
 */
export function gezeigteGruppen(plan: Plan, aus: PlanAus): PlanGruppe[] {
  return plan.gruppen
    .filter((g) => gruppenStand(g, aus) !== 'keine')
    .map((g) => ohneAusgeblendete(g, aus));
}

/**
 * Häkchen der Gruppe im Menü. Ist alles gezeigt, schaltet es die Gruppe ab; bei „teils“ oder „keine“ schaltet es alle
 * Dienste der Gruppe wieder ein (wie ein Haken mit Strich) – die Einzelwahl der Gruppe ist danach aufgehoben.
 */
export function gruppeUmschalten(g: PlanGruppe, aus: PlanAus): PlanAus {
  const k = gruppenSchluessel(g);
  const ids = dienstIds(g);
  const dienste = aus.dienste.filter((id) => !ids.includes(id));
  const ohneK = aus.gruppen.filter((x) => x !== k);
  return gruppenStand(g, aus) === 'alle'
    ? { gruppen: [...ohneK, k], dienste }
    : { gruppen: ohneK, dienste };
}

/**
 * Häkchen eines Dienstes im Menü. Ist die Gruppe aus, schaltet er sie ein und lässt nur diesen Dienst stehen. Wird der
 * letzte gezeigte Dienst abgehakt, ist die Gruppe aus (nicht „alle Dienste einzeln aus“).
 */
export function dienstUmschalten(g: PlanGruppe, dienstId: number, aus: PlanAus): PlanAus {
  const k = gruppenSchluessel(g);
  const ids = dienstIds(g);
  const fremde = aus.dienste.filter((id) => !ids.includes(id));
  if (aus.gruppen.includes(k))
    return {
      gruppen: aus.gruppen.filter((x) => x !== k),
      dienste: [...fremde, ...ids.filter((id) => id !== dienstId)],
    };
  const eigene = new Set(aus.dienste.filter((id) => ids.includes(id)));
  if (!eigene.delete(dienstId)) eigene.add(dienstId);
  if (ids.every((id) => eigene.has(id))) return { gruppen: [...aus.gruppen, k], dienste: fremde };
  return { gruppen: aus.gruppen, dienste: [...fremde, ...eigene] };
}
