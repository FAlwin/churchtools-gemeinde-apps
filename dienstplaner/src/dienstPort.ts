/**
 * **Der Browser-Anschluss des Schreibkerns** (`@shared/dienstplan/einteilen`, Regeln dort): einen Termin frisch
 * lesen, einen Platz schreiben – mit der Sitzung der Seite (`ctAnfrage`: CSRF, Bremse, Zeitgrenze).
 *
 * Fehler kommen als Status: 401 = abgemeldet (ein fehlendes Recht macht `fehlerAus` zu `KeinSpeicherRecht`, 403),
 * 404 = Termin weg, 429/5xx/Zeitüberschreitung = vorübergehend. Ein Netzfehler hat keinen Status (`null`) – auch
 * das ist vorübergehend.
 */
import type { DienstPort } from '@shared/dienstplan/einteilen';
import type { RohTermin } from '@shared/dienstplan/termine';
import { ApiError } from '@ui/ct/fehler';
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';

const VERWEIGERT =
  'ChurchTools erlaubt dir nicht, hier einzuteilen. Einteilen darf, wer die Dienstgruppe bearbeiten darf, die ' +
  'Gruppe des Dienstes leitet oder Admin des Termins ist.';

export const dienstPort: DienstPort = {
  async termin(eventId) {
    const t = await ctDaten<RohTermin | null>(`/events/${eventId}?include=eventServices`);
    // Ohne Platzliste wüsste der Schreibkern nur „Platz weg“ – das wäre geraten. Also: nicht geliefert
    // (vorübergehend). `ctDaten` gibt bei `{ data: null }` den ganzen Rumpf zurück, daher die Liste prüfen.
    if (!t || typeof t !== 'object' || !Array.isArray(t.eventServices))
      throw new ApiError(502, 'ChurchTools hat den Termin nicht geliefert.');
    return t;
  },
  async schreibe(pfad, auftrag) {
    await ctAnfrage(pfad, {
      method: auftrag.method,
      body: JSON.stringify(auftrag.json),
      verweigert: VERWEIGERT,
    });
  },
  status: (e) => (e instanceof ApiError ? e.status : null),
};
