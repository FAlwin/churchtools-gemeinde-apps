import { useEffect, useState } from 'react';

/** Eingabefelder, die KEINE Bildschirmtastatur öffnen – ein angetipptes Häkchen hat zwar den Fokus, tippt aber nicht. */
const OHNE_TASTATUR = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * **Nimmt gerade ein Feld Text an?** Nur dann kann iOS eine Bildschirmtastatur zeigen. EINE Regel für die
 * Tastaturhöhe unten und für `syncAppHeight` (`appHeight.ts`), das beim Tippen die App-Höhe anhält.
 */
export function schreibtGerade(el: Element | null = document.activeElement): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el instanceof HTMLInputElement && !OHNE_TASTATUR.has(el.type);
}

/**
 * **Wie hoch die Bildschirmtastatur gerade ist** (iOS: der `visualViewport` schrumpft, `innerHeight` nicht). EINE
 * Formel für die Aussparung der Fenster (`useOverlayKeyboardInset`, #207) und die Frage „schreibt gerade jemand?“
 * im Lied-Editor (`useTastaturOffen`).
 *
 * **Ohne Feld, in dem geschrieben wird, ist keine Tastatur offen** – egal, was der `visualViewport` meldet. iOS hält
 * dessen Höhe manchmal noch klein, wenn die Tastatur längst zu ist (nach dem Lied-Editor, nach einer Weile im
 * Hintergrund). Dann sparte jedes neue Fenster eine Tastatur aus, die es nicht gab, und behielt selbst 0 px: nur der
 * dunkle Schleier, kein Fenster, erst ein Neustart half (Alwin am iPhone 29.10. und am iPad 30.10.2026).
 */
export function tastaturHoehe(vv: VisualViewport, innenHoehe = window.innerHeight): number {
  if (!schreibtGerade()) return 0;
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
export function grundHoehe(): number {
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
