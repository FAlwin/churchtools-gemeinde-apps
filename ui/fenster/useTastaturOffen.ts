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
 * **Wogegen gemessen wird:** die beim Tippen eingefrorene App-Höhe (`--app-h`, `syncAppHeight` hält sie an, solange
 * ein Eingabefeld den Fokus hat) – oder `innerHeight`, wenn das mehr ist. iOS legt die Tastatur mal ÜBER die Seite
 * (`innerHeight` bleibt), mal VERKLEINERT es das Fenster (`innerHeight` schrumpft mit, gegen `innerHeight` gemessen
 * wäre die Tastatur dann 0). Dieselbe Lehre steht in `useKeyboardInsets`; hier fehlte sie zuerst (Alwin am iPad,
 * 23.10.2026: „manchmal funktioniert's mit der einen Zeile, manchmal nicht“).
 */
function grundHoehe(): number {
  const app = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-h'));
  return Math.max(window.innerHeight, Number.isFinite(app) ? app : 0);
}

/**
 * **Ist die Bildschirmtastatur offen?** (Lied-Editor, 23.10.2026; Alwin am iPad: „das Bearbeitungsfenster ist bei
 * aufgeklappter Tastatur deutlich zu klein“) – der Editor räumt dann alles weg, was nicht zum Schreiben gehört.
 */
export function useTastaturOffen(): boolean {
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const pruefen = () => setOffen(tastaturHoehe(vv, grundHoehe()) >= TASTATUR_AB_PX);
    pruefen();
    vv.addEventListener('resize', pruefen);
    vv.addEventListener('scroll', pruefen);
    window.addEventListener('resize', pruefen);
    return () => {
      vv.removeEventListener('resize', pruefen);
      vv.removeEventListener('scroll', pruefen);
      window.removeEventListener('resize', pruefen);
    };
  }, []);
  return offen;
}
