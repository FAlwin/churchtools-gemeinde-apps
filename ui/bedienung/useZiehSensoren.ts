import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * **Die Zieh-Einstellungen für alle umsortierbaren Listen** – eine Stelle statt Kopien (22.10.2026: stand
 * gleich in der Ablauf-Liste und den Links der Verwaltung; die Ablauf-Kärtchen des Lied-Editors wären die
 * dritte Kopie gewesen).
 *
 * Erst nach 6 px Bewegung beginnt ein Ziehen – sonst wäre jeder Tipp auf eine Zeile oder ein Kärtchen schon
 * ein Ziehen. Mit der Tastatur: Leertaste greift, Pfeile verschieben, Leertaste legt ab.
 */
export function useZiehSensoren() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
