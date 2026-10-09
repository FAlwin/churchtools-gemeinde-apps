/**
 * Der Datenbereich des eigenen ChurchTools-Moduls in der **Erweiterung** – der Browser-Anschluss an
 * `@shared/ct/modulDaten` (Regeln und Messwerte dort). Darauf bauen die Gemeinde-Einstellungen
 * (`ctEinstellungen.ts`) und das Verzeichnis „Wer teilt" der Team-Notizen (`ctTeilen.ts`).
 */
import { ApiError } from './api';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from './ctRuntime';
import { erweiterungsKuerzel } from './modus';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import * as kern from '@shared/ct/modulDaten';
import type { KategorieAngabe, ModulPort, Wert } from '@shared/ct/modulDaten';

export { MAX_ZEICHEN, inhaltAus, type KategorieAngabe, type Wert } from '@shared/ct/modulDaten';

/** Der Anschluss der Erweiterung: Sitzung der Seite über `ctAnfrage`. */
export const modulPort: ModulPort = {
  kuerzel: erweiterungsKuerzel,
  daten: (pfad) => ctDaten(pfad),
  async schreibe(pfad, auftrag) {
    await ctAnfrage(pfad, {
      method: auftrag.method,
      body: auftrag.json === undefined ? undefined : JSON.stringify(auftrag.json),
      verweigert: auftrag.verweigert,
    });
  },
  fehler: (status, meldung) => new ApiError(status, meldung),
  istKeinRecht: (e) => e instanceof KeinSpeicherRecht,
  istNichtGefunden: (e) => e instanceof ApiError && e.status === 404,
};

/**
 * Die ID des eigenen Moduls – je Sitzung der Seite einmal gesucht. Ein Fehlschlag wird NICHT gemerkt
 * (vorübergehend ist nicht ungültig).
 */
const modulSuche = merkeVersprechen<number>();

export function modulId(): Promise<number> {
  return modulSuche.hole('modul', () => kern.modulSuchen(modulPort));
}

/** Nur für Tests: das gemerkte Modul vergessen. */
export function _vergissModul(): void {
  modulSuche.vergiss();
}

export const kategorieSuchen = (modul: number, kuerzel: string): Promise<number | null> =>
  kern.kategorieSuchen(modulPort, modul, kuerzel);

export const kategorieSicherstellen = (
  modul: number,
  k: KategorieAngabe,
  verweigert: string,
): Promise<number> => kern.kategorieSicherstellen(modulPort, modul, k, verweigert);

export const werteLesen = (modul: number, kategorie: number): Promise<Wert[]> =>
  kern.werteLesen(modulPort, modul, kategorie);

export const wertAnlegen = (
  modul: number,
  kategorie: number,
  value: string,
  verweigert: string,
): Promise<void> => kern.wertAnlegen(modulPort, modul, kategorie, value, verweigert);

export const wertAendern = (
  modul: number,
  kategorie: number,
  id: number,
  value: string,
  verweigert: string,
): Promise<void> => kern.wertAendern(modulPort, modul, kategorie, id, value, verweigert);

export const wertLoeschen = (
  modul: number,
  kategorie: number,
  id: number,
  verweigert: string,
): Promise<void> => kern.wertLoeschen(modulPort, modul, kategorie, id, verweigert);

export const istDauerhaftLeer = (e: unknown): boolean => kern.istDauerhaftLeer(modulPort, e);
