import { useState } from 'react';
import type { ChartOverlay } from '../components/ChartOverlays';

/**
 * Alle Fenster des Liedblatts als EIN Zustand (#283) – aus `ChordChart.tsx` herausgelöst (#465).
 *
 * Sie schließen sich gegenseitig aus: Mit fünf unabhängigen Flaggen war ein Zustand darstellbar, den
 * es nicht geben darf (zwei Fenster gleichzeitig offen). Mit einem Feld ist er nicht mehr ausdrückbar.
 *
 * **Die Namen kommen aus `ChartOverlay` und werden hier nicht abgeschrieben** (#321). Die Fenster, die
 * `ChartOverlays` gar nicht rendert (`tempo`, `files`, `stammdaten`, `werkzeuge`), stehen sichtbar
 * daneben statt in einer Liste vermischt.
 *
 * ⚠️ Lehre vom 05.08.2026: Ein zusammengelegter Zustand macht die **Reihenfolge der Setter** bedeutsam.
 * Wer ein Fenster öffnet, setzt das Feld genau EINMAL – ein zusätzliches Schließen danach machte das
 * gerade geöffnete sofort wieder zu.
 */
export type ChartFenster = ChartOverlay | 'tempo' | 'files' | 'stammdaten' | 'werkzeuge';

/** Was aus dem einen Feld für Kopfzeile und Overlays folgt – rein, damit es ohne React prüfbar ist. */
export function fensterAnsicht(overlay: ChartFenster) {
  return {
    /** Für `ChartOverlays`: nur seine eigenen Namen, die übrigen gelten dort als „keins offen". */
    chartOverlay:
      overlay === 'tempo' ||
      overlay === 'files' ||
      overlay === 'stammdaten' ||
      overlay === 'werkzeuge'
        ? null
        : overlay,
    offenesWerkzeug:
      overlay === 'appearance'
        ? ('aussehen' as const)
        : overlay === 'tempo'
          ? ('tempo' as const)
          : null,
    werkzeugeOffen: overlay === 'werkzeuge',
    werkzeugFensterOffen:
      overlay === 'werkzeuge' || overlay === 'appearance' || overlay === 'tempo',
    liedFensterOffen:
      overlay === 'menu' ||
      overlay === 'key' ||
      overlay === 'capo' ||
      overlay === 'sec' ||
      overlay === 'files' ||
      overlay === 'stammdaten',
  };
}

export function useChartOverlay() {
  const [overlay, setOverlay] = useState<ChartFenster>(null);
  /** Ein Fenster umschalten (nochmal derselbe Knopf schließt es). */
  const toggleOverlay = (o: 'appearance' | 'menu' | 'tempo' | 'werkzeuge') =>
    setOverlay((cur) => (cur === o ? null : o));
  return { overlay, setOverlay, toggleOverlay, ...fensterAnsicht(overlay) };
}
