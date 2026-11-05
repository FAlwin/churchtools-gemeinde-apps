import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * **Das Vollbild des Browsers** für ein Element – eine Stelle für die Präsentation des Organigramms und die
 * Ablauf-Anzeige des Dienstplaners (E6b-1, 30.10.2026; vorher nur in `organigramm/src/Praesentation.tsx`).
 *
 * `kann` ist falsch, wo der Browser kein Vollbild für Seiten hat (iPhone-Safari) – dann gibt es keinen Knopf. Ein
 * abgelehntes Vollbild (z. B. ohne Klick ausgelöst) ändert nichts. `an` folgt dem Browser, auch wenn er das Vollbild
 * selbst beendet (Escape).
 */
export function useVollbild(wurzel: RefObject<HTMLElement | null>) {
  const kann = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  const [an, setAn] = useState(false);

  useEffect(() => {
    const folgen = () => setAn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', folgen);
    return () => document.removeEventListener('fullscreenchange', folgen);
  }, []);

  const umschalten = useCallback(() => {
    if (!kann) return;
    const p = document.fullscreenElement
      ? document.exitFullscreen()
      : wurzel.current?.requestFullscreen();
    p?.catch(() => undefined);
  }, [kann, wurzel]);

  /** Beim Schließen der Ansicht: ein offenes Vollbild beenden. */
  const beenden = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }, []);

  return { kann, an, umschalten, beenden };
}
