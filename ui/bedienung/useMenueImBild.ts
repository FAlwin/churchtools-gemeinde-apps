import { useLayoutEffect, type RefObject } from 'react';
import { menueVersatz } from './menueLage';

/**
 * **Ein aufgeklapptes Menü bleibt im Bild** – vor dem ersten Bild an den Knopf setzen, messen und so weit nach links
 * rücken, dass es rechts nicht hinausragt (`menueVersatz`). Eine Stelle für „Anfangen bei“ und „Welche Rollen“ im
 * Organigramm (#915) – sonst stünde die Messung zweimal da.
 *
 * Wer danach noch etwas tun will, das vom Platz abhängt (z. B. den Fokus setzen), tut es in einem `useLayoutEffect`,
 * der NACH diesem Hook steht – React führt sie in dieser Reihenfolge aus.
 */
export function useMenueImBild(menue: RefObject<HTMLElement | null>, offen: boolean): void {
  useLayoutEffect(() => {
    const m = menue.current;
    if (!offen || !m) return;
    m.style.left = '0px';
    const r = m.getBoundingClientRect();
    m.style.left = `${menueVersatz(r.left, r.width, document.documentElement.clientWidth)}px`;
  }, [menue, offen]);
}
