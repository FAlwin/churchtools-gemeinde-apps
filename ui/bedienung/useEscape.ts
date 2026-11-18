import { useEffect, useRef } from 'react';

/**
 * Wer gerade auf Escape hört – das zuletzt geöffnete steht hinten. **Nur das oberste schließt** (18.11.2026): Seit auch
 * `Sheet` hört, liegen oft zwei übereinander (Rückfrage über dem Fenster, Menü im Fenster, Umbenennen über den
 * Dateien) – ohne diese Liste schlösse ein Druck auf Escape alle auf einmal.
 */
const stapel: symbol[] = [];

/**
 * **Escape schließt** – der gewohnte Weg hinaus mit der Tastatur. Eine Stelle für Blätter, Menüs und Fenster (vorher in
 * `OptionWaehlen` versteckt und in `useAufklapp`/`AkkordLeiste` je nachgebaut; dem `ConfirmDialog` fehlte es bis
 * 16.11.2026, dem `Sheet` bis 18.11.2026 ganz). `aktiv: false` heißt **zu** – dann hört es nicht hin. Sind mehrere
 * offen, reagiert nur das zuletzt geöffnete. **Offen, aber gerade nicht schließbar** (es läuft etwas, eine Meldung ohne
 * Abbrechen): `aktiv` bleibt `true` und `schliessen` tut nichts – sonst rutschte Escape zum Fenster darunter durch.
 * `schliessen` darf sich bei jedem Rendern ändern – es wird immer die aktuelle Fassung gerufen, ohne den Listener neu
 * zu setzen.
 */
export function useEscape(aktiv: boolean, schliessen: () => void): void {
  const aktuell = useRef(schliessen);
  aktuell.current = schliessen;
  useEffect(() => {
    if (!aktiv) return;
    const ich = Symbol('escape');
    stapel.push(ich);
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stapel[stapel.length - 1] === ich) aktuell.current();
    };
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('keydown', taste);
      const stelle = stapel.indexOf(ich);
      if (stelle !== -1) stapel.splice(stelle, 1);
    };
  }, [aktiv]);
}
