/**
 * **Was die festen Punkte wissen müssen** (S4-3a) – die Sitzung, in der sie stehen, die To-Dos und Protokolle der
 * Gruppe. Editor (BlockNote zeichnet die Blöcke in seinem eigenen React-Baum) und Lese-Ansicht lesen denselben
 * Kontext; bereitgestellt von `FestePunkteRahmen`.
 */
import { createContext } from 'react';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe, AufgabenStatus } from '@shared/protokolle/aufgaben';

export interface FestePunkteWert {
  /** ID der Sitzung, in der die Punkte stehen (`kopf.sitzung`). */
  sitzung: string;
  gruppe: number;
  /** `JJJJ-MM-TT` in der Zeitzone der Gemeinde. */
  heute: string;
  zeitzone: string;
  /** Alle To-Dos der Gruppe. */
  aufgaben: readonly Aufgabe[];
  /** Die freigegebenen Protokolle der Gruppe – für ein festgehaltenes „Letztes Protokoll“. */
  protokolle: readonly Sitzung[];
  /** Das letzte freigegebene Protokoll vor dieser Sitzung (live, `letztesProtokoll`). */
  letztes: Sitzung | null;
  /** Name einer Person – nur, wo die Mitglieder geladen sind (Editor). */
  name?: (person: number) => string | null;
  /** Status eines To-Dos ändern – nur im Editor; fehlt er, zeigt der Kreis nur an. */
  status?: (a: Aufgabe, neu: AufgabenStatus) => void;
  /** Ein Protokoll im Fenster öffnen – fehlt im Fenster selbst (kein Fenster im Fenster). */
  oeffnen?: (s: Sitzung) => void;
}

export const FestePunkteKontext = createContext<FestePunkteWert | null>(null);
