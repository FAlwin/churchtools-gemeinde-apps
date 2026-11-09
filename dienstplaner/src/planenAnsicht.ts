import type { Breite } from '@shared/dienstplan/fenster';
import type { TerminAus } from '@shared/dienstplan/termine';
import { AB_HEUTE, LETZTE_3, zeitraumAus, type Zeitraum } from '@shared/ct/zeitraum';
import { kalenderIdsAus } from '@shared/ct/kalenderFilter';
import { leseImGeraet, merkeImGeraet, texte } from '@ui/bedienung/geraet';

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
  /** Ausgeblendete Kalender (IDs, Wunsch 6) – wie in der Termine-Liste. */
  ausgeblendeteKalender: number[];
  /** Ab heute, ein Monat oder ein eigener Zeitraum (Zeitraum-Knopf, 14.10.2026) – der Matrix. */
  zeitraum: Zeitraum;
  /**
   * Der Zeitraum von „Wer wie oft?“ – eigener, getrennt von der Matrix (E9-3, Alwin 05.11.2026: „da interessiert mich
   * meistens die Vergangenheit“). Ohne Wahl die letzten 3 Monate.
   */
  zeitraumWer: Zeitraum;
  /** Die Gruppe „Ablauf“ zugeklappt (E6-6a, Alwin 28.10.2026: auf dem Gerät merken – lange Abläufe schieben die Dienste weit nach unten). */
  ablaufZu: boolean;
  /** Die Gruppe „Infos & Dateien“ zugeklappt (T1b) – gemerkt wie „Ablauf“. */
  infosZu: boolean;
}

const SCHLUESSEL = 'dienstplaner.planen.ansicht';

export const VORGABE_ANSICHT: PlanenAnsicht = {
  breite: 'schmal',
  unteransicht: 'matrix',
  ausgeblendeteGruppen: [],
  ausgeblendeteArten: [],
  ausgeblendeteKalender: [],
  zeitraum: AB_HEUTE,
  zeitraumWer: LETZTE_3,
  ablaufZu: false,
  infosZu: false,
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
      ausgeblendeteKalender: kalenderIdsAus(a.ausgeblendeteKalender),
      zeitraum: zeitraumAus(a.zeitraum),
      zeitraumWer: zeitraumAus(a.zeitraumWer, LETZTE_3),
      ablaufZu: a.ablaufZu === true,
      infosZu: a.infosZu === true,
    };
  });
}

/** Was der Filter der Matrix ausblendet – für `terminFilter` (Wunsch 6). */
export function ansichtAus(a: PlanenAnsicht): TerminAus {
  return { kalender: a.ausgeblendeteKalender, arten: a.ausgeblendeteArten };
}

export function merkeAnsicht(a: PlanenAnsicht): void {
  merkeImGeraet(SCHLUESSEL, a);
}
