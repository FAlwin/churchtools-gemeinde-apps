import type { Auswahl } from '@shared/dienstplan/termine';
import { leseImGeraet, merkeImGeraet, texte } from './geraet';

/**
 * **Die Wahl in der Termine-Liste merken** (Meine | Alle, ausgeblendete Arten) – im Gerät (`geraet.ts`).
 * Vorgabe „Meine“ (Bauplan: „Vorgabe Meine“).
 */
const SCHLUESSEL = 'dienstplaner.termine.auswahl';

export const VORGABE: Auswahl = { nurMeine: true, ausgeblendet: [] };

export function leseAuswahl(): Auswahl {
  return leseImGeraet(SCHLUESSEL, VORGABE, (roh) => {
    if (!roh || typeof roh !== 'object') return VORGABE;
    const a = roh as { nurMeine?: unknown; ausgeblendet?: unknown };
    return {
      nurMeine: typeof a.nurMeine === 'boolean' ? a.nurMeine : VORGABE.nurMeine,
      ausgeblendet: texte(a.ausgeblendet),
    };
  });
}

export function merkeAuswahl(a: Auswahl): void {
  merkeImGeraet(SCHLUESSEL, a);
}
