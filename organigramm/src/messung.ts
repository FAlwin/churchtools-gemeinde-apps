/**
 * **Wie breit ein Kästchen im Diagramm wird** (O7b) – EINE Messung für Bildschirm (O7b-3) und Druck (O7b-4), mit der
 * Schrift der Seite.
 */
import { useEffect, useState, type RefObject } from 'react';
import type { SichtKnoten } from '@shared/organigramm/ansichten';
import { textBreite } from './textBreite';

/** Im Kästchen nur der Name (Alwin, 26.10.2026) – mit diesem Rand links und rechts, zwischen diesen Breiten. */
const INNEN = 28;
const SCHMALST = 72;
const BREITEST = 220;
/** Die Spitze darf breiter sein – dort steht oft der lange Name der Gemeinde (Test-Instanz 28.10.2026: gekürzt). */
const BREITEST_SPITZE = 320;

/** Spitze und die Ebene darunter sind fett. */
export const fett = (k: SichtKnoten) => k.ebene <= 1;

export interface Schrift {
  name: string;
  /** Zählt hoch, sobald die Schrift geladen ist – dann wird neu gemessen. */
  stand: number;
}

/** Die Schrift der Seite (`--ui`) am Element – und neu messen, sobald sie geladen ist. */
export function useSchrift(ref: RefObject<Element | null>): Schrift {
  const [schrift, setSchrift] = useState<Schrift>({ name: 'Lato, sans-serif', stand: 0 });
  useEffect(() => {
    const el = ref.current;
    const ui = el ? getComputedStyle(el).getPropertyValue('--ui').trim() : '';
    if (ui) setSchrift((s) => ({ ...s, name: ui }));
    let weg = false;
    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        if (!weg) setSchrift((s) => ({ ...s, stand: s.stand + 1 }));
      });
    }
    return () => {
      weg = true;
    };
  }, [ref]);
  return schrift;
}

/** Wie breit ein Kästchen wird und wie sein Name gekürzt wird – EINE Messung für Bildschirm und Druck. */
export function messung(schrift: Schrift) {
  const breite = (k: SichtKnoten) =>
    Math.min(
      k.ebene === 0 ? BREITEST_SPITZE : BREITEST,
      Math.max(SCHMALST, Math.ceil(textBreite(k.name, fett(k), schrift.name)) + INNEN),
    );
  const kuerzen = (k: SichtKnoten, w: number) => {
    const platz = w - INNEN + 4;
    if (textBreite(k.name, fett(k), schrift.name) <= platz) return k.name;
    let t = k.name;
    while (t.length > 1 && textBreite(t + '…', fett(k), schrift.name) > platz) t = t.slice(0, -1);
    return t + '…';
  };
  return { breite, kuerzen };
}
