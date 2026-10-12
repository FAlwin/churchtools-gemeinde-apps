/**
 * Die Laufzeit der Musik-App als ChurchTools-Extension (#334, Plan `docs/entwicklung/plan-extension.md`).
 *
 * Die Verbindung zu ChurchTools selbst (Fehler-Übersetzung, Bremse, CSRF, Zeitgrenzen) teilen sich alle
 * Erweiterungen des Repos: `ui/ct/verbindung.ts` (#474). Hier stellt die Musik-App sie ein und reicht
 * sie weiter – die Aufrufer importieren weiter aus `./ctRuntime`.
 *
 * Modus und Adresse stehen in `modus.ts` (ohne Abhängigkeiten aus der App – sonst entstünde ein
 * Import-Kreis über `api` → `reachability`).
 */
import { ApiError } from './api';
import { markReachable } from './reachability';
import { istExtension } from './modus';
import { verbindungEinrichten } from '@ui/ct/verbindung';

export {
  ctBasis,
  fehlerAus,
  KeinSpeicherRecht,
  ChurchToolsBremst,
  istUeberlastet,
  _bremseLoesen,
  _vergissCsrf,
  ctAnfrage,
  ctDaten,
  ctAltAnfrage,
  ctDatei,
} from '@ui/ct/verbindung';
export { istExtension };

/**
 * Die Musik-App speichert in der Erweiterung an der eigenen Person – fehlt dafür das Recht, sagt sie
 * genau das und behält die Änderungen auf dem Gerät.
 */
const KEIN_RECHT_MELDUNG =
  'ChurchTools erlaubt dir nicht, hier zu speichern. Deine Änderungen bleiben auf diesem Gerät. ' +
  'Bitte frag die Verantwortlichen deiner Gemeinde nach dem Recht „Eigene Personendaten bearbeiten".';

// Als Pfeil, nicht als Verweis auf `markReachable`: `reachability` lädt diese Datei mit – zum
// Zeitpunkt dieses Aufrufs ist es womöglich erst halb geladen.
verbindungEinrichten({ erreichbar: (ja) => markReachable(ja), keinRecht: KEIN_RECHT_MELDUNG });

/**
 * Was es in der Extension (noch) nicht gibt – ehrlich gesagt statt still gescheitert (#335).
 * `was` ist ein Satzanfang („Die Liedverwaltung").
 */
export function ohneServer<T>(was: string): Promise<T> {
  return Promise.reject(
    new ApiError(501, `${was} gibt es in der ChurchTools-Erweiterung noch nicht.`),
  );
}
