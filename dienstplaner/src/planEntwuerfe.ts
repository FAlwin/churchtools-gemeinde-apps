import { monatName, tagKurz } from '@shared/ct/datum';
import type { Dienst } from '@shared/ct/dienste';
import type { TerminVorlage } from '@shared/ct/terminVorlagen';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import {
  diensteDerGruppe,
  type Plan,
  type PlanGruppe,
  type PlanPlatz,
  type PlanSpalte,
  type PlanZeile,
} from '@shared/dienstplan/plan';
import { entwurfVeraltet, ortSchluessel, type Entwurf } from '@shared/dienstplan/entwuerfe';
import type { Eingeplant } from '@shared/dienstplan/zauberstab';
import type { AlterEntwurf } from './AlteEntwuerfeFach';
import type { EntwuerfeDaten } from './ladeEntwuerfe';
import type { PlaetzeZeile } from './PlaetzeFach';
import type { SendeZeile } from './SendenFach';
import type { TerminStand } from './terminStand';
import type { ZauberZeile } from './ZauberstabFach';
import { darfPlanen, type EntwurfAmPlatz } from './planSicht';
import { ganzSichtbar, planbar, type Start } from './start';

/**
 * **Die Regeln der Entwürfe in „Planen“** (#845, Scheibe 4a-2: aus der Komponente herausgezogen, unverändert). Reine
 * Funktionen über Plan und geladene Entwürfe – `daten` ist `null`, solange die Entwürfe nicht geladen sind; dann gibt
 * es nichts (keinen Entwurf, nichts zu ändern, nichts zu senden).
 */

/**
 * Der Entwurf an einem Platz. Gültig ist er nur, wenn am Platz in ChurchTools noch dasselbe steht wie beim
 * Eintragen – sonst ist er **veraltet**: Es gilt ChurchTools, und am Platz steht nur ein Schild (Alwin,
 * 14.10.2026). Verglichen wird mit derselben Regel wie beim Senden (`p.belegung`, `gleicherStand` – auch eine
 * inzwischen gegebene Zusage zählt als Änderung, Alwin 15.10.2026).
 */
export function entwurfAmPlatz(
  daten: EntwuerfeDaten | null,
  s: PlanSpalte,
  zl: PlanZeile,
  p: PlanPlatz,
): EntwurfAmPlatz | null {
  if (!daten) return null;
  const e = daten.entwuerfe.get(
    ortSchluessel({ eventId: s.id, serviceId: zl.dienst.id, index: p.index }),
  );
  if (!e) return null;
  return { entwurf: e, veraltet: entwurfVeraltet(e, p.belegung) };
}

/** Darf man die Entwürfe dieser Gruppe ändern? (Schublade bereit) */
export const darfAendern = (daten: EntwuerfeDaten | null, zl: PlanZeile) =>
  !!daten && daten.schubladen.get(zl.dienst.dienstgruppeId ?? 0)?.stand === 'bereit';

/**
 * Entwürfe ohne Platz (#582): Am geladenen Termin passt die Platznummer nicht mehr (Platzzahl in ChurchTools
 * geändert – gemessen: dann wird neu nummeriert) → Schild beim Dienst. Gehört der Dienst nicht mehr zum Termin,
 * oder ist der Termin vorbei bzw. gelöscht → „alte Entwürfe“ zum Aufräumen. Termine außerhalb des Zeitraums sind
 * `fremd` – ihr Stand (`staende`) wird nachgefragt; ein künftiger Termin dort ist normal.
 */
