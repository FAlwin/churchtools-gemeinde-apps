/**
 * **Die Ansicht „Personen“** (Wunsch 5, Scheibe P1, Entwurf `e9-personen-v3.html`): Zeilen = Personen, Spalten = die
 * Termine der Matrix, in der Zelle der Dienst mit seinem Zustand. Nur Rechnen – die Oberfläche
 * (`dienstplaner/src/PersonenRaster.tsx`) zeigt es an.
 *
 * Nichts davon ist eine neue Regel, alles kommt aus den vorhandenen Bausteinen:
 * - **Plätze** aus dem Plan der Matrix (`planAus`): frei = `art: 'frei'`, „Namen verbergen“ (`verborgen`, ohne Person)
 *   erscheint nie mit einem Namen, ein Gast ist ein Platz mit Namen ohne Person.
 * - **Abwesend** über `decktTermin` (`@shared/absences`) – dieselbe Regel wie auf der Startseite.
 * - **Entwürfe** über den Aufrufer (`entwurf`): er reicht die Regel der Matrix herein (`entwurfAmPlatz`), veraltete
 *   Entwürfe zählen nicht (am Platz gilt dann ChurchTools).
 * - **Noch offen** zählt dieselben Plätze wie die Matrix (`zaehleFrei`; Summe = `terminStand` mit Entwürfen), **Einsätze**
 *   zählt, wer am Platz steht (`platzPerson`) – beide mit **gültigen Entwürfen** (P2a-2, Alwin 16.11.2026): ein Entwurf
 *   zählt schon wie das, was er bewirken wird (`platzNachEntwurf.ts`).
 *
 * **Zeile je Person UND Dienst** (Alwin, 06.11.2026): Wer in zwei Diensten steht (Gitarre und Gesang), steht in beiden
 * Blöcken – unter dem Namen „auch Gesang“, in der Zelle „+ Gesang“, wenn am selben Tag noch ein anderer Dienst dazukommt.
 * Das gilt auch für **ausgeblendete** Dienste: aus einer ausgeblendeten Gruppe „+ Ton (Technik)“, ein einzeln
 * ausgeblendeter Dienst einer gezeigten Gruppe „+ Bild“ (beide blass) – dafür zählen die Einteilungen aller geladenen
 * Dienste, nicht nur der gezeigten.
 */
import { decktTermin } from '../absences/index';
import type { Dienst } from '../ct/dienste';
import { initialenAus } from '../organigramm/mitglieder';
import type { Entwurf } from './entwuerfe';
import { platzPerson } from './fokus';
import { zaehleFrei, type EntwurfSuche } from './platzNachEntwurf';
import {
  gruppenName,
  type Plan,
  type PlanGruppe,
  type PlanPlatz,
  type PlanSpalte,
  type PlanZeile,
} from './plan';
import type { GruppenAbwesenheit, PersonenDaten } from './personenDaten';

/** Wie die Matrix einen Entwurf an einem Platz kennt (`entwurfAmPlatz`) – dieselbe Suche wie für „N frei“ (`platzNachEntwurf.ts`). */
export type { EntwurfSuche };

/**
 * `zurueck` (P2b): die Person steht in ChurchTools noch am Platz, ein gültiger Entwurf nimmt sie dort aber weg
 * („zurückziehen“ oder durch jemand anderen ersetzen) – wie in der Matrix, wo der Platz dann rot gestrichelt dasteht.
 */
export type ZellenZustand = 'zugesagt' | 'angefragt' | 'entwurf' | 'zurueck';

/**
 * Ein weiterer Dienst am selben Tag („+ Gesang“). `fremd`: der Dienst ist ausgeblendet (seine Gruppe oder er selbst);
 * `gruppe` steht nur, wenn die ganze Gruppe ausgeblendet ist („+ Ton (Technik)“ – ein einzeln ausgeblendeter Dienst einer
 * gezeigten Gruppe: „+ Bild“).
 */
export interface WeitererDienst {
  dienst: string;
  fremd: boolean;
  gruppe: string | null;
}

