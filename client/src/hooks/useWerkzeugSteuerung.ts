import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { WerkzeugId } from '../utils/werkzeuge';
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
  songId: number;
  setOverlay: (o: ChartFenster) => void;
  setDrawMode: Dispatch<SetStateAction<boolean>>;
  viewing: boolean;
  openSharers: () => void;
  stopViewing: () => void;
  vollbildUmschalten: () => void;
}) {
  // Erhöhen → PageDeck setzt den sichtbaren Zoom zurück.
  const [resetZoomSignal, setResetZoomSignal] = useState(0);

  /** Werkzeug des anderen Lieds, das nach dem Liedwechsel aufgehen soll (siehe Effekt unten). */
  const naechstesWerkzeug = useRef<WerkzeugId | null>(null);

  /**
   * Werkzeug des ANDEREN Lieds (Querformat): erst das Lied wählen, das Werkzeug erst NACH dem Wechsel
   * öffnen. Sofort ausgeführt, griffe es noch auf das alte Lied – „Notizen von …" listete dessen
   * Personen, und das Ende des Ansehens beim Liedwechsel (Effekt in `ChordChart`) machte es gleich
   * wieder zu. Anmerken SCHALTET hier EIN statt umzuschalten: Wer beim anderen Lied auf den Stift
   * tippt, will dort zeichnen, auch wenn beim bisherigen gerade gezeichnet wurde.
   *
   * Muss NACH dem Effekt „Ansehen gilt pro Lied" laufen – `ChordChart` ruft diesen Hook deshalb erst
   * danach auf.
   */
  useEffect(() => {
    const id = naechstesWerkzeug.current;
    if (!id) return;
    naechstesWerkzeug.current = null;
    if (id === 'aussehen') p.setOverlay('appearance');
    else if (id === 'tempo') p.setOverlay('tempo');
    else if (id === 'team') p.openSharers();
    else if (id === 'anmerken') p.setDrawMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.songId]);

  return {
    resetZoomSignal,
    /** Das Werkzeug merken, das nach dem nächsten Liedwechsel aufgehen soll. */
    nachLiedwechsel: (id: WerkzeugId) => {
      naechstesWerkzeug.current = id;
    },
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
