/**
 * **Der Browser-Anschluss des Tauschs** (`@shared/dienstplan/tausch`, Regeln und Messwerte dort) – mit der Sitzung der
 * Seite (`ctAnfrage`: CSRF, Bremse, Zeitgrenze). Fehler kommen als `ApiError` mit Status.
 */
import type { TauschPort } from '@shared/dienstplan/tausch';
import { ApiError } from '@ui/ct/fehler';
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';

const dienst = (ich: number, e: number, einteilung: number) =>
  `/persons/${ich}/events/${e}/services/${einteilung}/exchangerequests`;
const VERWEIGERT = 'ChurchTools erlaubt dir diesen Tausch nicht.';

/** Eine Liste – keine Liste ist ein Fehler, kein „nichts da“ (sonst sähe ein Aussetzer aus wie „keine Anfragen“). */
async function liste(pfad: string): Promise<unknown[]> {
  const l = await ctDaten<unknown>(pfad);
  if (!Array.isArray(l)) throw new ApiError(502, 'ChurchTools hat keine Liste geliefert.');
  return l as unknown[];
}

export const tauschPort: TauschPort = {
  einteilungen: (ich) => ctAlleSeiten<unknown>(`/persons/${ich}/servicerequests?only_future=true`),
  kandidaten: (ich, e, einteilung) => liste(`${dienst(ich, e, einteilung)}/candidates`),
  ausgang: (ich, e, einteilung) => liste(dienst(ich, e, einteilung)),
  eingang: (ich) => liste(`/persons/${ich}/exchangerequests`),
  anfragen: (ich, e, einteilung, ziel) =>
    ctAnfrage(dienst(ich, e, einteilung), {
      method: 'POST',
      body: JSON.stringify({ requestedServiceId: ziel }),
      verweigert: VERWEIGERT,
    }),
  async zurueckziehen(ich, e, einteilung, id) {
    await ctAnfrage(`${dienst(ich, e, einteilung)}/${id}`, {
      method: 'DELETE',
      verweigert: VERWEIGERT,
    });
  },
  annehmen: (ich, id) =>
    ctAnfrage(`/persons/${ich}/exchangerequests/${id}`, { method: 'PUT', verweigert: VERWEIGERT }),
  ablehnen: (ich, id) =>
    ctAnfrage(`/persons/${ich}/exchangerequests/${id}`, {
      method: 'DELETE',
      verweigert: VERWEIGERT,
    }),
};