export function entwurfsLage(
  plan: Plan | null,
  daten: EntwuerfeDaten | null,
  staende: ReadonlyMap<number, TerminStand>,
  heute: string,
) {
  const schilder = new Map<string, Entwurf[]>();
  const alte: AlterEntwurf[] = [];
  const fremd = new Set<number>();
  if (!plan || !daten) return { schilder, alte, fremd: [] as number[] };
  const spalteJe = new Map(plan.spalten.map((sp, i) => [sp.id, i]));
  const zeileJe = new Map(plan.gruppen.flatMap((g) => g.zeilen).map((zl) => [zl.dienst.id, zl]));
  const aendern = (gruppeId: number) => daten.schubladen.get(gruppeId)?.stand === 'bereit';
  for (const [k, e] of daten.entwuerfe) {
    const gruppeId = daten.gruppeJe.get(k);
    if (gruppeId === undefined) continue;
    const i = spalteJe.get(e.ort.eventId);
    const dienst = zeileJe.get(e.ort.serviceId)?.dienst.name;
    if (i === undefined) {
      const st = staende.get(e.ort.eventId);
      if (!st) fremd.add(e.ort.eventId);
      else if (aendern(gruppeId) && st.art === 'weg') {
        alte.push({ entwurf: e, gruppeId, grund: 'termin-weg', dienst });
      } else if (aendern(gruppeId) && st.art === 'da' && st.tag < heute) {
        alte.push({ entwurf: e, gruppeId, grund: 'vorbei', termin: st, dienst });
      }
      continue;
    }
    const sp = plan.spalten[i];
    const zl = zeileJe.get(e.ort.serviceId);
    // Dienst gar nicht in der Matrix (z. B. Gruppe nicht ganz sichtbar) – dann nichts behaupten.
    if (!zl) continue;
    const zelle = zl.zellen[i];
    if (zelle === null) {
      if (aendern(gruppeId)) {
        alte.push({
          entwurf: e,
          gruppeId,
          grund: 'dienst-weg',
          termin: { name: sp.name, tag: sp.tag },
          dienst,
        });
      }
      continue;
    }
    if (zelle.some((p) => p.index === e.ort.index)) continue;
    const sk = `${sp.id}|${zl.dienst.id}`;
    schilder.set(sk, [...(schilder.get(sk) ?? []), e]);
  }
  return { schilder, alte, fremd: [...fremd].sort((a, b) => a - b) };
}

/**
 * Die freien Plätze für den Zauberstab (E5-2): nicht abgesagt, nicht vorbei, wo man den Dienst planen und die
 * Entwürfe der Gruppe ändern darf – **ohne Entwurf** (die bleiben, wie sie sind; gezählt in `mitEntwurf`).
 * Der Reihe nach: Termin, Dienst, Platz – so rechnet auch der Kern.
 */
export function zauberZeilen(
  plan: Plan | null,
  daten: EntwuerfeDaten | null,
  heute: string,
  idx: number[],
  g: PlanGruppe,
): { zeilen: ZauberZeile[]; mitEntwurf: number } {
  const zeilen: ZauberZeile[] = [];
  let mitEntwurf = 0;
  if (!plan || !daten) return { zeilen, mitEntwurf };
  for (const i of [...idx].sort((a, b) => a - b)) {
    const s = plan.spalten[i];
    if (s.abgesagt || s.tag < heute) continue;
    for (const zl of g.zeilen) {
      if (!darfPlanen(zl, s) || !darfAendern(daten, zl)) continue;
      const zelle = zl.zellen[i] ?? [];
      zelle.forEach((p, n) => {
        if (p.art !== 'frei') return;
        if (entwurfAmPlatz(daten, s, zl, p)) {
          mitEntwurf++;
          return;
        }
        zeilen.push({
          schluessel: ortSchluessel({ eventId: s.id, serviceId: zl.dienst.id, index: p.index }),
          terminId: s.id,
          serviceId: zl.dienst.id,
          tag: s.tag,
          schonDa: zelle.flatMap((x) => (x.personId !== null ? [x.personId] : [])),
          dienst: zl.dienst.name,
          nr: n + 1,
          von: zelle.length,
          kopf: `${tagKurz(s.tag)} · ${s.name} · ${s.uhrzeit} Uhr`,
          monatName: monatName(s.tag),
          index: p.index,
          gruppeId: zl.dienst.dienstgruppeId ?? 0,
          gesehen: p.belegung,
          stift: zl.planbar,
        });
      });
    }
  }
  return { zeilen, mitEntwurf };
}

/**
 * Was im Lauf schon feststeht (Alwin, 16.10.: „mitzählen“): Entwürfe mit Person in der Schublade dieser Gruppe,
 * an Terminen der Matrix (dort kennen wir den Tag).
 */
export function zauberEingeplant(
  plan: Plan | null,
  daten: EntwuerfeDaten | null,
  g: PlanGruppe,
): Eingeplant[] {
  if (!plan || !daten || !g.gruppe) return [];
  const tagJe = new Map(plan.spalten.map((s) => [s.id, s.tag]));
  const out: Eingeplant[] = [];
  for (const [k, e] of daten.entwuerfe) {
    const tag = tagJe.get(e.ort.eventId);
    if (daten.gruppeJe.get(k) !== g.gruppe.id || !tag || e.ziel.art !== 'person') continue;
    out.push({ personId: e.ziel.personId, tag });
  }
  return out;
}

