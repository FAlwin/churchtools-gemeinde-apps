/**
 * **Die laufenden Abfragen für Startseite und „Wann kann ich?“** (R-3): Laden und Zusammenstellen. Die Rechnung steht in
 * `shared/dienstplan/abfrageStand.ts` (`meinStandInAbfrage` → `offeneTermine`); hier wird nur geholt, was sie braucht.
 *
 * **Ladeweg (Startseite):** Die Startseite lädt ihre Termine nur 8 Wochen voraus – eine Abfrage kann weiter hinten liegen.
 * Darum holt `ladeKarten` den **Zeitraum der Abfrage** selbst (`ladeZeitraum`, dieselbe Abfrage wie der Zeitraum-Knopf in
 * Planen). Antworten: `ladeVerfuegbarkeit` (derselbe Speicher wie „Wann kann ich?“), Abwesenheiten: `ladeAbwesenheiten`.
 *
 * **Die Startseite darf daran nie scheitern:** Jeder Fehler (nicht lesbar, kein Recht, Netz) ergibt „keine Karte“ – nie einen
 * Fehlerbalken, nie ein Schreiben. Wer die Antworten nicht lesen kann (`lesefehler`, kein bereiter Speicher), sieht keine
 * Karte: „offen“ wäre geraten.
 */
import { useEffect } from 'react';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import {
  abfrageZustand,
  laufendeAbfrage,
  type Abfrage,
  type AbfragenInhalt,
} from '@shared/dienstplan/abfragen';
import {
  eingeteilteTermine,
  meinStandInAbfrage,
  type MeinStand,
} from '@shared/dienstplan/abfrageStand';
import type { TerminZeile } from '@shared/dienstplan/termine';
import type { Antworten } from '@shared/dienstplan/verfuegbarkeit';
import type { CtAbsence } from '@shared/ct/typen';
import { useLaden } from '@ui/ct/useLaden';
import { ladeAbfragen } from './ladeAbfragen';
import { ladeAbwesenheiten } from './ladeBeiwerk';
import { ladeZeitraum } from './ladeTermine';
import { ladeVerfuegbarkeit } from './ladeVerfuegbarkeit';
import { eigeneDienstgruppen, planbareDienstgruppen, type Start } from './start';

/** Eine laufende (nicht beendete) Abfrage einer Dienstgruppe, samt dem Dokument, in dem sie steht (für den Plan). */
export interface AbfrageLage {
  gruppe: Dienstgruppe;
  inhalt: AbfragenInhalt;
  abfrage: Abfrage;
}

/** Die laufende Abfrage jeder Gruppe – Gruppen ohne, mit Lesefehler oder unlesbarem Wert fehlen einfach (nichts wird geraten). */
async function laufende(
  gruppen: readonly Dienstgruppe[],
  heute: string,
): Promise<Map<number, AbfrageLage>> {
  const lagen = await Promise.all(
    gruppen.map(async (gruppe): Promise<AbfrageLage | null> => {
      try {
        const s = await ladeAbfragen(gruppe.id);
        if (s.fehler !== null || s.unlesbar) return null;
        const abfrage = laufendeAbfrage(s.inhalt, heute);
        return abfrage ? { gruppe, inhalt: s.inhalt, abfrage } : null;
      } catch {
        return null;
      }
    }),
  );
  return new Map(lagen.flatMap((l) => (l ? [[l.gruppe.id, l] as const] : [])));
}

/** Mein Stand in der Abfrage – die Daten, wie sie die Rechnung braucht (Einteilungen aus den Terminen und `start.dienste`). */
export function meinStand(o: {
  start: Pick<Start, 'dienste'>;
  lage: Pick<AbfrageLage, 'gruppe' | 'abfrage'>;
  zeilen: readonly TerminZeile[];
  antworten: Antworten;
  abwesenheiten: readonly CtAbsence[];
  heute: string;
}): MeinStand<TerminZeile> {
  return meinStandInAbfrage({
    abfrage: o.lage.abfrage,
    termine: o.zeilen,
    antworten: o.antworten,
    abwesenheiten: o.abwesenheiten,
    eingeteilt: eingeteilteTermine(
      o.zeilen,
      o.lage.gruppe.id,
      (serviceId) => o.start.dienste.get(serviceId)?.dienstgruppeId,
    ),
    heute: o.heute,
  });
}

/** Eine Karte auf der Startseite: die Abfrage und was mir darin noch fehlt. */
export interface Karte extends AbfrageLage {
  stand: { offen: number; gesamt: number };
}

/**
 * Die Karten für Mitarbeitende: je eigener Dienstgruppe mit einer Abfrage im Zustand **offen** oder **Frist vorbei**, in der
 * noch etwas offen ist. Wirft nicht – bei jedem Fehler gibt es keine Karte.
 */
