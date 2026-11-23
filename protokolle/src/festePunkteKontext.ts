/**
 * **Was die festen Punkte wissen müssen** (S4-3a) – die Sitzung, in der sie stehen, die To-Dos und Protokolle der
 * Gruppe. Editor (BlockNote zeichnet die Blöcke in seinem eigenen React-Baum) und Lese-Ansicht lesen denselben
 * Kontext; bereitgestellt von `FestePunkteRahmen`.
 */
import { createContext } from 'react';
import type { Anfrage, Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe, HakenSchritt } from '@shared/protokolle/aufgaben';

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
  /** Ich (Person-ID) – für den Haken bei „Jeder für sich“ (mein Teil). */
  ich?: number;
  /** Den Haken eines To-Dos setzen (`hakenSchritt`) – nur im Editor; fehlt er, zeigt der Kreis nur an. */
  status?: (a: Aufgabe, schritt: HakenSchritt) => void;
  /**
   * Darf ich bei diesem To-Do den Haken setzen? (W16) Fehlt: ja (Leitung). Wer als „Schreibt mit“ im Editor ist, hakt nur ab,
   * was auch ein Mitarbeiter darf (`toDoRechte`, W9) – die To-Dos anderer bleiben der Leitung.
   */
  darfHaken?: (a: Aufgabe) => boolean;
  /** Ein Protokoll im Fenster öffnen – fehlt im Fenster selbst (kein Fenster im Fenster). */
  oeffnen?: (s: Sitzung) => void;
  /** Die früheren Protokolle zur Wahl (`fruehereProtokolle`, K3b-2) – neueste zuerst. */
  fruehere: readonly Sitzung[];
  /**
   * Das Fenster „Früheres Protokoll“ zeigen (K3b-2): `vorgewaehlt` = `kopf.sitzung`, `fertig` bekommt die Wahl.
   * Fehlt im Fenster selbst.
   */
  waehlen?: (
    q: { titel: string; knopf: string; vorgewaehlt: string | null },
    fertig: (s: Sitzung) => void,
  ) => void;
  /** Das Gruppentreffen der Sitzung (S5-3) – `null`, solange es keins gibt. */
  treffen: number | null;
  /** Die Antworten auf die Einladung – für die Vorbelegung der Anwesenheit. */
  anfragen: readonly Anfrage[];
  /** „Gruppentreffen anlegen“ (S5-3) – nur beim Schreiben; legt an und verknüpft es mit dem Protokoll. */
  treffenAnlegen?: () => Promise<void>;
  /**
   * Dieses Fenster schreibt gerade (hält die Sperre, W16). Nur dann merkt sich die Anwesenheit ihren gelesenen Stand von
   * selbst im Block – ein bloßes Öffnen soll niemandem die Sperre wegnehmen. Nach einem eigenen Tipp schreibt sie ihn immer.
   */
  schreibt?: boolean;
}

export const FestePunkteKontext = createContext<FestePunkteWert | null>(null);