export interface RasterZelle {
  /** Der Dienst der Zeile an diesem Termin – `null`, wenn die Person dort nicht in diesem Dienst steht. */
  zustand: ZellenZustand | null;
  /** Bei `zustand: 'entwurf'`: ob der Entwurf eine Anfrage ist oder „direkt“ (P2m) – sonst `null`. */
  modus: Entwurf['modus'] | null;
  /** Andere Dienste, in denen die Person an diesem Tag eingeteilt ist. */
  weitere: WeitererDienst[];
  /** Abwesend an diesem Termin (`decktTermin`) – der Grund, sonst „Abwesend“, und der ganze Zeitraum der Abwesenheit. */
  abwesend: { grund: string; von: string; bis: string } | null;
  /** Abwesend UND eingeteilt: ein Warnfall, beides bleibt sichtbar. */
  warnung: boolean;
}

export interface RasterZeile {
  /** `Dienst|Person` – eindeutig, weil eine Person in jedem ihrer Dienste eine Zeile hat. */
  schluessel: string;
  personId: number;
  name: string;
  initialen: string;
  /** Mitglied einer CT-Gruppe des Dienstes? Sonst steht sie nur da, weil sie eingeteilt ist. */
  mitglied: boolean;
  /** Andere gezeigte Dienste, in denen sie Mitglied ist („auch Gesang“). */
  auch: string[];
  /** Einteilungen (zugesagt + angefragt + gültige Entwürfe, `platzPerson`) in diesem Dienst, in den gezeigten Terminen. */
  einsaetze: number;
  /** Je gezeigte Spalte (Reihenfolge von `spalten`). */
  zellen: RasterZelle[];
}

export interface RasterGast {
  name: string;
  /** Ein Entwurf trägt diesen Gast ein (noch nicht in ChurchTools). */
  entwurf: boolean;
  /** Der Gast steht in ChurchTools, ein gültiger Entwurf nimmt ihn dort weg (P2b). */
  zurueck: boolean;
  /** Der Platz (1-basiert) in der Zelle des Dienstes – daran öffnet ein Klick dasselbe Fenster wie in der Matrix. */
  nr: number;
  /**
   * Was ein Klick tut – dieselbe Regel wie in der Matrix (`Plaetze`): ein belegter Platz ohne Entwurf öffnet das Fenster
   * „zurückziehen oder ersetzen“, ein Platz mit gültigem Entwurf das Entwurfs-Fenster, bei einem veralteten Entwurf
   * gilt ChurchTools und es gibt nur das Schild der Matrix (hier: nichts).
   */
  klick: 'belegt' | 'entwurf' | null;
}

export interface RasterBlock {
  dienst: Dienst;
  zeilen: RasterZeile[];
  /** Plätze mit einem Namen ohne Person – je gezeigte Spalte. */
  gaeste: RasterGast[][];
  /** Die CT-Gruppen des Dienstes – daran hängen Mitglieder und Abwesenheiten. */
  gruppenIds: number[];
  /** Mitglieder einer Gruppe nicht sichtbar (403) – die Zeilen sind dann unvollständig. */
  mitgliederVerborgen: boolean;
  /** Ob man die Abwesenheiten dieses Dienstes sieht – ohne Recht sagt der Block es, statt leere Zellen zu zeigen. */
  abwesenheit: 'ok' | 'nichtSichtbar' | 'teilweise';
  /** Vorübergehend gescheiterte Gruppen – „Nochmal versuchen“. */
  fehler: { gruppenIds: number[]; text: string; nochmal: boolean } | null;
}

export interface RasterOffen {
  abgesagt: boolean;
  /** Dienste mit freien Plätzen, in der Reihenfolge der Blöcke. */
  dienste: { dienst: string; anzahl: number }[];
}

export interface Raster {
  blocks: RasterBlock[];
  /** Je gezeigte Spalte die Fußzeile „Noch offen“. */
  offen: RasterOffen[];
}

interface Einteilung {
  dienst: Dienst;
  gruppe: PlanGruppe;
  art: 'zugesagt' | 'angefragt';
}

/** Ein Platz, an dem jemand mit Namen eingeteilt ist – ohne verborgene und freie. */
const besetzt = (p: PlanPlatz): p is PlanPlatz & { art: 'zugesagt' | 'angefragt' } =>
  p.art !== 'frei' && !p.verborgen;

