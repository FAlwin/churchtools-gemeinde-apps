/**
 * Was der Zieh-Bereich der Matrix (`AblaufZiehBereich.tsx`, E6-6b) mit den Listen teilt – getrennt von den Komponenten,
 * damit jene Datei nur Komponenten exportiert (wie `Toast`/`useToast`).
 */
import { createContext, useContext } from 'react';
import { useDroppable, type Active, type Over } from '@dnd-kit/core';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import type { Ablage } from '@shared/ct/punktUebertragen';

/** Was eine Spalte dem Zieh-Bereich zeigt – jeweils ihr aktueller Stand. */
export interface ZiehSpalte {
  /** Die Punkte in der Reihenfolge des Geräts (wie die Liste sie zeigt). */
  items: readonly AblaufZeile[];
  /** Innerhalb der Spalte umsortieren – dieselbe Regel wie ohne Zieh-Bereich. */
  umsortieren: (aktivId: number, ueberId: number) => void;
  /** „Rückgängig“ in dieser Spalte anbieten bzw. verwerfen. */
  anbieten: (text: string, tun: () => Promise<void>) => void;
  verwerfen: () => void;
  /** Den Ablauf dieser Spalte neu lesen. */
  neuLaden: () => void;
}

/** Ein Punkt wurde in einer anderen Spalte losgelassen. */
export interface Ablegen {
  von: number;
  nach: number;
  punkt: AblaufZeile;
  /** Der Punkt, hinter dem er landet (`null` = ganz vorne). */
  hinter: AblaufZeile | null;
  ablage: Ablage;
  quelle: ZiehSpalte;
  ziel: ZiehSpalte;
}

/** Wo die gestrichelte Stelle steht: vor dem Punkt mit Index `index` (= Länge: am Ende). */
export interface Platz {
  spalte: number;
  index: number;
  vorBeginn: boolean;
}

export interface BereichWert {
  anmelden: (spalte: number, lies: () => ZiehSpalte) => () => void;
  platz: Platz | null;
}

export const Bereich = createContext<BereichWert | null>(null);

/** Der Zieh-Bereich, in dem eine Liste steht – `null` ohne (eigenes Ziehen je Liste). */
export function useZiehBereich(): BereichWert | null {
  return useContext(Bereich);
}

/** Die Zieh-ID eines Punkts im Bereich – Punkt-IDs allein wären bei einem geteilten Ablauf doppelt. */
export const ziehId = (spalte: number, itemId: number) => `${spalte}:${itemId}`;

type PunktDaten = {
  art: 'punkt';
  spalte: number;
  itemId: number;
};
type FlaecheDaten = {
  art: 'flaeche';
  spalte: number;
};
export type Daten = PunktDaten | FlaecheDaten;

export const punktDaten = (spalte: number, itemId: number): PunktDaten => ({
  art: 'punkt',
  spalte,
  itemId,
});

export const datenVon = (x: Active | Over | null): Daten | undefined =>
  x?.data.current as Daten | undefined;

/**
 * Die Ablage-Fläche einer Spalte (ihre ganze Zelle): Dorthin lässt sich auch unter den letzten Punkt oder in einen
 * leeren Ablauf ablegen. `an` nur, wo die Spalte im Bearbeiten steht.
 */
export function useAblageFlaeche(spalte: number, an: boolean): (el: HTMLElement | null) => void {
  const { setNodeRef } = useDroppable({
    id: `flaeche:${spalte}`,
    data: { art: 'flaeche', spalte } satisfies FlaecheDaten,
    disabled: !an,
  });
  return setNodeRef;
}

/**
 * **Wo ein Punkt in der Ziel-Spalte landet** – über einem Punkt davor oder dahinter (je nachdem, ob der Zeiger über oder
 * unter dessen Mitte steht), auf der freien Fläche der Zelle am Ende. Er bekommt den Vorlauf des Punkts, an dem er
 * landet: hinter den letzten Vorlauf-Punkt = noch im Vorlauf, vor den ersten nach dem Beginn = danach (die Grenze ist in
 * ChurchTools eine Platznummer, #423). `null`, wenn der Punkt unter dem Zeiger nicht (mehr) in der Spalte steht.
 */
export function platzIn(
  spalte: number,
  items: readonly AblaufZeile[],
  ueber: Daten,
  zeigerY: number | null,
  ueberRect: { top: number; height: number } | null,
): Platz | null {
  if (ueber.art === 'flaeche') return { spalte, index: items.length, vorBeginn: false };
  const i = items.findIndex((x) => x.id === ueber.itemId);
  if (i < 0) return null;
  const hinter =
    zeigerY !== null && ueberRect !== null && zeigerY > ueberRect.top + ueberRect.height / 2;
  return { spalte, index: i + (hinter ? 1 : 0), vorBeginn: items[i].vorBeginn === true };
}
