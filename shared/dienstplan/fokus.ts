/**
 * **Fokus-Modus** (Wunsch 11, Alwin 16.11.2026, Entwurf `e11-fokus.html`): eine Person „anleuchten“ – alle ihre
 * Einteilungen im Plan umranden. Hier steht die **eine** Regel, wer an einem Platz steht (`platzPerson`) und alles, was
 * daraus gerechnet wird (Zählen, Vorschläge fürs Suchfeld, „Einsätze in der Nähe“ in „Wer kann?“). Die Anzeige (Matrix,
 * Zettel, „Personen“) fragt dieselbe Funktion – so zählt die Leiste genau das, was umrandet ist.
 *
 * - Verglichen wird über die **`personId`**, nie über den Namen (zwei Personen können gleich heißen).
 * - „Namen verbergen“ (`personId: -2` in ChurchTools) und Gäste ohne Person haben hier keine `personId` → nie fokussierbar.
 * - Ein **gültiger Entwurf** zählt als der Platz, der er sein wird (die Matrix zeigt ihn ja so); ein veralteter nicht
 *   (dort gilt ChurchTools). „Zurückziehen“-Entwürfe (frei) und Gäste sind niemand.
 * - **Abgesagte Termine** zählen nicht als Einsatz (die Spalte steht blass da, der Platz bleibt umrandet).
 */
import { tageBis, tagKurz } from '../ct/datum';
import type { EntwurfZiel } from './entwuerfe';
import type { Plan, PlanPlatz, PlanZeile } from './plan';
import { dienstAus, type PlanAus } from './planFilter';

export type FokusStand = 'zugesagt' | 'angefragt' | 'entwurf';

/** Der Entwurf an einem Platz – wie `Sicht.entwurf` (mit „veraltet“); nur das, was der Fokus braucht. */
export type FokusEntwurf = (
  spalte: number,
  zeile: PlanZeile,
  platz: PlanPlatz,
) => { entwurf: { ziel: EntwurfZiel }; veraltet: boolean } | null;

export interface FokusPlatz {
  personId: number;
  name: string;
  stand: FokusStand;
}

/**
 * **Wer steht an diesem Platz – zum Fokussieren.** `null` bei freien Plätzen, verborgenen Namen, Gästen und
 * Zurückziehen-Entwürfen. `entwurf` ist das Ergebnis von `Sicht.entwurf` für diesen Platz (oder `null`).
 */
export function platzPerson(
  p: PlanPlatz,
  entwurf: { entwurf: { ziel: EntwurfZiel }; veraltet: boolean } | null,
): FokusPlatz | null {
  if (entwurf && !entwurf.veraltet) {
    const z = entwurf.entwurf.ziel;
    return z.art === 'person' ? { personId: z.personId, name: z.name, stand: 'entwurf' } : null;
  }
  if (p.art === 'frei' || p.verborgen || p.gast || p.personId === null || p.name === null) {
    return null;
  }
  return { personId: p.personId, name: p.name, stand: p.art };
}

export interface FokusZahlen {
  /** Alle Einsätze (zugesagt, angefragt, Entwurf) in den Terminen, ohne abgesagte. */
  einsaetze: number;
  /** An wie vielen verschiedenen Terminen. */
  termine: number;
  angefragt: number;
  entwuerfe: number;
  /** Davon in ausgeblendeten Diensten oder Gruppen (Filter) – sie zählen mit, die Leiste sagt es dazu. */
  ausgeblendet: number;
}

/**
 * **Die Zahlen der Fokus-Leiste:** was die Person in den `spalten` (Indizes in `plan.spalten`, die Termine des gewählten
 * Zeitraums) macht. Gezählt wird über **alle** Dienste des Plans – ein ausgeblendeter Dienst ist trotzdem ein Einsatz –,
 * `ausgeblendet` sagt, wie viele davon der Filter versteckt (`dienstAus`, dieselbe Regel wie überall).
 */
export function fokusZahlen(
  plan: Plan,
  o: { personId: number; spalten: readonly number[]; aus: PlanAus; entwurf?: FokusEntwurf },
): FokusZahlen {
  const z: FokusZahlen = { einsaetze: 0, termine: 0, angefragt: 0, entwuerfe: 0, ausgeblendet: 0 };
  const termine = new Set<number>();
  for (const g of plan.gruppen) {
    for (const zeile of g.zeilen) {
      for (const i of o.spalten) {
        if (plan.spalten[i].abgesagt) continue;
        for (const p of zeile.zellen[i] ?? []) {
          const f = platzPerson(p, o.entwurf?.(i, zeile, p) ?? null);
          if (f?.personId !== o.personId) continue;
          z.einsaetze += 1;
          termine.add(i);
          if (f.stand === 'angefragt') z.angefragt += 1;
          if (f.stand === 'entwurf') z.entwuerfe += 1;
          if (dienstAus(g, zeile.dienst.id, o.aus)) z.ausgeblendet += 1;
        }
      }
    }
  }
  z.termine = termine.size;
  return z;
}

const mehr = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

export interface FokusTexte {
  /** „5 Einsätze“ – am Handy allein in der Leiste. */
  kurz: string;
  /** „in 5 Terminen · 1 angefragt · 1 Entwurf · 1 ausgeblendet“ – nur, was nicht null ist; am Handy eine kleine zweite Zeile. */
  detail: string;
}

