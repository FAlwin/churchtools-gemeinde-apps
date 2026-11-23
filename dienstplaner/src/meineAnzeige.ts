import { createContext, useContext } from 'react';
import type { DatenDatei } from '@shared/ct/personenAblage';

/**
 * **„Meine Anzeige“ – was ich in der Live-Ansicht, im Rückblick und beim Planen sehen will** (Live-Ansicht 2, A8/A13/A15/A16,
 * L4-5). Je Person, auf allen Geräten: gespeichert in der Personen-Datei `dienstplaner_anzeige.json` (T7, Baustein
 * `useAblageSpiegel` → `personenAblage`), ein- und ausgeschaltet unter „Einstellungen → Meine Anzeige“. **Standard: alles an**
 * (A15) – der Standard gilt nur zur Anzeige und steht nie in der Datei (siehe `anzeigeAus`: Die Datei enthält nur, was die
 * Person selbst gewählt hat).
 *
 * Die Stellen, die es betrifft, lesen nur `useMeineAnzeige()`; der Anschluss an ChurchTools liegt in
 * `MeineAnzeigeAnschluss` (Kontext). Ohne Anschluss (Tests, Vorschau) gilt der Standard.
 */
export interface MeineAnzeige {
  /** „−1 / +1 Min“ in der Live-Ansicht (A13: Die Rechnung bleibt, es fehlen nur die Knöpfe). */
  minutenKnoepfe: boolean;
  /** Das leise „Ø m:ss“ unter der Dauer beim Ablauf bearbeiten (A8). */
  schnittBeimPlanen: boolean;
  /** Die Karte „Rückblick“ im Termin zeigen. */
  rueckblick: boolean;
  /** Im Rückblick die Spalte „Ø bisher“ (nur wirksam, solange `rueckblick` an ist). */
  spalteSchnitt: boolean;
  /** Im Rückblick die Spalte „±“ (nur wirksam, solange `rueckblick` an ist). */
  spalteAbweichung: boolean;
  /** Die Infos der eigenen Dienstgruppen in der Live-Ansicht (A16). */
  infosMeinerGruppen: boolean;
}

export const STANDARD_ANZEIGE: MeineAnzeige = {
  minutenKnoepfe: true,
  schnittBeimPlanen: true,
  rueckblick: true,
  spalteSchnitt: true,
  spalteAbweichung: true,
  infosMeinerGruppen: true,
};

/** Die Namen der Felder – zugleich die Feldnamen in der Personen-Datei (Format `v: 1`, je Feld Wert + Zeitpunkt). */
export const ANZEIGE_FELDER = Object.keys(STANDARD_ANZEIGE) as (keyof MeineAnzeige)[];

/**
 * Aus dem Stand der Personen-Datei (oder dem Spiegel im Gerät) die Anzeige. Ein fehlendes Feld, ein unbekanntes Feld
 * (spätere Schalter) oder ein Wert, der kein Ja/Nein ist, ändert nichts: es gilt der Standard „an“.
 */
export function anzeigeAus(s: DatenDatei): MeineAnzeige {
  const a = { ...STANDARD_ANZEIGE };
  for (const k of ANZEIGE_FELDER) {
    const w = s.felder[k]?.w;
    if (typeof w === 'boolean') a[k] = w;
  }
  return a;
}

export interface AnzeigeSteuerung {
  anzeige: MeineAnzeige;
  /** Schalter ändern: sofort im Gerät, nach ChurchTools nach einer kurzen Pause. */
  setzen: (teil: Partial<MeineAnzeige>) => void;
  /** Der letzte Abgleich mit ChurchTools ist gescheitert – die Wahl gilt vorerst nur auf diesem Gerät. */
  abgleichFehler: boolean;
}

export const AnzeigeKontext = createContext<AnzeigeSteuerung>({
  anzeige: STANDARD_ANZEIGE,
  setzen: () => {},
  abgleichFehler: false,
});

/** Die Anzeige-Wünsche dieser Person. */
export function useMeineAnzeige(): MeineAnzeige {
  return useContext(AnzeigeKontext).anzeige;
}

/** Wie `useMeineAnzeige`, dazu das Ändern – für das Fenster „Einstellungen“. */
export function useMeineAnzeigeAendern(): AnzeigeSteuerung {
  return useContext(AnzeigeKontext);
}
