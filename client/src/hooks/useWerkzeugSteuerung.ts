import { useState, type Dispatch, type SetStateAction } from 'react';
import type { ChartFenster } from './useChartOverlay';
import { funktionen } from '../services/funktionen';

/**
 * Was die Werkzeug-Knöpfe der Kopfzeile tun – aus `ChordChart.tsx` herausgelöst (#465), unverändert.
 *
 * ⚠️ **Jeder Knopf setzt das Fenster-Feld genau EINMAL** – auf das nächste Fenster oder auf `null`.
 * Ein zusätzliches Schließen danach machte das gerade geöffnete Fenster sofort wieder zu (Lehre vom
 * 05.08.2026: Ein zusammengelegter Zustand macht die Reihenfolge der Setter bedeutsam). Deshalb stehen
 * die Handler hier beisammen und nicht verstreut im JSX.
 */
export function useWerkzeugSteuerung(p: {
  setOverlay: (o: ChartFenster) => void;
  setDrawMode: Dispatch<SetStateAction<boolean>>;
  viewing: boolean;
  openSharers: () => void;
  stopViewing: () => void;
  vollbildUmschalten: () => void;
}) {
  // Erhöhen → PageDeck setzt den sichtbaren Zoom zurück.
  const [resetZoomSignal, setResetZoomSignal] = useState(0);

  return {
    resetZoomSignal,
    onAppearance: () => p.setOverlay('appearance'),
    onTempo: () => p.setOverlay('tempo'),
    onResetZoom: () => {
      p.setOverlay(null);
      setResetZoomSignal((n) => n + 1);
    },
    onToggleTeamNotes: () => {
      p.setOverlay(null);
      if (p.viewing) p.stopViewing();
      else p.openSharers();
    },
    onToggleDraw: () => {
      p.setOverlay(null);
      p.setDrawMode((d) => !d);
    },
    onVollbild: funktionen.vollbildKnopf
      ? () => {
          p.setOverlay(null);
          p.vollbildUmschalten();
        }
      : undefined,
  };
}
