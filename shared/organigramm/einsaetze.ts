/**
 * **Einsätze und offene Plätze** für das Organigramm (Bauplan O3) – aus `/events?include=eventServices`.
 *
 * Die Regeln für einen Platz sind die des Dienstplaners (`shared/dienstplan/termine.ts`), nicht nachgebaut:
 * frei ist ein Platz ohne Namen (`istFrei`), und „Namen verbergen“ (`personId -2`, `VERBORGENE_PERSON`) wird nie
 * einer Person zugerechnet. Dazu hier: Abgesagte Termine zählen nicht, und ein ungültiger Platz (`isValid: false`
 * – entsteht, wenn jemand auf eine veraltete Platz-ID schreibt, Dienstplaner E0) ebenso wenig.
 *
 * Gezählt wird jede Einteilung (zugesagt oder angefragt). „Vergangen“ = Beginn vor `jetzt`.
 */
import { istFrei, VERBORGENE_PERSON, type RohPlatz, type RohTermin } from '../dienstplan/termine';
import { ctId } from '../ct/ctId';
import type { Dienst } from '../ct/dienste';

export interface PersonEinsatz {
  vergangen: number;
  kommend: number;
  /** Beginn des letzten vergangenen Einsatzes (ISO), sonst `null`. */
  letzter: string | null;
  /** Vergangene Einsätze je Dienst-ID. */
  jeDienst: Map<number, number>;
}

export interface Einsaetze {
  jePerson: Map<number, PersonEinsatz>;
  /** Freie Plätze in KOMMENDEN Terminen je Dienst-ID. */
  offenJeDienst: Map<number, number>;
}

type Platz = RohPlatz & { isValid?: unknown };

export function einsaetzeAus(termine: readonly RohTermin[], jetzt: Date): Einsaetze {
  const jePerson = new Map<number, PersonEinsatz>();
  const offenJeDienst = new Map<number, number>();
  const grenze = jetzt.getTime();
  for (const t of termine) {
    if (t.isCanceled === true) continue;
    const beginn = typeof t.startDate === 'string' ? t.startDate : null;
    const zeit = beginn ? Date.parse(beginn) : NaN;
    if (Number.isNaN(zeit)) continue;
    const vorbei = zeit < grenze;
    for (const p of (t.eventServices ?? []) as Platz[]) {
      if (p.isValid === false) continue;
      const dienst = ctId(p.serviceId);
      if (dienst === null) continue;
      if (istFrei(p)) {
        if (!vorbei) offenJeDienst.set(dienst, (offenJeDienst.get(dienst) ?? 0) + 1);
        continue;
      }
      const person = ctId(p.personId);
      // Gast (ohne Person) und „Namen verbergen“ gehören zu niemandem.
      if (person === null || person === VERBORGENE_PERSON) continue;
      let e = jePerson.get(person);
      if (!e)
        jePerson.set(
          person,
          (e = { vergangen: 0, kommend: 0, letzter: null, jeDienst: new Map() }),
        );
      if (vorbei) {
        e.vergangen++;
        e.jeDienst.set(dienst, (e.jeDienst.get(dienst) ?? 0) + 1);
        if (!e.letzter || beginn! > e.letzter) e.letzter = beginn;
      } else e.kommend++;
    }
  }
  return { jePerson, offenJeDienst };
}

/**
 * Offene Plätze einer Gruppe: die ihrer Dienste – bei Diensten mit **mehreren** Gruppen nur an der ERSTEN, sonst
 * stünden z. B. die Café-Plätze an allen fünf Café-Teams (Entwurf 19.10.2026).
 */
export function offenVonGruppe(
  dienste: ReadonlyMap<number, Dienst> | null,
  offenJeDienst: ReadonlyMap<number, number>,
  gruppeId: number,
): number {
  let n = 0;
  for (const d of dienste?.values() ?? []) {
    if (d.gruppenIds[0] === gruppeId) n += offenJeDienst.get(d.id) ?? 0;
  }
  return n;
}

/** Zeitraum der Einsätze: 6 Monate zurück, 3 voraus – als `YYYY-MM-DD` für `/events?from&to`. */
export function zeitraum(jetzt: Date): { von: string; bis: string } {
  const tag = (d: Date) => d.toISOString().slice(0, 10);
  const von = new Date(jetzt);
  von.setMonth(von.getMonth() - 6);
  const bis = new Date(jetzt);
  bis.setMonth(bis.getMonth() + 3);
  return { von: tag(von), bis: tag(bis) };
}

/** „Fast jede Woche“: mindestens 24 Einsätze in den 26 Wochen der letzten 6 Monate. */
export const FAST_JEDE_WOCHE = 24;
