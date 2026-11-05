import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * - `echt`: das Vollbild des Browsers (`requestFullscreen`).
 * - `ersatz`: wo der Browser kein Vollbild für Seiten hat (iPhone-Safari), legt die Ansicht das Element selbst über die
 *   Seite (Großansicht) – sie bekommt nur `an`, das Aussehen macht sie selbst.
 */
export type VollbildArt = 'echt' | 'ersatz';

/**
 * **Das Vollbild des Browsers** für ein Element – eine Stelle für die Präsentation des Organigramms, die
 * Ablauf-Anzeige des Dienstplaners (E6b-1, 30.10.2026; vorher nur in `organigramm/src/Praesentation.tsx`) und den
 * Player des Gebetsabends (G2).
 *
 * `kann` ist falsch, wo der Browser kein Vollbild für Seiten hat (iPhone-Safari) – dann gibt es keinen Knopf. **Außer**
 * mit `ersatz: true` (Gebetsabend, 05.11.2026): Dann ist `art` dort `'ersatz'`, und `an` schaltet nur um; die Ansicht
 * legt das Element selbst groß über die Seite. Nur einschalten, wo die Ansicht dafür Stile hat – sonst täte der Knopf
 * sichtbar nichts. Ein abgelehntes Vollbild (z. B. ohne Klick ausgelöst) ändert nichts. `an` folgt dem Browser, auch
 * wenn er das Vollbild selbst beendet (Escape).
 */
export function useVollbild(
  wurzel: RefObject<HTMLElement | null>,
  { ersatz = false }: { ersatz?: boolean } = {},
) {
  const echt = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  const art: VollbildArt | null = echt ? 'echt' : ersatz ? 'ersatz' : null;
  const kann = art !== null;
  const [an, setAn] = useState(false);

  useEffect(() => {
    if (!echt) return;
    const folgen = () => setAn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', folgen);
    return () => document.removeEventListener('fullscreenchange', folgen);
  }, [echt]);

  const umschalten = useCallback(() => {
    if (art === 'ersatz') {
      setAn((x) => !x);
      return;
    }
    if (!kann) return;
    const p = document.fullscreenElement
      ? document.exitFullscreen()
      : wurzel.current?.requestFullscreen();
    p?.catch(() => undefined);
  }, [art, kann, wurzel]);

  /** Beim Schließen der Ansicht: ein offenes Vollbild (oder die Großansicht) beenden. */
  const beenden = useCallback(() => {
    if (art === 'ersatz') setAn(false);
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }, [art]);

  return { kann, an, art, umschalten, beenden };
}
