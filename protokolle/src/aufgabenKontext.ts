/**
 * **Was die Aufgaben-Blöcke im Editor wissen müssen** (S4-2) – die To-Dos der Gruppe, wer zuständig sein kann und wie
 * man ein To-Do ändert. BlockNote zeichnet die Blöcke im React-Baum des Editors, deshalb reicht ein Kontext vom
 * Bildschirm `ProtokollSchreiben` bis in `EditorBloecke`.
 */
import { createContext } from 'react';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import type { Person } from '@shared/organigramm/mitglieder';

export interface AufgabenKontextWert {
  /** Alle To-Dos der Gruppe nach ID (auch als gelöscht vermerkte). */
  todos: ReadonlyMap<string, Aufgabe>;
  /** Mitglieder der Gruppe; `verborgen` = ChurchTools zeigt sie nicht (403), `null` = noch nicht geladen/Fehler. */
  mitglieder: readonly Person[] | 'verborgen' | null;
  /** Darf hier Wer/Bis/Datum geändert werden (Leitung, niemand sonst schreibt gerade)? */
  bearbeitbar: boolean;
  /** Den Status ändern darf, wer To-Dos ändern darf – auch während jemand anderes schreibt. */
  statusAenderbar: boolean;
  /** Ich – mit Vornamen: Mitglieder sehen die Mitgliederliste oft nicht, sich selbst kennen sie trotzdem. */
  ich: { person: number; name: string };
  /** Ein To-Do ändern; gibt es das To-Do noch nicht, entsteht es mit diesem Text. */
  aendern: (id: string, text: string, f: (a: Aufgabe) => Aufgabe) => void;
}

export const AufgabenKontext = createContext<AufgabenKontextWert | null>(null);
