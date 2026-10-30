import {
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
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

/** Wie lange ein Finger liegen muss, bis das Ziehen beginnt (Board der Protokolle, S7-3). */
export const LANG_DRUECKEN_MS = 400;

/**
 * **Ziehen ohne Griff** (Board der To-Dos, Alwin 30.10.2026: „lange drücken“): Mit der Maus wird die ganze Karte nach
 * 6 px gezogen; mit dem **Finger erst nach ~0,4 s Liegenlassen** – wer vorher wischt, blättert (Toleranz 8 px). Getrennte
 * Sensoren, weil ein Zeiger-Sensor Maus und Finger gleich behandeln würde. Tastatur wie oben.
 */
export function useZiehSensorenLangDruecken() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: LANG_DRUECKEN_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