/**
 * **Alle Dienste der Gemeinde, wie `planAus` sie kennt** – damit das Plätze-Fach auch Dienste anbietet, die im geladenen
 * Zeitraum noch nirgends einen Platz haben (die Matrix baut für sie keine Zeile). Die Regeln „ganz sichtbar“ und „darf
 * planen“ kommen aus derselben Quelle wie die der Matrix (`ganzSichtbar`/`planbar` aus `start.ts`, siehe
 * `ladeTermine.datenAus`) – nicht nachgebaut.
 */
export interface DiensteKatalog {
  /** In der Reihenfolge der Gemeinde (`/services`, `sortKey`) – so sortiert auch die Matrix. */
  dienste: ReadonlyMap<number, Dienst>;
  dienstgruppen: readonly Dienstgruppe[];
  /** Darf man den Dienst planen (ohne Termin-Admin)? Wie `planAus` → `o.planbar`. */
  planbar: (dienst: Dienst) => boolean;
  /** Liefert ChurchTools alle Plätze des Dienstes? Wie `planAus` → `o.ganzSichtbar`. */
  ganzSichtbar: (dienst: Dienst) => boolean;
}

/** Der Katalog aus dem Start – dieselben Funktionen, mit denen `ladeTermine` die Matrix baut. */
export const katalogAus = (start: Start): DiensteKatalog => ({
  dienste: start.dienste,
  dienstgruppen: start.dienstgruppen,
  planbar: (d) => planbar(start, d),
  ganzSichtbar: (d) => ganzSichtbar(start, d),
});

/** Der Stand eines Dienstes an einem Termin – aus seiner Zeile; ohne Zeile hat er dort keinen Platz. */
function plaetzeZeile(
  daten: EntwuerfeDaten | null,
  s: PlanSpalte,
  i: number,
  dienst: Dienst,
  zl: PlanZeile | undefined,
): PlaetzeZeile {
  const zelle = zl?.zellen[i] ?? [];
  return {
    serviceId: dienst.id,
    name: dienst.name,
    anzahl: zelle.length,
    belegt: zelle.filter((p) => p.art !== 'frei').length,
    entwuerfe: zl ? zelle.filter((p) => entwurfAmPlatz(daten, s, zl, p) !== null).length : 0,
  };
}

/**
 * Darf man diesen Dienst an diesem Termin im Fach ändern? **Eine Stelle** für Gruppenfach und Vorlage. Mit Zeile gilt
 * `darfPlanen` (Zeile oder Termin-Admin, wie überall); ohne Zeile – der Dienst hat im Zeitraum keinen Platz – gilt
 * dieselbe Regel über den Katalog, dazu muss man ihn ganz sehen dürfen (sonst baut auch `planAus` keine Zeile).
 */
function darfImFach(
  k: DiensteKatalog,
  s: PlanSpalte,
  dienst: Dienst,
  zl: PlanZeile | undefined,
): boolean {
  return zl ? darfPlanen(zl, s) : k.ganzSichtbar(dienst) && (k.planbar(dienst) || s.admin);
}

/**
 * Die Dienste einer Gruppe an einem Termin fürs Plätze-Fach – nur, wo man plant. Nicht unter „belegt“; liegen dort
 * Entwürfe, bleibt die Zahl, wie sie ist (ChurchTools nummeriert die Plätze dabei neu – gemessen 15.10.2026).
 *
 * Mit `katalog` stehen **alle Dienste der Gruppe** da, auch die ohne Matrixzeile – mit Anzahl 0 („nicht vorgesehen“), dort
 * schaltet „+“ sie ein (13.11.2026: „Abendmahl“ fehlte, weil er im Zeitraum nirgends vorkam). Die Matrix selbst bekommt
 * keine Leerzeilen. Ohne `katalog` nur die Dienste mit Zeile.
 */
export function plaetzeZeilen(
  daten: EntwuerfeDaten | null,
  s: PlanSpalte,
  i: number,
  g: PlanGruppe,
  katalog?: DiensteKatalog,
): PlaetzeZeile[] {
  if (!katalog) {
    return g.zeilen
      .filter((zl) => darfPlanen(zl, s))
      .map((zl) => plaetzeZeile(daten, s, i, zl.dienst, zl));
  }
  const zeileJe = new Map(g.zeilen.map((zl) => [zl.dienst.id, zl]));
  return diensteDerGruppe(
    [...katalog.dienste.values()],
    katalog.dienstgruppen,
    g.gruppe?.id ?? null,
  )
    .filter((d) => darfImFach(katalog, s, d, zeileJe.get(d.id)))
    .map((d) => plaetzeZeile(daten, s, i, d, zeileJe.get(d.id)));
}