/**
 * **Welche Dienste einen Block bekommen**: die der gezeigten Gruppen, die an mindestens einem gezeigten Termin vorgesehen
 * sind (sonst bliebe der Block leer). Eine Stelle für die Rechnung und fürs Laden – geladen werden nur die CT-Gruppen
 * dieser Dienste.
 */
export function rasterDienste(
  plan: Plan,
  spalten: readonly number[],
  gruppen: readonly PlanGruppe[],
): { zeile: PlanZeile; gruppe: PlanGruppe }[] {
  const dienste: { zeile: PlanZeile; gruppe: PlanGruppe }[] = [];
  for (const g of gruppen)
    for (const z of g.zeilen)
      if (spalten.some((i) => plan.spalten[i] && z.zellen[i] !== null))
        dienste.push({ zeile: z, gruppe: g });
  return dienste;
}

export function personenRaster(o: {
  /** Der ganze geladene Plan – auch die ausgeblendeten Gruppen (für „+ Ton (Technik)“). */
  plan: Plan;
  /** Indizes der gezeigten Spalten in `plan.spalten`. */
  spalten: number[];
  /** Die gezeigten Gruppen mit den gezeigten Diensten (`gezeigteGruppen`, Gruppen- und Dienstfilter), in der Reihenfolge der Matrix. */
  gruppen: PlanGruppe[];
  daten: PersonenDaten;
  entwurf?: EntwurfSuche;
}): Raster {
  const { plan, spalten, gruppen, daten } = o;

  // ── Einteilungen je Person und Spalte – aus ALLEN Gruppen, nicht nur den gezeigten. ──
  const einteilungen = new Map<number, Einteilung[][]>();
  for (const g of plan.gruppen) {
    for (const z of g.zeilen) {
      spalten.forEach((i, pos) => {
        for (const p of z.zellen[i] ?? []) {
          if (!besetzt(p) || p.personId === null) continue;
          let je = einteilungen.get(p.personId);
          if (!je) {
            je = spalten.map(() => []);
            einteilungen.set(p.personId, je);
          }
          je[pos].push({ dienst: z.dienst, gruppe: g, art: p.art });
        }
      });
    }
  }

  // ── Abwesenheiten je Person – aus allen geladenen Gruppen, eine ID einmal (eine Person steht in mehreren Gruppen). ──
  const abwesenheiten = new Map<number, Map<number, GruppenAbwesenheit>>();
  for (const stand of daten.values()) {
    if (stand.art !== 'da' || stand.abwesenheiten === 'nichtSichtbar') continue;
    for (const a of stand.abwesenheiten) {
      let je = abwesenheiten.get(a.personId);
      if (!je) abwesenheiten.set(a.personId, (je = new Map<number, GruppenAbwesenheit>()));
      je.set(a.id, a);
    }
  }
  const abwesendAm = (personId: number, s: PlanSpalte): RasterZelle['abwesend'] => {
    const alle = [...(abwesenheiten.get(personId)?.values() ?? [])];
    const deckt = (a: GruppenAbwesenheit) =>
      decktTermin(a, { startDate: s.beginn, endDate: s.ende, date: s.tag });
    // Ein Eintrag mit Uhrzeit zuerst – er gehört genau zu diesem Termin (wie `abwesenheitFuerTermin`).
    const treffer = alle.find((a) => a.startTime !== null && deckt(a)) ?? alle.find(deckt);
    return treffer
      ? { grund: treffer.grund ?? 'Abwesend', von: treffer.startDate, bis: treffer.endDate }
      : null;
  };

  const diensteZeilen = rasterDienste(plan, spalten, gruppen);
  // Ausgeblendet = nicht in den gezeigten Gruppen (`gezeigteGruppen`) – für Gruppen- und Dienstfilter dieselbe Regel.
  const gezeigteDienste = new Set(gruppen.flatMap((g) => g.zeilen.map((z) => z.dienst.id)));
  const gezeigteGruppen = new Set(gruppen.map((g) => g.gruppe?.id ?? null));

  /** Die Mitglieder (aktiv) der CT-Gruppen eines Dienstes, Personen zusammengeführt. */
  const mitgliederDes = (d: Dienst) => {
    const je = new Map<number, { name: string; initialen: string }>();
    for (const gid of d.gruppenIds) {
      const stand = daten.get(gid);
      if (stand?.art !== 'da' || stand.mitglieder === 'verborgen') continue;
      for (const m of stand.mitglieder) if (!je.has(m.id)) je.set(m.id, m);
    }
    return je;
  };
  const mitgliederJeDienst = new Map(
    diensteZeilen.map((x) => [x.zeile.dienst.id, mitgliederDes(x.zeile.dienst)]),
  );

  const blocks: RasterBlock[] = diensteZeilen.map(({ zeile: z }) => {
    const dienst = z.dienst;
    const mitglieder = mitgliederJeDienst.get(dienst.id)!;

    // Wer eine Zeile bekommt: Mitglieder + im Zeitraum Eingeteilte + Entwürfe auf Personen.
    const personen = new Map<number, { name: string; initialen: string }>(mitglieder);
    const gaeste: RasterGast[][] = spalten.map(() => []);
    const entwurfZelle = new Map<number, Map<number, Entwurf['modus']>>(); // Person → Position → Modus
    const einsaetze = new Map<number, number>();
    spalten.forEach((i, pos) => {
      for (const [platzIndex, p] of (z.zellen[i] ?? []).entries()) {
        const e = o.entwurf?.(i, z, p) ?? null;
        if (besetzt(p)) {
          if (p.personId !== null && p.name !== null) {
            // Die Zeile gibt es, solange ChurchTools die Person dort hat (auch wenn ein Entwurf sie zurückzieht).
            if (!personen.has(p.personId))
              personen.set(p.personId, { name: p.name, initialen: initialenAus(p.name) });
          } else if (p.gast && p.name !== null) {
            gaeste[pos].push({
              name: p.name,
              entwurf: false,
              zurueck: e !== null && !e.veraltet,
              nr: platzIndex + 1,
              klick: e === null ? 'belegt' : e.veraltet ? null : 'entwurf',
            });
          }
        }
        // Einsätze: wer am Platz steht – nach einem gültigen Entwurf, sonst nach ChurchTools (dieselbe Regel wie der Fokus).
        const wer = platzPerson(p, e);
        if (wer) einsaetze.set(wer.personId, (einsaetze.get(wer.personId) ?? 0) + 1);
        if (!e || e.veraltet) continue;
        const ziel = e.entwurf.ziel;
        if (ziel.art === 'person') {
          if (!personen.has(ziel.personId))
            personen.set(ziel.personId, { name: ziel.name, initialen: initialenAus(ziel.name) });
          let je = entwurfZelle.get(ziel.personId);
          if (!je) entwurfZelle.set(ziel.personId, (je = new Map<number, Entwurf['modus']>()));
          je.set(pos, e.entwurf.modus ?? 'anfrage');
        } else if (ziel.art === 'gast') {
          gaeste[pos].push({
            name: ziel.name,
            entwurf: true,
            zurueck: false,
            nr: platzIndex + 1,
            klick: 'entwurf',
          });
        }
      }
    });

    const zeilen: RasterZeile[] = [...personen.entries()]
      .map(([personId, person]) => {
        const auch = diensteZeilen
          .filter(
            (x) =>
              x.zeile.dienst.id !== dienst.id &&
              mitgliederJeDienst.get(x.zeile.dienst.id)!.has(personId),
          )
          .map((x) => x.zeile.dienst.name);
        const eigene = einteilungen.get(personId);
        const zellen: RasterZelle[] = spalten.map((i, pos) => {
          const hier = z.zellen[i] ?? [];
          const platz = hier.filter((p) => besetzt(p) && p.personId === personId);
          // Wird die Person an JEDEM ihrer Plätze hier von einem gültigen Entwurf weggenommen (zurückziehen oder durch
          // jemand anderen ersetzen), zeigt die Zelle es wie die Matrix. Ein eigener Entwurf auf sie geht vor.
          const weggenommen =
            platz.length > 0 &&
            platz.every((p) => {
              const e = o.entwurf?.(i, z, p) ?? null;
              if (!e || e.veraltet) return false;
              const ziel = e.entwurf.ziel;
              return !(ziel.art === 'person' && ziel.personId === personId);
            });
          const eigenerEntwurf = entwurfZelle.get(personId)?.has(pos) ?? false;
          const zustand: ZellenZustand | null =
            weggenommen && !eigenerEntwurf
              ? 'zurueck'
              : platz.some((p) => p.art === 'zugesagt')
                ? 'zugesagt'
                : platz.length > 0
                  ? 'angefragt'
                  : eigenerEntwurf
                    ? 'entwurf'
                    : null;
          const weitere: WeitererDienst[] = (eigene?.[pos] ?? [])
            .filter((x) => x.dienst.id !== dienst.id)
            .map((x) => {
              const fremd = !gezeigteDienste.has(x.dienst.id);
              // Der Gruppenname nur, wenn die ganze Gruppe fehlt – ein einzeln ausgeblendeter Dienst einer gezeigten
              // Gruppe steht ohne („+ Bild“).
              const gruppeFehlt = !gezeigteGruppen.has(x.gruppe.gruppe?.id ?? null);
              return {
                dienst: x.dienst.name,
                fremd,
                gruppe: fremd && gruppeFehlt ? gruppenName(x.gruppe) : null,
              };
            });
          const abwesend = abwesendAm(personId, plan.spalten[i]);
          const modus =
            zustand === 'entwurf' ? (entwurfZelle.get(personId)?.get(pos) ?? null) : null;
          return {
            zustand,
            modus,
            weitere,
            abwesend,
            // Wird sie ohnehin weggenommen, ist die Abwesenheit kein Warnfall mehr.
            warnung: abwesend !== null && zustand !== null && zustand !== 'zurueck',
          };
        });
        return {
          schluessel: `${dienst.id}|${personId}`,
          personId,
          name: person.name,
          initialen: person.initialen,
          mitglied: mitglieder.has(personId),
          auch,
          einsaetze: einsaetze.get(personId) ?? 0,
          zellen,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de') || a.personId - b.personId);

    // Stand der CT-Gruppen dieses Dienstes.
    const staende = dienst.gruppenIds.map((id) => ({ id, stand: daten.get(id) }));
    const fehlerGruppen = staende.flatMap((x) => (x.stand?.art === 'fehler' ? [x] : []));
    const da = staende.flatMap((x) => (x.stand?.art === 'da' ? [x.stand] : []));
    const ohneRecht = da.filter((s) => s.abwesenheiten === 'nichtSichtbar').length;
    const fehlerStand = fehlerGruppen[0]?.stand;
    return {
      dienst,
      zeilen,
      gaeste,
      gruppenIds: dienst.gruppenIds,
      mitgliederVerborgen: da.some((s) => s.mitglieder === 'verborgen'),
      abwesenheit: ohneRecht === 0 ? 'ok' : ohneRecht === da.length ? 'nichtSichtbar' : 'teilweise',
      fehler:
        fehlerStand?.art === 'fehler'
          ? {
              gruppenIds: fehlerGruppen.map((x) => x.id),
              text: fehlerStand.text,
              nochmal: fehlerGruppen.some((x) => x.stand?.art === 'fehler' && x.stand.nochmal),
            }
          : null,
    };
  });

  // ── „Noch offen“: dieselben freien Plätze wie die Matrix, je Termin und gezeigtem Dienst. ──
  const offen: RasterOffen[] = spalten.map((i) => ({
    abgesagt: plan.spalten[i].abgesagt,
    dienste: diensteZeilen.flatMap(({ zeile }) => {
      const anzahl = zaehleFrei(zeile.zellen[i] ?? [], (p) => o.entwurf?.(i, zeile, p) ?? null);
      return anzahl > 0 && !plan.spalten[i].abgesagt ? [{ dienst: zeile.dienst.name, anzahl }] : [];
    }),
  }));
  return { blocks, offen };
}

/** „Gesang ×2“ – der Text eines roten Tags in „Noch offen“; ein einzelner Platz steht ohne Zahl. */
export const offenText = (o: { dienst: string; anzahl: number }) =>
  o.anzahl > 1 ? `${o.dienst} ×${o.anzahl}` : o.dienst;
