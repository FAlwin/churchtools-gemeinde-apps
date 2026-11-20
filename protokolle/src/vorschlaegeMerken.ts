/**
 * **Was das Gerät zur Karte „Vorschläge“ merkt** (W8c): ob der Bereich aufgeklappt ist und welche abgelehnten Vorschläge
 * man früher ausgeblendet hat. Nur im Gerät (`@ui/bedienung/geraet`, jeder Zugriff abgesichert – ohne Speicher gilt die
 * Vorgabe, und die Seite arbeitet trotzdem richtig), **je Person und Gruppe**: An einem geteilten iPad erbt die nächste
 * Person die Wahl der vorigen nicht (dieselbe Lehre wie bei den To-Do-Einstellungen).
 *
 * Die Regeln dahinter (Standard des Bereichs, wer was sieht) stehen in `@shared/protokolle/vorschlaege`.
 */
import { useState } from 'react';
import { leseImGeraet, merkeImGeraet, texte } from '@ui/bedienung/geraet';

/**
 * Zwei Bereiche merken auf diese Weise: die Punkt-Vorschläge der Sitzungen (je Gruppe) und die To-Do-Vorschläge im Reiter
 * „To-Dos“ (W9b, über alle Gruppen: Gruppe 0). `art` hält die Schlüssel auseinander.
 */
export type VorschlagArt = 'vorschlaege' | 'todovorschlaege';

export const bereichSchluessel = (
  person: number,
  gruppe: number,
  art: VorschlagArt = 'vorschlaege',
) => `protokolle.${art}.bereich.${person}.${gruppe}`;
export const ausSchluessel = (person: number, gruppe: number, art: VorschlagArt = 'vorschlaege') =>
  `protokolle.${art}.aus.${person}.${gruppe}`;

const alsWahl = (roh: unknown): boolean | null => (typeof roh === 'boolean' ? roh : null);

/** Gemerkt: der Bereich offen (`true`), zu (`false`) – oder noch keine Wahl (`null`, dann gilt der Standard). */
export function useBereichWahl(
  person: number,
  gruppe: number,
  art: VorschlagArt = 'vorschlaege',
): [boolean | null, (offen: boolean) => void] {
  const schluessel = bereichSchluessel(person, gruppe, art);
  const [stand, setStand] = useState(() => ({
    schluessel,
    wahl: leseImGeraet<boolean | null>(schluessel, null, alsWahl),
  }));
  // Gruppe oder Person gewechselt: neu lesen, nicht die Wahl der vorigen mitnehmen.
  const wahl =
    stand.schluessel === schluessel
      ? stand.wahl
      : leseImGeraet<boolean | null>(schluessel, null, alsWahl);
  return [
    wahl,
    (offen) => {
      merkeImGeraet(schluessel, offen);
      setStand({ schluessel, wahl: offen });
    },
  ];
}

/**
 * Die IDs der abgelehnten Vorschläge, die man auf diesem Gerät mit „×“ ausgeblendet hat. `ausblenden` fügt eine hinzu und
 * lässt dabei alles fallen, was nicht in `nochDa` steht (IDs, die es nicht mehr gibt – so wächst die Liste nicht).
 */
export function useAusgeblendet(
  person: number,
  gruppe: number,
  art: VorschlagArt = 'vorschlaege',
): [string[], (id: string, nochDa: readonly string[]) => void] {
  const schluessel = ausSchluessel(person, gruppe, art);
  const [stand, setStand] = useState(() => ({
    schluessel,
    ids: leseImGeraet<string[]>(schluessel, [], texte),
  }));
  const ids =
    stand.schluessel === schluessel ? stand.ids : leseImGeraet<string[]>(schluessel, [], texte);
  return [
    ids,
    (id, nochDa) => {
      const neu = [...ids.filter((x) => nochDa.includes(x) && x !== id), id];
      merkeImGeraet(schluessel, neu);
      setStand({ schluessel, ids: neu });
    },
  ];
}
