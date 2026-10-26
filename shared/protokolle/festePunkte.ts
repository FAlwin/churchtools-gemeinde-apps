/**
 * **Die festen Punkte eines Protokolls** (Bauplan S4-3a, Entwurf 7) – was die Verweis-Blöcke „Offene To-Dos“ und
 * „Letztes Protokoll“ zeigen. Editor, Lese-Ansicht und das Fenster „Letztes Protokoll“ lesen diese EINE Regel.
 *
 * Entschieden 26.10.2026 (Alwin):
 * - **Offene To-Dos:** die offenen To-Dos der Gruppe aus früheren Sitzungen – **bis zur Freigabe live**; bei der Freigabe
 *   merkt sich das Protokoll, welche es waren (`props.fest`, `festePunkteFesthalten`). Der Status-Kreis zeigt immer
 *   den heutigen Stand. Darunter eingeklappt: **„Seit der Sitzung am … erledigt“**.
 * - **Letztes Protokoll:** das letzte freigegebene Protokoll der Gruppe vor dieser Sitzung.
 *
 * „Seit“ ist der Beginn genau dieses letzten Protokolls – beide Punkte meinen dieselbe „letzte Sitzung“.
 */
import { BLOCK, type Block } from './dokument';
import { erledigtAm, erledigtSeit, offene, type Aufgabe } from './aufgaben';

/** Was eine Sitzung für die festen Punkte mitbringt (Teil von `Sitzung`). */
export interface SitzungsBezug {
  beginn: string;
  kopf: { sitzung: string; status: string } | null;
}

/** Festgehalten bei der Freigabe: welche To-Dos der Punkt „Offene To-Dos“ damals zeigte. */
export interface FesteAufgaben {
  offen: string[];
  erledigt: string[];
  /** Beginn der letzten Sitzung (ISO) – `null`, wenn es keine gab. */
  seit: string | null;
}

/** Festgehalten bei der Freigabe: welches Protokoll „Letztes Protokoll“ damals war (`null` = keins). */
export interface FestesProtokoll {
  sitzung: string | null;
}

/**
 * **Das letzte freigegebene Protokoll vor dieser Sitzung** – aus den Sitzungen der Gruppe. „Vor“ heißt echt früher
 * begonnen: Die Sitzung selbst zählt deshalb nie mit, auch wenn sie schon freigegeben ist.
 */
export function letztesProtokoll<T extends SitzungsBezug>(
  sitzungen: readonly T[],
  diese: SitzungsBezug,
): T | null {
  const vor = Date.parse(diese.beginn);
  let best: T | null = null;
  for (const s of sitzungen) {
    if (s.kopf?.status !== 'frei') continue;
    const t = Date.parse(s.beginn);
    if (!(t < vor)) continue;
    if (!best || t > Date.parse(best.beginn)) best = s;
  }
  return best;
}

const gelesen = (x: unknown): Record<string, unknown> | null => {
  if (typeof x !== 'string' || !x) return null;
  try {
    const v: unknown = JSON.parse(x);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const ids = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : [];

/** `props.fest` eines „Offene To-Dos“-Blocks – `null`, solange nichts festgehalten ist (dann gilt live). */
export function festeAufgabenAus(fest: unknown): FesteAufgaben | null {
  const v = gelesen(fest);
  if (!v) return null;
  return {
    offen: ids(v.offen),
    erledigt: ids(v.erledigt),
    seit: typeof v.seit === 'string' ? v.seit : null,
  };
}

/** `props.fest` eines „Letztes Protokoll“-Blocks – `null`, solange nichts festgehalten ist. */
export function festesProtokollAus(fest: unknown): FestesProtokoll | null {
  const v = gelesen(fest);
  if (!v) return null;
  return { sitzung: typeof v.sitzung === 'string' ? v.sitzung : null };
}

export interface OffeneVonFrueher {
  offen: Aufgabe[];
  erledigt: Aufgabe[];
  /** Seit wann „erledigt“ zählt (ISO) – `null`: keine frühere Sitzung, dann gibt es keine Erledigt-Zeile. */
  seit: string | null;
}

/**
 * **Was „Offene To-Dos“ zeigt.** Live: alle offenen To-Dos der Gruppe, die nicht in dieser Sitzung entstanden sind
 * (Reihenfolge wie überall, `offene`), und die seit `seit` erledigten (zuletzt erledigt zuerst). Festgehalten: genau
 * die gemerkten To-Dos – mit ihrem heutigen Stand; inzwischen gelöschte fallen weg.
 */
export function offeneVonFrueher(q: {
  aufgaben: readonly Aufgabe[];
  gruppe: number;
  /** ID der Sitzung, in der der Punkt steht (`kopf.sitzung`). */
  sitzung: string;
  seit: string | null;
  /** `JJJJ-MM-TT` – für „überfällig zuerst“. */
  heute: string;
  fest: FesteAufgaben | null;
}): OffeneVonFrueher {
  if (q.fest) {
    const nachId = new Map(q.aufgaben.map((a) => [a.id, a]));
    const holen = (liste: string[]) =>
      liste.flatMap((id) => {
        const a = nachId.get(id);
        return a && !a.geloescht ? [a] : [];
      });
    return { offen: holen(q.fest.offen), erledigt: holen(q.fest.erledigt), seit: q.fest.seit };
  }
  const frueher = q.aufgaben.filter(
    (a) => a.gruppe === q.gruppe && a.sitzung !== q.sitzung && !a.geloescht,
  );
  const seit = q.seit;
  const erledigt =
    seit === null
      ? []
      : erledigtSeit(frueher, seit).sort((x, y) =>
          (erledigtAm(y) ?? '').localeCompare(erledigtAm(x) ?? ''),
        );
  return { offen: offene(frueher, q.heute), erledigt, seit };
}

/**
 * **Die festen Punkte festhalten** – für die Freigabe (S6): Jeder noch nicht festgehaltene Verweis bekommt in
 * `props.fest`, was er gerade zeigt. Danach ändert sich die Liste nicht mehr, nur der Stand der einzelnen To-Dos.
 * Schon festgehaltene bleiben, wie sie sind.
 */
export function festePunkteFesthalten(
  dokument: readonly Block[],
  q: {
    offen: OffeneVonFrueher;
    /** Das letzte Protokoll (`kopf.sitzung`) – `null`, wenn es keins gab. */
    letztes: string | null;
  },
): Block[] {
  const stand: FesteAufgaben = {
    offen: q.offen.offen.map((a) => a.id),
    erledigt: q.offen.erledigt.map((a) => a.id),
    seit: q.offen.seit,
  };
  const halten = (b: Block): Block => {
    const kinder = b.children?.length ? { children: b.children.map(halten) } : {};
    if (b.type !== BLOCK.verweis || gelesen(b.props?.fest)) return { ...b, ...kinder };
    const fest =
      b.props?.art === 'letztes-protokoll'
        ? JSON.stringify({ sitzung: q.letztes } satisfies FestesProtokoll)
        : JSON.stringify(stand);
    return { ...b, props: { ...b.props, fest }, ...kinder };
  };
  return dokument.map(halten);
}
