import { createContext, useContext } from 'react';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { Schreiber } from '@shared/ct/sperre';
import type { Einstellungen } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import type { useSperrarbeit } from './useSperrarbeit';

/** So lange nach der letzten Änderung wartet das Speichern – ein Farbwähler meldet beim Ziehen jede Stufe. */
export const SPEICHER_VERZOEGERUNG_MS = 700;

export type EinstellungenWert = Einstellungen | null;

/** Was `speichereJetzt` meldet. Ob das Speichern selbst gelingt, zeigt danach `sperre.speicher`. */
export type JetztErgebnis =
  /** Der Stand ist übernommen und zum Speichern abgeschickt (kein Warten auf die Verzögerung). */
  | { art: 'ok' }
  /** Nicht dran: fremd gesperrt, ChurchTools antwortet nicht … – der Grund steht in `sperre` (Hinweis/fremd). */
  | { art: 'abgelehnt' }
  /** Besteht das Schema nicht – nichts wurde übernommen. */
  | { art: 'ungueltig'; meldung: string };

export interface EinstellungenBereit {
  art: 'bereit';
  /** Alles, was beim Öffnen gelesen wurde (die Seiten und das Menü für Vorschau und Link-Ziele eingeschlossen). */
  stand: WebsiteStand;
  gemeinde: string | null;
  ich: Schreiber;
  /** Die Arbeitskopie der Einstellungen – **die eine**, die „Aussehen“ und das Fenster „Einstellungen“ teilen. */
  arbeit: Einstellungen;
  /** Grund, warum die letzte Änderung nicht gespeichert wird (Schema). */
  meldung: string | null;
  sperre: ReturnType<typeof useSperrarbeit<EinstellungenWert>>;
  /** Eine Änderung: erst die Sperre, dann in die Arbeitskopie und – nach kurzer Wartezeit – speichern. */
  aendern: (f: (e: Einstellungen) => Einstellungen) => Promise<void>;
  /** Was wartet, sofort speichern (Feld verlassen, Reiter wechseln). */
  abschicken: () => void;
  /** Eine Änderung übernehmen und **sofort** speichern – für das Fenster, dessen „Speichern“ jetzt gilt. */
  speichereJetzt: (f: (e: Einstellungen) => Einstellungen) => Promise<JetztErgebnis>;
  /** Das letzte Neuladen ist gescheitert (die gezeigten Daten sind die bisherigen). */
  neuFehler?: Fehlermeldung;
  neu: () => void;
}

export type EinstellungenQuelle =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung; neu: () => void }
  /** Die gespeicherten Einstellungen lassen sich nicht lesen – nichts wird angeboten, nichts überschrieben. */
  | { art: 'unlesbar'; probleme: WebsiteStand['probleme'] }
  | EinstellungenBereit;

export const Kontext = createContext<EinstellungenQuelle | null>(null);

/** Der gemeinsame Zustand der Einstellungen – nur innerhalb von `EinstellungenProvider`. */
export function useEinstellungen(): EinstellungenQuelle {
  const q = useContext(Kontext);
  if (!q)
    throw new Error('useEinstellungen steht nur unter <EinstellungenProvider> zur Verfügung.');
  return q;
}
