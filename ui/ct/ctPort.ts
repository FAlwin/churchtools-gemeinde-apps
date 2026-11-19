/**
 * Der echte Anschluss an ChurchTools für `shared/ct/gruppenart.ts` (aus dem Organigramm hierher gezogen, N1a):
 * `ctDaten` zum Lesen, `ctAnfrage` zum Schreiben. Den Text bei 403 („Dir fehlt …“) bestimmt die App.
 */
import type { CtPort } from '@shared/ct/gruppenart';
import { ctAnfrage, ctDaten } from './verbindung';

export function ctPortMit(verweigert: string): CtPort {
  return {
    holen: (pfad) => ctDaten(pfad),
    async schicken(pfad, methode, json) {
      const body = await ctAnfrage<{ data?: unknown } | null>(pfad, {
        method: methode,
        body: json === undefined ? undefined : JSON.stringify(json),
        verweigert,
      });
      return body && typeof body === 'object' && 'data' in body ? body.data : body;
    },
  };
}
