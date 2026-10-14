/**
 * **Welcher Zeitraum in der Matrix steht** (Alwin, 14.10.2026, Entwurf „Zeitraum wählen“): ab heute (wie
 * bisher, passend zur Fensterbreite), ein Monat oder ein eigener Zeitraum von–bis. Nur Regeln – geladen und
 * gezeigt wird in `dienstplaner/src/Planen.tsx`.
 *
 * Tage als `YYYY-MM-DD`, Monate als `YYYY-MM` (Ortszeit der Gemeinde), gerechnet mit `shared/ct/datum.ts`.
 */
import { letzterTag, monatPlus, monatTitel, plusTage, tageBis } from '../ct/datum';

export type Zeitraum =
  | { art: 'abHeute' }
  | { art: 'monat'; monat: string }
  | { art: 'eigen'; von: string; bis: string };

export const AB_HEUTE: Zeitraum = { art: 'abHeute' };

/** Erster und letzter Tag (beide eingeschlossen) – `null` für „ab heute“ (das lädt die App selbst). */
export function zeitraumGrenzen(z: Zeitraum): { von: string; bis: string } | null {
  if (z.art === 'monat') return { von: `${z.monat}-01`, bis: letzterTag(z.monat) };
  if (z.art === 'eigen') return { von: z.von, bis: z.bis };
  return null;
}

/**
 * ‹ und › bei gewähltem Zeitraum: ein Monat springt um einen ganzen Monat, ein eigener Zeitraum um seine
 * eigene Länge („die nächsten 4 Wochen“). „Ab heute“ bleibt, wie es ist – dort blättert die Terminleiste.
 */
export function zeitraumVerschieben(z: Zeitraum, richtung: 1 | -1): Zeitraum {
  if (z.art === 'monat') return { art: 'monat', monat: monatPlus(z.monat, richtung) };
  if (z.art === 'eigen') {
    const tage = (tageBis(z.von, z.bis) + 1) * richtung;
    return { art: 'eigen', von: plusTage(z.von, tage), bis: plusTage(z.bis, tage) };
  }
  return z;
}

const kurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

/**
 * Zwei Tage als Spanne: „01.10. – 31.10.2026“, über den Jahreswechsel mit beiden Jahren, ein einzelner Tag als
 * „18.10.2026“. Für den eigenen Zeitraum und für das, was „ab heute“ gerade zeigt – eine Regel für beide.
 */
export function spanneText(von: string, bis: string): string {
  if (von === bis) return `${kurz(von)}${von.slice(0, 4)}`;
  const jahr = von.slice(0, 4) === bis.slice(0, 4) ? '' : von.slice(0, 4);
  return `${kurz(von)}${jahr} – ${kurz(bis)}${bis.slice(0, 4)}`;
}

/** Aufschrift des Zeitraum-Knopfs bei gewähltem Zeitraum: „Oktober 2026“ bzw. „01.10. – 31.10.2026“. */
export function zeitraumText(z: Exclude<Zeitraum, { art: 'abHeute' }>): string {
  return z.art === 'monat' ? monatTitel(`${z.monat}-01`) : spanneText(z.von, z.bis);
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

/** Aus dem Gerätespeicher – Unsinn wird „ab heute“. */
export function zeitraumAus(roh: unknown): Zeitraum {
  if (!roh || typeof roh !== 'object') return AB_HEUTE;
  const z = roh as Record<string, unknown>;
  if (z.art === 'monat' && typeof z.monat === 'string' && MONAT.test(z.monat)) {
    return { art: 'monat', monat: z.monat };
  }
  if (
    z.art === 'eigen' &&
    typeof z.von === 'string' &&
    typeof z.bis === 'string' &&
    zeitraumGueltig(z.von, z.bis)
  ) {
    return { art: 'eigen', von: z.von, bis: z.bis };
  }
  return AB_HEUTE;
}
