/**
 * **Hinweise vor dem Senden** (E4-4-2, Alwin 15.10.: „Ja, prüfen“): Ist die Person an dem Tag abwesend oder schon
 * eingeteilt? Aus „Wer kann?“ (`possiblepersons`) mit derselben Regel wie im Fach (`kandidatHinweis`) – nicht
 * nachgebaut. Höchstens 4 Abfragen gleichzeitig (Bauplan E4, `mapLimit`); „Wer kann?“ merkt sich Antworten zwei Minuten.
 *
 * Scheitert eine Abfrage, steht dort `ungeprueft` (das Fach sagt „nicht geprüft“) – senden geht trotzdem,
 * denn ein Aussetzer darf das Senden nicht aufhalten.
 */
import { mapLimit } from '@shared/ct/mapLimit';
import { kandidatenAus, kandidatHinweis } from '@shared/dienstplan/werKann';
import { ortSchluessel, type Entwurf } from '@shared/dienstplan/entwuerfe';
import { ladeWerKann } from './ladeWerKann';

export type SendeHinweis = { text: string } | { ungeprueft: true } | null;

export async function ladeSendeHinweise(
  zeilen: readonly { entwurf: Entwurf; tag: string }[],
): Promise<Map<string, SendeHinweis>> {
  const hinweise = new Map<string, SendeHinweis>();
  // Ein Fehler bleibt bei seiner Zeile – die anderen laufen weiter (deshalb hier gefangen, nicht in `mapLimit`).
  await mapLimit(
    zeilen.filter((z) => z.entwurf.ziel.art === 'person'),
    4,
    async (z) => {
      const k = ortSchluessel(z.entwurf.ort);
      let roh;
      try {
        roh = await ladeWerKann(z.entwurf.ort.eventId, z.entwurf.ort.serviceId);
      } catch {
        hinweise.set(k, { ungeprueft: true });
        return;
      }
      const ziel = z.entwurf.ziel;
      const kandidat = kandidatenAus(roh, { monat: z.tag.slice(0, 7), schonDa: new Set() }).find(
        (c) => ziel.art === 'person' && c.personId === ziel.personId,
      );
      const h = kandidat ? kandidatHinweis(kandidat) : null;
      hinweise.set(k, h?.warnung ? { text: h.text } : null);
    },
  );
  return hinweise;
}
