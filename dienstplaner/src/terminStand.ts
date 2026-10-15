/**
 * **Gibt es den Termin noch, und wann war er?** (Entwürfe ohne Platz, #582) Für Entwürfe, deren Termin nicht im
 * geladenen Zeitraum liegt: einmal bei ChurchTools nachfragen, höchstens 4 gleichzeitig (`mapLimit`).
 *
 * Gemessen (15.10.2026): Einen Termin, den es nicht gibt, beantwortet ChurchTools mit **404**. Alles andere, was
 * scheitert (Netz, 5xx, abgemeldet), heißt „unbekannt“ – dann wird nichts als alt gemeldet (vorübergehend ist
 * nicht gelöscht).
 */
import { mapLimit } from '@shared/ct/mapLimit';
import { tagAusIso } from '@shared/ct/zeit';
import { ApiError } from '@ui/ct/fehler';
import { ctDaten } from '@ui/ct/verbindung';

export type TerminStand =
  | { art: 'weg' }
  | { art: 'da'; name: string; tag: string }
  | { art: 'unbekannt' };

export async function ladeTerminStaende(
  ids: readonly number[],
  zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Promise<Map<number, TerminStand>> {
  const staende = new Map<number, TerminStand>();
  await mapLimit([...new Set(ids)], 4, async (id) => {
    try {
      const t = await ctDaten<{ name?: unknown; startDate?: unknown } | null>(`/events/${id}`);
      staende.set(
        id,
        t && typeof t.startDate === 'string'
          ? {
              art: 'da',
              name: typeof t.name === 'string' ? t.name : '',
              tag: tagAusIso(t.startDate, zeitzone),
            }
          : { art: 'unbekannt' },
      );
    } catch (e) {
      staende.set(
        id,
        e instanceof ApiError && e.status === 404 ? { art: 'weg' } : { art: 'unbekannt' },
      );
    }
  });
  return staende;
}
