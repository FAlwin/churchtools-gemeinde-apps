import { createContext } from 'react';

/**
 * **Die Fläche, auf der das Plus schwebt** (B8a, 20.11.2026). Ein Rahmen, dessen Inhalt in einem eigenen Rollbereich
 * scrollt (`ErweiterungsRahmen`), reicht seine Fläche **außerhalb** des Rollbereichs hierher. Das Plus zeichnet sich
 * dann dorthin (Portal) – egal, wie tief die Seite es im Inhalt aufgerufen hat.
 *
 * Vorher hing es im Inhalt: In „Wann kann ich?“ des Dienstplaners lag es in einem Kasten mit `overflow: hidden`
 * (`.karte`); der machte seine Bezugsfläche (`position: sticky`) zum Rollbereich, und das Plus stand am Ende des Kastens
 * – bei 844 px Höhe auf y≈1000, also unter dem Bildschirmrand. Wer das Plus in einen Kasten legt, bekommt es jetzt trotzdem
 * an die richtige Stelle. Ohne diese Fläche (Musik-App: `SeitenGeruest.ueberlagerung`) steht das Plus dort, wo es aufgerufen wird.
 */
export const SchwebeFlaeche = createContext<HTMLElement | null>(null);
