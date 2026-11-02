/**
 * **Der Anschluss an die alte Schnittstelle im Browser** – für die Regeln in `shared/`, die über `AltAnfragePort` rufen
 * (Vorlieben E5-3, Live-Agenda E6b-2). Holt über `ctAltAnfrage` (Sitzung, CSRF-Token, Bremse, Zeitgrenze); der Status
 * eines Fehlers trennt „abgemeldet“, „kein Recht“ und „vorübergehend“. Nur die Meldung bei 403 ist je Zweck eigen.
 */
import { ctAltAnfrage } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import type { AltAnfragePort } from '@shared/ct/altSchnittstelle';

export function altPort(verweigert: string): AltAnfragePort {
  return {
    anfrage: (func, felder) => ctAltAnfrage(func, felder, { verweigert }),
    status: (e) => (e instanceof ApiError ? e.status : null),
  };
}
