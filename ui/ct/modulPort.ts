/**
 * **Der Browser-Anschluss an den Speicher der Erweiterung** (`@shared/ct/modulDaten`, Regeln und Messwerte
 * dort) – für alle Erweiterungen des Repos. Stand bis 14.10.2026 nur in der Musik-App
 * (`client/src/services/ctModulDaten.ts`); der Dienstplaner braucht denselben für seine Entwürfe (E4-3).
 *
 * Geschrieben wird mit der Sitzung der Seite (`ctAnfrage`: CSRF, Bremse, Zeitgrenze). Ein 401 bei
 * fehlendem Recht übersetzt `fehlerAus` schon in `KeinSpeicherRecht` – „abgemeldet“ ist nur ein 401, bei
 * dem wirklich niemand mehr angemeldet ist.
 */
import type { ModulPort } from '@shared/ct/modulDaten';
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
