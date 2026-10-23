import { useEffect, useState } from 'react';

/**
 * **Wie hoch die Bildschirmtastatur gerade ist** (iOS: der `visualViewport` schrumpft, `innerHeight` nicht). EINE
 * Formel für die Aussparung der Fenster (`useOverlayKeyboardInset`, #207) und die Frage „schreibt gerade jemand?“
 * im Lied-Editor (`useTastaturOffen`).
 */
export function tastaturHoehe(vv: VisualViewport, innenHoehe = window.innerHeight): number {
  return Math.max(0, innenHoehe - vv.height - vv.offsetTop);
}

/**
 * Ab dieser Höhe gilt die Tastatur als offen. Darunter liegt nur die schmale Leiste, die iOS bei angesteckter
 * Hardware-Tastatur zeigt – dann ist genug Platz, und nichts soll sich umbauen.
 */
export const TASTATUR_AB_PX = 150;

/**
 * **Ist die Bildschirmtastatur offen?** (Lied-Editor, 23.10.2026; Alwin am iPad: „das Bearbeitungsfenster ist bei
 * aufgeklappter Tastatur deutlich zu klein“) – der Editor räumt dann alles weg, was nicht zum Schreiben gehört.
 */
export function useTastaturOffen(): boolean {
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const pruefen = () => setOffen(tastaturHoehe(vv) >= TASTATUR_AB_PX);
    pruefen();
    vv.addEventListener('resize', pruefen);
    return () => vv.removeEventListener('resize', pruefen);
  }, []);
  return offen;
}
