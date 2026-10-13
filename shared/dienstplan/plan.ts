/**
 * **Die Planen-Matrix des Dienstplaners** (Bauplan E3-4, Entwurf v17): Termine als Spalten, Dienstgruppen
 * und ihre Dienste als Zeilen, in jeder Zelle die Plätze. Nur lesen – Einteilen kommt mit E4.
 *
 * Aus derselben `/events`-Antwort wie die Termine-Liste (`termine.ts`), mit denselben Regeln: frei = ohne
 * Namen (`istFrei`), „Namen verbergen“ (`personId: -2`) zeigt nie einen Namen, zugesagt = `isAccepted`.
 * Welche Dienste überhaupt kommen, entscheidet ChurchTools (gemessen 08.10.2026: `eventServices` enthält
 * nur Dienste der Gruppen, die man sehen darf) – hier wird nichts zusätzlich versteckt.
 */
import type { Dienst } from '../ct/dienste';
import type { Dienstgruppe } from '../ct/dienstgruppen';
import { ortszeitAus } from '../ct/zeit';
import {
  istFrei,
  istTerminAdmin,
  VERBORGENE_PERSON,
  type RohPlatz,
  type RohTermin,
} from './termine';

export type PlatzArt = 'frei' | 'zugesagt' | 'angefragt';

export interface PlanPlatz {
  art: PlatzArt;
  /** Der Name zum Anzeigen; `null` bei freien und verborgenen Plätzen. */
  name: string | null;
  /** Eingetragen ohne Person (nur ein Name) – in ChurchTools ein Gast. */
  gast: boolean;
  /** „Namen verbergen“: besetzt, aber für einen selbst nicht sichtbar. */
  verborgen: boolean;
  /** Der eigene Platz. */
  ich: boolean;
  /** Die Person – `null` bei freien, verborgenen und Gast-Plätzen („Wer wie oft?“ zählt danach). */
  personId: number | null;
}

export interface PlanSpalte {
  id: number;
  name: string;
  tag: string;
  uhrzeit: string;
  abgesagt: boolean;
  /** Alle Plätze des Termins und davon besetzte – für Füllstand und „N frei“. */
  plaetze: number;
  besetzt: number;
  /** Admin dieses Termins – plant dann jeden Dienst darin. */
  admin: boolean;
}

export interface PlanZeile {
  dienst: Dienst;
  /** Je Spalte die Plätze; `null` = der Dienst ist an diesem Termin nicht vorgesehen. */
  zellen: (PlanPlatz[] | null)[];
}

export interface PlanGruppe {
  /** `null` = Dienste ohne (bekannte) Dienstgruppe. */
  gruppe: Dienstgruppe | null;
  /** Darf man in dieser Gruppe (ohne Termin-Admin) etwas planen? */
  planbar: boolean;
  zeilen: PlanZeile[];
  /** Je Spalte freie Plätze der Gruppe; `null` = die Gruppe hat dort keinen Dienst. */
  frei: (number | null)[];
}

export interface Plan {
  spalten: PlanSpalte[];
  gruppen: PlanGruppe[];
}

/** Ein Platz, wie er in der Matrix steht. */
export function platzAus(p: RohPlatz, ichId: number): PlanPlatz {
  if (istFrei(p)) {
    return { art: 'frei', name: null, gast: false, verborgen: false, ich: false, personId: null };
  }
  const art: PlatzArt = p.isAccepted === true ? 'zugesagt' : 'angefragt';
  if (p.personId === VERBORGENE_PERSON) {
    return { art, name: null, gast: false, verborgen: true, ich: false, personId: null };
  }
  return {
    art,
    name: String(p.name).trim(),
    gast: p.personId == null,
    verborgen: false,
    ich: p.personId === ichId,
    personId: typeof p.personId === 'number' ? p.personId : null,
  };
}

export function planAus(
  roh: RohTermin[],
  o: {
    ichId: number;
    dienste: Map<number, Dienst>;
    dienstgruppen: Dienstgruppe[];
    zeitzone: string;
    /** Darf man diesen Dienst planen (ohne Termin-Admin)? */
    planbar: (dienst: Dienst) => boolean;
  },
): Plan {
  const termine = [...roh].sort(
    (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate) || a.id - b.id,
  );
  const spalten: PlanSpalte[] = termine.map((t) => {
    const lokal = ortszeitAus(t.startDate, o.zeitzone);
    const plaetze = t.eventServices ?? [];
    return {
      id: t.id,
      name: t.name,
      tag: lokal.slice(0, 10),
      uhrzeit: lokal.slice(11, 16),
      abgesagt: t.isCanceled === true,
      plaetze: plaetze.length,
      besetzt: plaetze.filter((p) => !istFrei(p)).length,
      admin: istTerminAdmin(t, o.ichId),
    };
  });

  // Je Dienst und Spalte die Plätze; Dienste, die nirgends vorkommen, bleiben draußen.
  const zellen = new Map<number, (PlanPlatz[] | null)[]>();
  termine.forEach((t, i) => {
    for (const p of t.eventServices ?? []) {
      if (typeof p.serviceId !== 'number') continue;
      let reihe = zellen.get(p.serviceId);
      if (!reihe) {
        reihe = termine.map(() => null);
        zellen.set(p.serviceId, reihe);
      }
      (reihe[i] ??= []).push(platzAus(p, o.ichId));
    }
  });

  const gruppen: PlanGruppe[] = [];
  const gruppeFuer = (g: Dienstgruppe | null): PlanGruppe => {
    let pg = gruppen.find((x) => x.gruppe?.id === g?.id);
    if (!pg) {
      pg = { gruppe: g, planbar: false, zeilen: [], frei: spalten.map(() => null) };
      gruppen.push(pg);
    }
    return pg;
  };
  // In der Reihenfolge der Gemeinde: erst die Dienstgruppen, darin die Dienste (Map ist sortiert).
  const reihenfolge = [...o.dienstgruppen.map((g) => g.id), null];
  const bekannte = [...o.dienste.values()].filter((d) => zellen.has(d.id));
  for (const gid of reihenfolge) {
    const g = gid === null ? null : (o.dienstgruppen.find((x) => x.id === gid) ?? null);
    const imGruppe = bekannte.filter((d) =>
      gid === null
        ? d.dienstgruppeId === null || !o.dienstgruppen.some((x) => x.id === d.dienstgruppeId)
        : d.dienstgruppeId === gid,
    );
    if (imGruppe.length === 0) continue;
    const pg = gruppeFuer(g);
    for (const dienst of imGruppe) {
      const reihe = zellen.get(dienst.id)!;
      pg.zeilen.push({ dienst, zellen: reihe });
      if (o.planbar(dienst)) pg.planbar = true;
      reihe.forEach((plaetze, i) => {
        if (plaetze === null) return;
        pg.frei[i] = (pg.frei[i] ?? 0) + plaetze.filter((p) => p.art === 'frei').length;
      });
    }
  }
  return { spalten, gruppen };
}
