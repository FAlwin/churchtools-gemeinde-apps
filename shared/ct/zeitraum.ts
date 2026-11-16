/**
 * **Welcher Zeitraum gezeigt wird** (Alwin, 14.10.2026, Entwurf „Zeitraum wählen“): ab heute, ein Monat, ein
 * eigener Zeitraum von–bis oder (seit E9-3, 05.11.2026) die letzten 3, 6 oder 12 Monate – dazu mit ＋ einzelne
 * Veranstaltungen davor und danach. Nur Regeln – geladen und gezeigt wird beim Aufrufer: Dienstplaner › Planen (Matrix) und
 * seit 28.10.2026 die Abwesenheiten der Musik-App (vorher `shared/dienstplan/zeitraum.ts`).
 *
 * Tage als `YYYY-MM-DD`, Monate als `YYYY-MM` (Ortszeit der Gemeinde), gerechnet mit `shared/ct/datum.ts`.
 */
import { letzterTag, monatPlus, monatTitel, plusTage, tagMonat, tageBis } from './datum';

/**
 * **＋ links und rechts bei gewähltem Zeitraum** (E9-3, Alwin 05.11.2026): so viele **einzelne Veranstaltungen**
 * davor bzw. danach kommen dazu – wie ＋ bei „ab heute“, keine ganzen Monate.
 */
export interface Dazu {
  davor: number;
  danach: number;
}

/** Schnellwahlen für die Vergangenheit („Wer wie oft?“, E9-3): die letzten 3, 6 oder 12 Monate bis heute. */
export const LETZTE_MONATE = [3, 6, 12] as const;
export type LetzteMonate = (typeof LETZTE_MONATE)[number];

export type Zeitraum =
  | { art: 'abHeute' }
  | { art: 'monat'; monat: string; dazu?: Dazu }
  | { art: 'eigen'; von: string; bis: string; dazu?: Dazu }
  | { art: 'letzte'; monate: LetzteMonate; dazu?: Dazu };

export const AB_HEUTE: Zeitraum = { art: 'abHeute' };

/** Der Start von „Wer wie oft?“ (E9-3): die letzten 3 Monate. */
export const LETZTE_3: Zeitraum = { art: 'letzte', monate: 3 };

/**
 * Derselbe Tag `n` Monate früher – gibt es ihn dort nicht (31.05. → Februar), der letzte Tag jenes Monats. „Letzte 3
 * Monate“ am 05.11. heißt also 05.08. bis 05.11.
 */
function tagVorMonaten(heute: string, n: number): string {
  const ende = letzterTag(monatPlus(heute.slice(0, 7), -n));
  const tag = `${ende.slice(0, 8)}${heute.slice(8, 10)}`;
  return tag > ende ? ende : tag;
}

/**
 * Erster und letzter Tag (beide eingeschlossen) – `null` für „ab heute“ (das lädt die App selbst). `heute` braucht nur
 * „Letzte N Monate“; die Veranstaltungen von ＋ stecken nicht darin (`mitDazu`).
 */
export function zeitraumGrenzen(z: Zeitraum, heute: string): { von: string; bis: string } | null {
  if (z.art === 'monat') return { von: `${z.monat}-01`, bis: letzterTag(z.monat) };
  if (z.art === 'eigen') return { von: z.von, bis: z.bis };
  if (z.art === 'letzte') return { von: tagVorMonaten(heute, z.monate), bis: heute };
  return null;
}

/**
 * Wie viele Tage über den Zeitraum hinaus geladen werden, je Veranstaltung von ＋: neun Wochen – auch über eine
 * Weihnachts- oder Sommerpause. Mit vier Wochen fand ＋ in der Abnahme (05.11.2026) nach dem 15.11. nichts (nächster
 * Termin 10.01.) und tat still nichts. Es bleibt eine Abfrage; was ＋ nicht dazunimmt, schneidet `planAusschnitt` ab.
 */
export const DAZU_TAGE = 63;

/**
 * **Was geladen wird:** der Zeitraum und für jede Veranstaltung von ＋ neun Wochen davor bzw. danach. Ohne ＋ genau der
 * Zeitraum – sonst stünden Termine im Plan (und in „Ansehen und senden“), die man nicht sieht.
 */
export function ladeGrenzen(z: Zeitraum, heute: string): { von: string; bis: string } | null {
  const g = zeitraumGrenzen(z, heute);
  if (!g || z.art === 'abHeute' || !z.dazu) return g;
  return {
    von: plusTage(g.von, -DAZU_TAGE * z.dazu.davor),
    bis: plusTage(g.bis, DAZU_TAGE * z.dazu.danach),
  };
}

/**
 * **Die Grenzen mit den Veranstaltungen von ＋** (E9-3): aus den geladenen Tagen die letzten `davor` vor dem Zeitraum und
 * die ersten `danach` dahinter – gezählt nur, was der Filter zeigt (`sichtbar`), wie bei ＋ „ab heute“. Gibt es weniger,
 * kommen die vorhandenen dazu. Liefert die neuen Grenzen und wie viele es wirklich sind.
 */
export function mitDazu(
  tage: readonly { tag: string; sichtbar: boolean }[],
  g: { von: string; bis: string },
  dazu: Dazu | undefined,
): { von: string; bis: string; davor: number; danach: number } {
  if (!dazu) return { ...g, davor: 0, danach: 0 };
  const sichtbar = [...new Set(tage.filter((t) => t.sichtbar).map((t) => t.tag))].sort();
  const vorher = dazu.davor > 0 ? sichtbar.filter((t) => t < g.von).slice(-dazu.davor) : [];
  const nachher = sichtbar.filter((t) => t > g.bis).slice(0, dazu.danach);
  return {
    von: vorher[0] ?? g.von,
    bis: nachher[nachher.length - 1] ?? g.bis,
    davor: vorher.length,
    danach: nachher.length,
  };
}

