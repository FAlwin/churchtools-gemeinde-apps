import type { Breite } from '@shared/dienstplan/fenster';
import { AB_HEUTE, zeitraumAus, type Zeitraum } from '@shared/ct/zeitraum';
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
  /** Ab heute, ein Monat oder ein eigener Zeitraum (Zeitraum-Knopf, 14.10.2026). */
  zeitraum: Zeitraum;
  /** Die Gruppe „Ablauf“ zugeklappt (E6-6a, Alwin 28.10.2026: auf dem Gerät merken – lange Abläufe schieben die Dienste weit nach unten). */
  ablaufZu: boolean;
}

const SCHLUESSEL = 'dienstplaner.planen.ansicht';

export const VORGABE_ANSICHT: PlanenAnsicht = {
  breite: 'schmal',
  unteransicht: 'matrix',
  ausgeblendeteGruppen: [],
  ausgeblendeteArten: [],
  zeitraum: AB_HEUTE,
  ablaufZu: false,
};

export function leseAnsicht(): PlanenAnsicht {
  return leseImGeraet(SCHLUESSEL, VORGABE_ANSICHT, (roh) => {
    if (!roh || typeof roh !== 'object') return VORGABE_ANSICHT;
    const a = roh as Record<string, unknown>;
    return {
      // Bis 29.10.2026 S/M/L: S und M werden „schmal“, L wird „breit“.
      breite: a.breite === 'breit' || a.breite === 'l' ? 'breit' : 'schmal',
      unteransicht: a.unteransicht === 'personen' ? 'personen' : 'matrix',
      ausgeblendeteGruppen: texte(a.ausgeblendeteGruppen),
      ausgeblendeteArten: texte(a.ausgeblendeteArten),
      zeitraum: zeitraumAus(a.zeitraum),
      ablaufZu: a.ablaufZu === true,
    };
  });
}

export function merkeAnsicht(a: PlanenAnsicht): void {
  merkeImGeraet(SCHLUESSEL, a);
}
