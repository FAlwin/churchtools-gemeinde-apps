import type { Auswahl } from '@shared/dienstplan/termine';
import { kalenderIdsAus } from '@shared/ct/kalenderFilter';
import { leseImGeraet, merkeImGeraet, texte } from '@ui/bedienung/geraet';

/**
 * **Die Wahl in der Termine-Liste merken** (Meine | Alle, ausgeblendete Arten und Kalender) – im Gerät (`@ui/bedienung/geraet`).
 * Vorgabe „Meine“ (Bauplan: „Vorgabe Meine“).
 */
const SCHLUESSEL = 'dienstplaner.termine.auswahl';

export const VORGABE: Auswahl = { nurMeine: true, ausgeblendet: [], ausgeblendeteKalender: [] };

export function leseAuswahl(): Auswahl {
  return leseImGeraet(SCHLUESSEL, VORGABE, (roh) => {
    if (!roh || typeof roh !== 'object') return VORGABE;
    const a = roh as {
      nurMeine?: unknown;
      ausgeblendet?: unknown;
      ausgeblendeteKalender?: unknown;
    };
    return {
      nurMeine: typeof a.nurMeine === 'boolean' ? a.nurMeine : VORGABE.nurMeine,
      ausgeblendet: texte(a.ausgeblendet),
      ausgeblendeteKalender: kalenderIdsAus(a.ausgeblendeteKalender),
    };
  });
}

export function merkeAuswahl(a: Auswahl): void {
  merkeImGeraet(SCHLUESSEL, a);
}
