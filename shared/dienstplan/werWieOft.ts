/**
 * **„Wer wie oft?“** (Bauplan E3-5, Entwurf v17): wie oft jemand im sichtbaren Zeitraum eingeteilt ist –
 * aus denselben Plätzen wie die Matrix (`plan.ts`), nur in den sichtbaren Spalten und Gruppen.
 *
 * Gezählt wird jede Einteilung (zugesagt oder angefragt), Personen nach ID, Gäste nach Namen. Plätze mit
 * „Namen verbergen“ fehlen (man weiß nicht, wer es ist). Die Monatsauslastung aus ChurchTools
 * (`possiblepersons`) kommt erst mit E4 – sie kostet je Termin 2,6 s und 508 KB (gemessen 07.10.2026).
 */
import type { Plan, PlanSpalte } from './plan';

export interface Einsatz {
  spalte: PlanSpalte;
  dienst: string;
  zugesagt: boolean;
}

export interface PersonEinsaetze {
  name: string;
  gast: boolean;
  einsaetze: Einsatz[];
  /** Die Dienste, die sie im Zeitraum macht, in der Reihenfolge der Matrix, ohne Doppelte. */
  dienste: string[];
}

export function werWieOft(
  plan: Plan,
  o: {
    /** Indizes der sichtbaren Spalten. */
    spalten: number[];
    /** Ist die Gruppe sichtbar? (Gruppenfilter) */
    gruppeSichtbar: (gruppeId: number | null) => boolean;
  },
): { personen: PersonEinsaetze[]; schnitt: number } {
  const nachSchluessel = new Map<string, PersonEinsaetze>();
  for (const g of plan.gruppen) {
    if (!o.gruppeSichtbar(g.gruppe?.id ?? null)) continue;
    for (const z of g.zeilen) {
      for (const i of o.spalten) {
        for (const p of z.zellen[i] ?? []) {
          if (p.art === 'frei' || p.verborgen || !p.name) continue;
          const schluessel = p.personId !== null ? `p${p.personId}` : `g${p.name}`;
          let eintrag = nachSchluessel.get(schluessel);
          if (!eintrag) {
            eintrag = { name: p.name, gast: p.gast, einsaetze: [], dienste: [] };
            nachSchluessel.set(schluessel, eintrag);
          }
          eintrag.einsaetze.push({
            spalte: plan.spalten[i],
            dienst: z.dienst.name,
            zugesagt: p.art === 'zugesagt',
          });
          if (!eintrag.dienste.includes(z.dienst.name)) eintrag.dienste.push(z.dienst.name);
        }
      }
    }
  }
  const personen = [...nachSchluessel.values()];
  // Spalten sind schon nach Zeit sortiert (`planAus`) – ihr Index ist die Zeitfolge.
  const zeit = (e: Einsatz) => plan.spalten.indexOf(e.spalte);
  for (const p of personen) p.einsaetze.sort((a, b) => zeit(a) - zeit(b));
  personen.sort(
    (a, b) => b.einsaetze.length - a.einsaetze.length || a.name.localeCompare(b.name, 'de'),
  );
  const summe = personen.reduce((n, p) => n + p.einsaetze.length, 0);
  return { personen, schnitt: personen.length ? summe / personen.length : 0 };
}
