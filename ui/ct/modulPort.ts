/**
 * **Der Browser-Anschluss an den Speicher der Erweiterung** (`@shared/ct/modulDaten`, Regeln und Messwerte
 * dort) – für alle Erweiterungen des Repos. Stand bis 14.10.2026 nur in der Musik-App
 * (`client/src/services/ctModulDaten.ts`); der Dienstplaner braucht denselben für seine Entwürfe (E4-3).
 *
 * Geschrieben wird mit der Sitzung der Seite (`ctAnfrage`: CSRF, Bremse, Zeitgrenze). Ein 401 bei
 * fehlendem Recht übersetzt `fehlerAus` schon in `KeinSpeicherRecht` – „abgemeldet“ ist nur ein 401, bei
 * dem wirklich niemand mehr angemeldet ist.
 */
import { modulSuchen, type ModulPort } from '@shared/ct/modulDaten';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import { kuerzelAusBasis } from '../erweiterung/kuerzel';
import type { EntwurfPort } from '@shared/dienstplan/entwuerfe';
import { ApiError } from './fehler';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from './verbindung';

/** Der Anschluss für das Modul mit diesem Kürzel. */
export function modulPortFuer(kuerzel: () => string | null): ModulPort {
  return {
    kuerzel,
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
}

/** Dazu, was der Entwurfs-Speicher zusätzlich braucht. */
export function entwurfPortFuer(kuerzel: () => string | null): EntwurfPort {
  return {
    ...modulPortFuer(kuerzel),
    // Abgemeldet ist nur der echte 401. Ein fehlendes Recht (von ChurchTools ebenfalls als 401 gemeldet)
    // hat `fehlerAus` schon zu `KeinSpeicherRecht` mit Status 403 gemacht.
    istAbgemeldet: (e) => e instanceof ApiError && e.status === 401,
    jetzt: () => new Date().toISOString(),
  };
}

/**
 * **Der Anschluss der Erweiterung, in der dieser Code gerade läuft** – Kürzel aus der eigenen Adresse
 * (`/ccm/<kürzel>/`). Genutzt von den Anmeldungen (Einstellungen der Gemeinde, A6-2 #548).
 */
export const modulPort: ModulPort = modulPortFuer(() => kuerzelAusBasis(import.meta.env.BASE_URL));

/**
 * Die ID des eigenen Moduls – je Seite einmal gesucht; ein Fehlschlag wird nicht gemerkt. `wer` nennt die
 * Erweiterung in der Meldung, wenn sie fehlt (bis 22.10.2026 stand hier fest „Anmeldungen“; die Protokolle
 * nutzen denselben Anschluss).
 */
const suche = merkeVersprechen<number>();
export function modulId(wer: string): Promise<number> {
  return suche.hole('modul', () => modulSuchen(modulPort, wer));
}

/** Nur für Tests. */
export function _vergissModul(): void {
  suche.vergiss();
}
