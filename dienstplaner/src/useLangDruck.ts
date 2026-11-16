import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/** Wie lange man drücken muss (ms) – wie ein langes Drücken am Handy überall. */
export const LANG_MS = 500;
/** Wandert der Finger weiter als das (px), war es ein Wischen (Scrollen), kein langes Drücken. */
const WEG_PX = 10;

/**
 * **Langes Drücken** (Fokus-Modus, Wunsch 11): `aktion` läuft, wenn ein Finger oder Stift `LANG_MS` ms auf dem Element
 * bleibt, ohne zu wandern. Gilt **nicht für die Maus** – dort gibt es das Fokus-Symbol beim Darüberfahren. Das Antippen
 * danach (`click`) wird verschluckt, sonst ginge zusätzlich das Fenster am Platz auf. Ohne `aktion` kommt `{}` zurück
 * (kein Handler, kein Verhalten). Die Hände an das Element: `<button {...langDruck}>`.
 */
export function useLangDruck(aktion: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const ausgeloest = useRef(false);
  const aktionRef = useRef(aktion);
  aktionRef.current = aktion;

  const weg = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    // Beim Verschwinden keinen Zeitgeber zurücklassen.
    return weg;
  }, []);

  if (!aktion) return {};
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      // Ein neuer Druck beginnt: ein vergessenes „ausgelöst“ vom letzten Mal darf diesen Tipp nicht schlucken.
      ausgeloest.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      weg();
      timer.current = setTimeout(() => {
        timer.current = null;
        ausgeloest.current = true;
        aktionRef.current?.();
      }, LANG_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (timer.current === null || !start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > WEG_PX) weg();
    },
    onPointerUp: weg,
    onPointerCancel: weg,
    onPointerLeave: weg,
    // Beim langen Drücken öffnet Android sein Kontextmenü – das wäre im Weg.
    onContextMenu: (e: MouseEvent) => {
      if (ausgeloest.current || timer.current !== null) e.preventDefault();
    },
    onClickCapture: (e: MouseEvent) => {
      if (!ausgeloest.current) return;
      ausgeloest.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