/** ＋ in eine Richtung: eine Veranstaltung mehr davor (`-1`) bzw. danach (`1`). „Ab heute“ hat ein eigenes ＋. */
export function zeitraumDazu(z: Zeitraum, richtung: 1 | -1): Zeitraum {
  if (z.art === 'abHeute') return z;
  const d = z.dazu ?? { davor: 0, danach: 0 };
  return {
    ...z,
    dazu: richtung < 0 ? { ...d, davor: d.davor + 1 } : { ...d, danach: d.danach + 1 },
  };
}

/**
 * ‹ und › bei gewähltem Zeitraum: ein Monat springt um einen ganzen Monat, ein eigener Zeitraum um seine
 * eigene Länge („die nächsten 4 Wochen“), „Letzte N Monate“ wird dabei zum eigenen Zeitraum gleicher Länge. Was mit ＋
 * dazukam, fällt weg – es hing am alten Zeitraum. „Ab heute“ bleibt, wie es ist – dort blättert die Terminleiste.
 */
export function zeitraumVerschieben(z: Zeitraum, richtung: 1 | -1, heute: string): Zeitraum {
  if (z.art === 'monat') return { art: 'monat', monat: monatPlus(z.monat, richtung) };
  const g = zeitraumGrenzen(z, heute);
  if (g) {
    const tage = (tageBis(g.von, g.bis) + 1) * richtung;
    return { art: 'eigen', von: plusTage(g.von, tage), bis: plusTage(g.bis, tage) };
  }
  return z;
}

/** Derselbe Zeitraum ohne das, was ＋ dazunahm – für „ist gewählt“ im Menü. */
export function ohneDazu(z: Zeitraum): Zeitraum {
  if (z.art === 'abHeute' || !z.dazu) return z;
  const kopie = { ...z };
  delete kopie.dazu;
  return kopie;
}

/**
 * Zwei Tage als Spanne: „01.10. – 31.10.2026“, über den Jahreswechsel mit beiden Jahren, ein einzelner Tag als
 * „18.10.2026“. Für den eigenen Zeitraum und für das, was „ab heute“ gerade zeigt – eine Regel für beide.
 */
export function spanneText(von: string, bis: string): string {
  if (von === bis) return `${tagMonat(von)}${von.slice(0, 4)}`;
  const jahr = von.slice(0, 4) === bis.slice(0, 4) ? '' : von.slice(0, 4);
  return `${tagMonat(von)}${jahr} – ${tagMonat(bis)}${bis.slice(0, 4)}`;
}

/** Aufschrift des Zeitraum-Knopfs bei gewähltem Zeitraum: „Oktober 2026“, „01.10. – 31.10.2026“, „Letzte 3 Monate“. */
export function zeitraumText(z: Exclude<Zeitraum, { art: 'abHeute' }>): string {
  if (z.art === 'monat') return monatTitel(`${z.monat}-01`);
  if (z.art === 'letzte') return `Letzte ${z.monate} Monate`;
  return spanneText(z.von, z.bis);
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const MONAT = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Ein echter Kalendertag – „2026-02-30“ ist keiner (je nach Browser `NaN` oder ein März-Tag). */
function echterTag(t: string): boolean {
  if (!TAG.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/** Ein eigener Zeitraum ist gültig, wenn beide Tage echte Tage sind und `von` nicht nach `bis` liegt. */
export function zeitraumGueltig(von: string, bis: string): boolean {
  return echterTag(von) && echterTag(bis) && von <= bis;
}

const anzahl = (x: unknown) =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 50 ? x : 0;

/** ＋ aus dem Gerätespeicher – fehlt es oder ist beides 0, gibt es keins. */
function dazuAus(roh: unknown): { dazu?: Dazu } {
  if (!roh || typeof roh !== 'object') return {};
  const d = roh as Record<string, unknown>;
  const dazu = { davor: anzahl(d.davor), danach: anzahl(d.danach) };
  return dazu.davor || dazu.danach ? { dazu } : {};
}

/** Aus dem Gerätespeicher – Unsinn wird `vorgabe` („ab heute“, bei „Wer wie oft?“ die letzten 3 Monate). */
export function zeitraumAus(roh: unknown, vorgabe: Zeitraum = AB_HEUTE): Zeitraum {
  if (!roh || typeof roh !== 'object') return vorgabe;
  const z = roh as Record<string, unknown>;
  if (z.art === 'abHeute') return AB_HEUTE;
  if (z.art === 'monat' && typeof z.monat === 'string' && MONAT.test(z.monat)) {
    return { art: 'monat', monat: z.monat, ...dazuAus(z.dazu) };
  }
  if (
    z.art === 'eigen' &&
    typeof z.von === 'string' &&
    typeof z.bis === 'string' &&
    zeitraumGueltig(z.von, z.bis)
  ) {
    return { art: 'eigen', von: z.von, bis: z.bis, ...dazuAus(z.dazu) };
  }
  if (z.art === 'letzte' && LETZTE_MONATE.includes(z.monate as LetzteMonate)) {
    return { art: 'letzte', monate: z.monate as LetzteMonate, ...dazuAus(z.dazu) };
  }
  return vorgabe;
}
