import type { Auswahl } from '@shared/dienstplan/termine';

/**
 * **Die Wahl in der Termine-Liste merken** (Meine | Alle, ausgeblendete Arten) – vorerst im Gerät
 * (Bauplan §3.3: Ansicht und Filter „nur im Gerät“). Vorgabe „Meine“ (Bauplan: „Vorgabe Meine“).
 * Jeder Zugriff ist abgesichert: Im privaten Modus oder bei gesperrtem Speicher fehlt `localStorage` –
 * dann gilt einfach die Vorgabe.
 */
const SCHLUESSEL = 'dienstplaner.termine.auswahl';

export const VORGABE: Auswahl = { nurMeine: true, ausgeblendet: [] };

export function leseAuswahl(): Auswahl {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null');
    if (!roh || typeof roh !== 'object') return VORGABE;
    const a = roh as { nurMeine?: unknown; ausgeblendet?: unknown };
    return {
      nurMeine: typeof a.nurMeine === 'boolean' ? a.nurMeine : VORGABE.nurMeine,
      ausgeblendet: Array.isArray(a.ausgeblendet)
        ? a.ausgeblendet.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return VORGABE;
  }
}

export function merkeAuswahl(a: Auswahl): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(a));
  } catch {
    // Nicht speicherbar (privater Modus) – die Wahl gilt dann nur bis zum Neuladen.
  }
}
