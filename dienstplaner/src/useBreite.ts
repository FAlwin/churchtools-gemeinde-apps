import { useLayoutEffect, useState } from 'react';

/**
 * **Wie breit ist das Element gerade?** – für „passend zur Fensterbreite“ in der Matrix (E3-5).
 * Gibt eine Callback-Ref zurück: gemessen wird, **sobald das Element da ist** – auch wenn es erst nach dem
 * Laden erscheint (mit `useRef` lief der Effekt nur beim ersten Rendern, als es noch fehlte; im Browser
 * gefunden: „passend“ zeigte alle Termine).
 * `0` = unbekannt (ohne Element oder ohne `ResizeObserver`, z. B. in Tests); dann zeigt die Matrix alle
 * Termine (`passendeAnzahl`).
 */
export function useBreite(): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [breite, setBreite] = useState(0);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const messen = () => setBreite(el.clientWidth);
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, breite];
}
