import { useLayoutEffect, type RefObject } from 'react';
import { menueVersatz, menueVersatzRechts } from './menueLage';

/**
 * **Ein aufgeklapptes Menü bleibt im Bild** – vor dem ersten Bild messen und so weit rücken, dass es nicht über den
 * Bildschirm ragt. Eine Stelle für „Anfangen bei“ und „Welche Rollen“ im Organigramm (#915) und die Menüs von Filter und
 * Sortieren (18.11.2026) – sonst stünde die Messung mehrfach da.
 * - `anker: 'links'` (Vorgabe): Das Menü hängt links am Knopf (`left`) und rückt nach links, wenn es rechts hinausragt
 *   (`menueVersatz`).
 * - `anker: 'rechts'`: Das Menü hängt rechts am Knopf (`right: 0` im Stil) und rückt nach rechts, wenn es links hinausragt
 *   (`menueVersatzRechts`).
 *
 * Wer danach noch etwas tun will, das vom Platz abhängt (z. B. den Fokus setzen), tut es in einem `useLayoutEffect`,
 * der NACH diesem Hook steht – React führt sie in dieser Reihenfolge aus.
 */
export function useMenueImBild(
  menue: RefObject<HTMLElement | null>,
  offen: boolean,
  anker: 'links' | 'rechts' = 'links',
): void {
  useLayoutEffect(() => {
    const m = menue.current;
    if (!offen || !m) return;
    const breite = document.documentElement.clientWidth;
    if (anker === 'rechts') {
      m.style.right = '0px';
      const r = m.getBoundingClientRect();
      m.style.right = `${-menueVersatzRechts(r.left, r.width, breite)}px`;
      return;
    }
    m.style.left = '0px';
    const r = m.getBoundingClientRect();
    m.style.left = `${menueVersatz(r.left, r.width, breite)}px`;
  }, [menue, offen, anker]);
}