/**
 * Die Dienste **aller übrigen Gruppen**, die man an diesem Termin planen darf – für „Vorlage übernehmen“, die über alle
 * Dienstgruppen wirkt. Dieselbe Regel wie `plaetzeZeilen` (`darfImFach`).
 */
export function plaetzeWeitere(
  daten: EntwuerfeDaten | null,
  plan: Plan,
  s: PlanSpalte,
  i: number,
  g: PlanGruppe,
  katalog: DiensteKatalog,
): PlaetzeZeile[] {
  const zeileJe = new Map(plan.gruppen.flatMap((pg) => pg.zeilen).map((zl) => [zl.dienst.id, zl]));
  const eigene = new Set(
    diensteDerGruppe(
      [...katalog.dienste.values()],
      katalog.dienstgruppen,
      g.gruppe?.id ?? null,
    ).map((d) => d.id),
  );
  return [...katalog.dienste.values()]
    .filter((d) => !eigene.has(d.id) && darfImFach(katalog, s, d, zeileJe.get(d.id)))
    .map((d) => plaetzeZeile(daten, s, i, d, zeileJe.get(d.id)));
}

/**
 * Was das Plätze-Fach für „Vorlage übernehmen“ braucht – nur, wenn der Termin einen bekannten Kalender hat (die Vorlagen
 * gehören je zu einem Kalender; ohne ihn ließe sich keine zuordnen).
 */
export function vorlageFuer(
  katalog: DiensteKatalog,
  s: PlanSpalte,
  laden: () => Promise<TerminVorlage[]>,
) {
  if (!s.kalender) return undefined;
  return {
    kalenderId: s.kalender.id,
    laden,
    namen: new Map([...katalog.dienste].map(([id, d]) => [id, d.name])),
  };
}

/**
 * Die Leiste unten und das Senden-Fach (E4-4): **eine** Regel für Zählen und Senden (Bauplan: „Zählen und Senden aus
 * derselben Regel“) – gültige Entwürfe im geladenen Zeitraum, wo man planen und die Schublade ändern darf; nach
 * Terminen geordnet. Veraltete werden nie gesendet.
 */
export function sendbareZeilen(plan: Plan | null, daten: EntwuerfeDaten | null): SendeZeile[] {
  if (!plan || !daten) return [];
  const zeilen: SendeZeile[] = [];
  plan.spalten.forEach((spalte, i) => {
    for (const g of plan.gruppen) {
      for (const zl of g.zeilen) {
        if (!darfPlanen(zl, spalte) || !darfAendern(daten, zl)) continue;
        const kategorie = daten.schubladen.get(zl.dienst.dienstgruppeId ?? 0)?.kategorie;
        if (kategorie == null) continue;
        for (const p of zl.zellen[i] ?? []) {
          const a = entwurfAmPlatz(daten, spalte, zl, p);
          if (!a || a.veraltet) continue;
          zeilen.push({
            entwurf: a.entwurf,
            kategorie,
            tag: spalte.tag,
            termin: spalte.name,
            dienst: zl.dienst.name,
            bisher: p.art === 'frei' || p.verborgen ? null : p.name,
          });
        }
      }
    }
  });
  return zeilen;
}

/**
 * Der Satz im Senden-Fach der Termin-Ansicht: Entwürfe an anderen Terminen werden hier nicht gesendet (F1, Alwin
 * 09.11.2026: senden nur, was an diesem Termin steht) – sie stehen unter „Planen“.
 */
export function andereTermineText(daten: EntwuerfeDaten, terminId: number): string | undefined {
  const andere = new Set(
    [...daten.entwuerfe.values()].map((e) => e.ort.eventId).filter((id) => id !== terminId),
  ).size;
  if (andere === 0) return undefined;
  return andere === 1
    ? 'An einem anderen Termin liegen noch Entwürfe – die sendest du unter „Planen“.'
    : `An ${andere} anderen Terminen liegen noch Entwürfe – die sendest du unter „Planen“.`;
}
