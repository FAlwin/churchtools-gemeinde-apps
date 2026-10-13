import type { Breite } from '@shared/dienstplan/fenster';
import { leseImGeraet, merkeImGeraet, texte } from './geraet';

/**
 * **Wie die Matrix aussieht** (Bauplan E3-5): Spaltenbreite, Unteransicht und Filter – im Gerät gemerkt
 * (Bauplan §3.3, wie im Entwurf `dienstplaner:breite`).
 */
export interface PlanenAnsicht {
  breite: Breite;
  unteransicht: 'matrix' | 'personen';
  /** Zugeklappte bzw. ausgeblendete Gruppen (Schlüssel wie in `Planen.tsx`). */
  ausgeblendeteGruppen: string[];
  /** Ausgeblendete Veranstaltungsarten (wie in der Termine-Liste). */
  ausgeblendeteArten: string[];
}

const SCHLUESSEL = 'dienstplaner.planen.ansicht';

export const VORGABE_ANSICHT: PlanenAnsicht = {
  breite: 'm',
  unteransicht: 'matrix',
  ausgeblendeteGruppen: [],
  ausgeblendeteArten: [],
};

export function leseAnsicht(): PlanenAnsicht {
  return leseImGeraet(SCHLUESSEL, VORGABE_ANSICHT, (roh) => {
    if (!roh || typeof roh !== 'object') return VORGABE_ANSICHT;
    const a = roh as Record<string, unknown>;
    return {
      breite: a.breite === 's' || a.breite === 'l' ? a.breite : 'm',
      unteransicht: a.unteransicht === 'personen' ? 'personen' : 'matrix',
      ausgeblendeteGruppen: texte(a.ausgeblendeteGruppen),
      ausgeblendeteArten: texte(a.ausgeblendeteArten),
    };
  });
}

export function merkeAnsicht(a: PlanenAnsicht): void {
  merkeImGeraet(SCHLUESSEL, a);
}
