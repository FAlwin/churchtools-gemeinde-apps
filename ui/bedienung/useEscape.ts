import { useEffect, useRef } from 'react';

/**
 * **Escape schließt** – der gewohnte Weg hinaus mit der Tastatur. Eine Stelle für Blätter, Menüs und Bestätigungs-Fenster
 * (vorher in `OptionWaehlen` versteckt und in `useAufklapp`/`AkkordLeiste` je nachgebaut; dem `ConfirmDialog` fehlte es
 * ganz, 16.11.2026). `aktiv: false` (zu, oder es läuft gerade etwas) hört nicht hin. `schliessen` darf sich bei jedem
 * Rendern ändern – es wird immer die aktuelle Fassung gerufen, ohne den Listener neu zu setzen.
 */
export function useEscape(aktiv: boolean, schliessen: () => void): void {
  const aktuell = useRef(schliessen);
  aktuell.current = schliessen;
  useEffect(() => {
    if (!aktiv) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aktuell.current();
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [aktiv]);
}