/** Die Zahlen der Leiste in zwei Teilen: die Kurzfassung und die Einzelheiten. */
export function fokusTexte(z: FokusZahlen): FokusTexte {
  if (z.einsaetze === 0) return { kurz: 'keine Einsätze in diesen Terminen', detail: '' };
  return {
    kurz: mehr(z.einsaetze, 'Einsatz', 'Einsätze'),
    detail: [
      `in ${mehr(z.termine, 'Termin', 'Terminen')}`,
      z.angefragt > 0 ? `${z.angefragt} angefragt` : '',
      z.entwuerfe > 0 ? mehr(z.entwuerfe, 'Entwurf', 'Entwürfe') : '',
      z.ausgeblendet > 0 ? `${z.ausgeblendet} ausgeblendet` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** „5 Einsätze in 5 Terminen · 1 angefragt · 1 Entwurf · 1 ausgeblendet“ – die volle Fassung (Rechner). */
export function fokusZahlenText(z: FokusZahlen): string {
  const t = fokusTexte(z);
  return t.detail ? `${t.kurz} ${t.detail}` : t.kurz;
}

export interface FokusKandidat {
  personId: number;
  name: string;
  /** Die Dienste, in denen sie im Plan vorkommt, in der Reihenfolge der Matrix, ohne Doppelte. */
  dienste: string[];
}

/**
 * **Wer sich fürs Suchfeld „Person hervorheben“ anbietet:** alle Personen, die im geladenen Plan eingeteilt sind (auch
 * als Entwurf), alphabetisch. Auch Dienste, die der Filter ausblendet – der Fokus zählt sie ja mit.
 */
export function fokusKandidaten(plan: Plan, entwurf?: FokusEntwurf): FokusKandidat[] {
  const je = new Map<number, FokusKandidat>();
  for (const g of plan.gruppen) {
    for (const zeile of g.zeilen) {
      zeile.zellen.forEach((zelle, i) => {
        for (const p of zelle ?? []) {
          const f = platzPerson(p, entwurf?.(i, zeile, p) ?? null);
          if (!f) continue;
          let k = je.get(f.personId);
          if (!k) je.set(f.personId, (k = { personId: f.personId, name: f.name, dienste: [] }));
          if (!k.dienste.includes(zeile.dienst.name)) k.dienste.push(zeile.dienst.name);
        }
      });
    }
  }
  return [...je.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'de') || a.personId - b.personId,
  );
}

/** Beginnt der Name oder eines seiner Wörter mit der Eingabe? („da“ findet Daniel und David, nicht Natascha.) */
export function passtZuName(name: string, eingabe: string): boolean {
  const q = eingabe.trim().toLowerCase();
  if (q === '') return false;
  return name
    .toLowerCase()
    .split(/\s+/)
    .some((w) => w.startsWith(q));
}

export interface FokusEinsatz {
  dienst: string;
  /** `YYYY-MM-DD`. */
  tag: string;
  stand: FokusStand;
}

/** Wie weit „Wer kann?“ um den Termin herum schaut: eine Woche davor und danach. */
export const UM_TAGE = 7;

/**
 * **Einsätze in der Nähe eines Tages** (für die Mini-Zeile in „Wer kann?“): was die Person im geladenen Plan höchstens
 * `tage` Tage vor oder nach `tag` macht, nach Datum. Abgesagte Termine fehlen.
 */
export function einsaetzeUm(
  plan: Plan,
  o: { personId: number; tag: string; tage?: number; entwurf?: FokusEntwurf },
): FokusEinsatz[] {
  const tage = o.tage ?? UM_TAGE;
  const liste: FokusEinsatz[] = [];
  plan.spalten.forEach((s, i) => {
    if (s.abgesagt || Math.abs(tageBis(o.tag, s.tag)) > tage) return;
    for (const g of plan.gruppen) {
      for (const zeile of g.zeilen) {
        for (const p of zeile.zellen[i] ?? []) {
          const f = platzPerson(p, o.entwurf?.(i, zeile, p) ?? null);
          if (f?.personId === o.personId) {
            liste.push({ dienst: zeile.dienst.name, tag: s.tag, stand: f.stand });
          }
        }
      }
    }
  });
  return liste.sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Wie viele Einsätze die Mini-Zeile nennt, bevor „+ N weitere“ kommt. */
const MINI_MAX = 3;

/**
 * Die Mini-Zeile in „Wer kann?“: „Im Plan, ±7 Tage: Gesang Mi 17.12. · Bild So 21.12.“ – ein Entwurf mit „(Entwurf)“,
 * eine Anfrage mit „(?)“; ohne Einsätze „… noch nichts“.
 */
export function einsaetzeUmText(liste: readonly FokusEinsatz[], tage: number = UM_TAGE): string {
  const kopf = `Im Plan, ±${tage} Tage:`;
  if (liste.length === 0) return `${kopf} noch nichts`;
  const text = (e: FokusEinsatz) =>
    `${e.dienst} ${tagKurz(e.tag).replace(',', '')}${e.stand === 'entwurf' ? ' (Entwurf)' : e.stand === 'angefragt' ? ' (?)' : ''}`;
  const rest = liste.length - MINI_MAX;
  return `${kopf} ${liste.slice(0, MINI_MAX).map(text).join(' · ')}${rest > 0 ? ` · + ${rest} weitere` : ''}`;
}
