/**
 * **Der Browser-Anschluss der eigenen Abwesenheiten** (`@shared/absences/abwesenheiten`, Regeln und Messwerte dort) –
 * für alle Erweiterungen: Dienstplaner (E7-2) und Musik-App. Geschrieben wird mit der Sitzung der Seite (`ctAnfrage`:
 * CSRF, Bremse, Zeitgrenze); Fehler kommen als `ApiError` mit Status (401 abgemeldet, 429/5xx vorübergehend).
 */
import type { AbwesenheitPort } from '@shared/absences/abwesenheiten';
import type { CtAbsence } from '@shared/ct/typen';
import { ApiError } from './fehler';
import { ctAnfrage, ctDaten } from './verbindung';

const pfad = (personId: number) => `/persons/${personId}/absences`;
const VERWEIGERT = 'ChurchTools erlaubt dir nicht, hier Abwesenheiten zu ändern.';

export const abwesenheitPort: AbwesenheitPort = {
  async liste(personId, von, bis) {
    const q = new URLSearchParams({ from: von, to: bis, limit: '500' });
    const liste = await ctDaten<unknown>(`${pfad(personId)}?${q.toString()}`);
    // Keine Liste ist kein „nichts eingetragen“ – sonst sähe ein Aussetzer aus wie ein leerer Kalender.
    if (!Array.isArray(liste)) throw new ApiError(502, 'Abwesenheiten kamen nicht als Liste.');
    return liste as CtAbsence[];
  },
  async einer(personId, id) {
    try {
      const a = await ctDaten<CtAbsence | null>(`${pfad(personId)}/${id}`);
      if (!a || typeof a !== 'object' || typeof a.id !== 'number')
        throw new ApiError(502, 'Die Abwesenheit kam nicht lesbar zurück.');
      return a;
    } catch (e) {
      // Nur „gibt es nicht“ ist `null` – jeder andere Fehler (Netz, 5xx) wirft weiter, sonst sähe ein Aussetzer
      // beim Nachlesen aus wie „gelöscht“.
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  anlegen: (personId, rumpf) =>
    ctAnfrage(pfad(personId), {
      method: 'POST',
      body: JSON.stringify(rumpf),
      verweigert: VERWEIGERT,
    }),
  ersetzen: (personId, id, rumpf) =>
    ctAnfrage(`${pfad(personId)}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rumpf),
      verweigert: VERWEIGERT,
    }),
  async loeschen(personId, id) {
    await ctAnfrage(`${pfad(personId)}/${id}`, { method: 'DELETE', verweigert: VERWEIGERT });
  },
  stammdaten: () => ctDaten<unknown>('/event/masterdata'),
};
