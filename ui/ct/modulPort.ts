/**
 * **Der Datenbereich der eigenen Erweiterung – Anschluss für die Erweiterungen in `ui/`** (Anmeldungen, A6-2 #548;
 * der Dienstplaner kann ihn genauso nutzen). Regeln und Messwerte stehen im Kern `@shared/ct/modulDaten`; die
 * Musik-App hat einen eigenen Anschluss an ihre Laufzeit (`client/src/services/ctModulDaten.ts`).
 */
import * as kern from '@shared/ct/modulDaten';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import { ApiError } from './fehler';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from './verbindung';

/** Das Kürzel aus der Adresse der Erweiterung (`/ccm/<kürzel>/`) – `null` außerhalb von ChurchTools. */
export function kuerzelAus(basis: string): string | null {
  const m = /^\/ccm\/([^/]+)\/$/.exec(basis);
  return m ? decodeURIComponent(m[1]) : null;
}

export const modulPort: kern.ModulPort = {
  kuerzel: () => kuerzelAus(import.meta.env.BASE_URL),
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

/** Die ID des eigenen Moduls – je Seite einmal gesucht; ein Fehlschlag wird nicht gemerkt. */
const suche = merkeVersprechen<number>();
export function modulId(): Promise<number> {
  return suche.hole('modul', () => kern.modulSuchen(modulPort));
}

/** Nur für Tests. */
export function _vergissModul(): void {
  suche.vergiss();
}
