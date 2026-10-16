/**
 * **„Wer kann?“ laden** (Bauplan E4-2): `GET /events/{e}/services/{dienst}/possiblepersons`, erst beim
 * Öffnen eines Platzes – nie vorab für die ganze Matrix (E0 §5: ein Termin mit allen Diensten 2,6 s / 0,5 MB
 * live). Kurz gemerkt (`ttlMemo`), damit Auf- und Zuklappen nicht jedes Mal lädt; ein Fehlschlag wird nicht
 * gemerkt (vorübergehend ist nicht ungültig). Die Regeln stehen in `shared/dienstplan/werKann.ts`.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { createTtlMemo } from '@shared/ct/ttlMemo';
import type { RohKandidat } from '@shared/dienstplan/werKann';

/** Wie lange „Wer kann?“ gemerkt wird – kurz, weil sich Einteilungen ständig ändern. */
export const WER_KANN_MS = 2 * 60_000;

const memo = createTtlMemo<RohKandidat[]>(WER_KANN_MS);

/** **Wirft**, wenn ChurchTools keine Liste liefert – eine leere Liste hieße „niemand kann“. */
export async function ladeWerKann(eventId: number, serviceId: number): Promise<RohKandidat[]> {
  const schluessel = `${eventId}|${serviceId}`;
  const gemerkt = memo.get(schluessel);
  if (gemerkt) return gemerkt;
  const roh = await ctDaten<unknown>(`/events/${eventId}/services/${serviceId}/possiblepersons`);
  if (!Array.isArray(roh)) {
    throw new ApiError(502, 'ChurchTools hat die Liste „Wer kann?“ nicht geliefert.');
  }
  memo.set(schluessel, roh as RohKandidat[]);
  return roh as RohKandidat[];
}

/**
 * „Wer kann?“ für diesen Termin und Dienst vergessen – nach dem Ändern einer Vorliebe (E5-3) rechnet ChurchTools neue
 * Punkte, die gemerkte Liste wäre dann veraltet.
 */
export function vergissWerKann(eventId: number, serviceId: number): void {
  memo.delete(`${eventId}|${serviceId}`);
}

/** Nur für Tests. */
export function _vergissWerKann(): void {
  memo.clear();
}