export async function ladeKarten(
  start: Start,
  heute: string,
  zeitzone: string,
  gruppenLagen?: Map<number, AbfrageLage>,
): Promise<Karte[]> {
  try {
    const eigene = eigeneDienstgruppen(start);
    const lagen = [...(gruppenLagen ?? (await laufende(eigene, heute))).values()].filter(
      (l) =>
        eigene.some((g) => g.id === l.gruppe.id) &&
        ['offen', 'fristVorbei'].includes(abfrageZustand(l.abfrage, heute)),
    );
    if (lagen.length === 0) return [];
    const v = await ladeVerfuegbarkeit(eigene, start.ichId);
    // Ohne lesbare Antworten wäre „offen“ geraten.
    if (v.lesefehler !== null || v.bereit.length === 0) return [];
    const bis = lagen.map((l) => l.abfrage.bis).reduce((a, b) => (a > b ? a : b));
    const [abwesenheiten, zeilenJe] = await Promise.all([
      ladeAbwesenheiten(start.ichId, heute, bis),
      Promise.all(
        lagen.map((l) =>
          ladeZeitraum(start, l.abfrage.von, l.abfrage.bis, zeitzone).then((d) => d.zeilen),
        ),
      ),
    ]);
    return lagen.flatMap((lage, i) => {
      const s = meinStand({
        start,
        lage,
        zeilen: zeilenJe[i],
        antworten: v.antworten,
        abwesenheiten,
        heute,
      });
      return s.offen.length > 0
        ? [{ ...lage, stand: { offen: s.offen.length, gesamt: s.gesamt } }]
        : [];
    });
  } catch (e) {
    console.warn('[startseite] Abfragen nicht geladen – keine Karte:', e);
    return [];
  }
}

/** Was die Startseite zu Abfragen zeigt: Karten für mich, Zeilen für die Gruppen, die ich plane. */
export interface StartAbfragen {
  karten: Karte[];
  /** Je planbarer Dienstgruppe mit laufender Abfrage (auch „geplant“). */
  planer: AbfrageLage[];
}

const KEINE: StartAbfragen = { karten: [], planer: [] };

/** Beides in einem Zug, damit jede Dienstgruppe nur einmal gelesen wird. Wirft nicht. */
export async function ladeStartAbfragen(
  start: Start,
  heute: string,
  zeitzone: string,
): Promise<StartAbfragen> {
  try {
    const planbar = planbareDienstgruppen(start);
    const alle = new Map([...eigeneDienstgruppen(start), ...planbar].map((g) => [g.id, g]));
    const lagen = await laufende([...alle.values()], heute);
    return {
      karten: await ladeKarten(start, heute, zeitzone, lagen),
      planer: planbar.flatMap((g) => {
        const l = lagen.get(g.id);
        return l ? [l] : [];
      }),
    };
  } catch {
    return KEINE;
  }
}

/** Für die Startseite: lädt beim Öffnen; solange es lädt oder wenn etwas scheitert, ist es leer. */
export function useStartAbfragen(start: Start, heute: string, zeitzone: string): StartAbfragen {
  const { stand } = useLaden(
    () => ladeStartAbfragen(start, heute, zeitzone),
    [start, heute, zeitzone],
  );
  return stand.art === 'fertig' ? stand.daten : KEINE;
}

/** Die Abfrage hinter dem Band in „Wann kann ich?“ und die Termine ihres Zeitraums (`zeilen`: `null` = nicht ladbar). */
export interface BandLage extends AbfrageLage {
  zeilen: TerminZeile[] | null;
}

/**
 * Die Abfrage für `#/abwesenheiten?abfrage=<id>`: gültig nur für eine **eigene** Dienstgruppe mit laufender Abfrage – sonst
 * `null` (die Seite bleibt wie heute). Wirft nicht; die Termine des Zeitraums sind Beiwerk (ohne sie steht das Band ohne Zahl).
 */
export async function ladeBandLage(
  start: Start,
  dienstgruppeId: number,
  heute: string,
  zeitzone: string,
): Promise<BandLage | null> {
  try {
    const gruppe = eigeneDienstgruppen(start).find((g) => g.id === dienstgruppeId);
    if (!gruppe) return null;
    const lage = (await laufende([gruppe], heute)).get(gruppe.id);
    if (!lage) return null;
    const zeilen = await ladeZeitraum(start, lage.abfrage.von, lage.abfrage.bis, zeitzone).then(
      (d) => d.zeilen,
      () => null,
    );
    return { ...lage, zeilen };
  } catch {
    return null;
  }
}

/**
 * Das Band: die Abfrage (`null` ohne gültige) und – sobald Termine und Abwesenheiten da sind – mein Stand. `antworten` sind die
 * Antworten der Seite (nach dem Speichern sofort neu), `schreibStand` zählt jeden Speicherversuch hoch (Abwesenheiten neu).
 */
export function useBand(o: {
  start: Start | undefined;
  dienstgruppeId: number | null;
  heute: string;
  zeitzone: string;
  antworten: Antworten;
  schreibStand: number;
}): { lage: BandLage; stand: MeinStand<TerminZeile> | null } | null {
  const { start, dienstgruppeId, heute, zeitzone } = o;
  const lageStand = useLaden(
    () =>
      dienstgruppeId === null || !start
        ? null
        : ladeBandLage(start, dienstgruppeId, heute, zeitzone),
    [start, dienstgruppeId, heute, zeitzone],
  ).stand;
  const lage = lageStand.art === 'fertig' ? lageStand.daten : null;
  const { stand: abwStand, neu: abwNeu } = useLaden(
    () => (lage && start ? ladeAbwesenheiten(start.ichId, heute, lage.abfrage.bis) : null),
    [lage, start, heute],
    { behalten: true },
  );
  // Nach jedem Speicherversuch die Abwesenheiten neu (leise – bis dahin gilt der bisherige Stand), wie `useZusagen`.
  const { schreibStand } = o;
  useEffect(() => {
    if (schreibStand > 0) abwNeu();
  }, [schreibStand, abwNeu]);
  if (!lage || !start) return null;
  const abwesenheiten = abwStand.art === 'fertig' ? abwStand.daten : null;
  return {
    lage,
    stand:
      lage.zeilen && abwesenheiten
        ? meinStand({
            start,
            lage,
            zeilen: lage.zeilen,
            antworten: o.antworten,
            abwesenheiten,
            heute,
          })
        : null,
  };
}
