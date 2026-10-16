/**
 * **Für den Zauberstab „Wer kann?“ laden** (Bauplan E5-1): je Termin und Dienst einmal `possiblepersons`
 * (`ladeWerKann`, mit dessen Zwischenspeicher), **höchstens 4 gleichzeitig** (Bauplan E4, `mapLimit`), mit
 * Fortschritt und Abbrechen. Mehrere Plätze desselben Dienstes im Termin teilen sich eine Abfrage.
 *
 * Anders als die Hinweise vor dem Senden (`sendeHinweise.ts`) bricht hier **ein Fehler den Lauf ab**: Ohne die
 * Liste eines Dienstes gäbe es dort keinen Vorschlag, und das sähe aus wie „niemand passt“. Gespeichert wird beim
 * Laden nichts – ein Aussetzer kostet also nur ein „Nochmal“.
 */
import { mapLimit } from '@shared/ct/mapLimit';
import type { RohKandidat } from '@shared/dienstplan/werKann';
import { ladeWerKann } from './ladeWerKann';

/** Schlüssel einer Abfrage: `terminId|serviceId`. */
export const abfrageSchluessel = (terminId: number, serviceId: number): string =>
  `${terminId}|${serviceId}`;

/** Wirft `AbortError`, wenn abgebrochen wurde – vor jeder neuen Abfrage geprüft. */
function pruefeAbbruch(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
}

export async function ladeZauberstab(
  plaetze: readonly { terminId: number; serviceId: number }[],
  o: { signal?: AbortSignal; fortschritt?: (fertig: number, gesamt: number) => void } = {},
): Promise<Map<string, RohKandidat[]>> {
  const abfragen = [
    ...new Map(plaetze.map((p) => [abfrageSchluessel(p.terminId, p.serviceId), p])).values(),
  ];
  const ergebnis = new Map<string, RohKandidat[]>();
  let fertig = 0;
  // Der erste Fehler hält alle an – `mapLimit` allein ließe die übrigen Arbeiter weiter abfragen.
  let fehler: { grund: unknown } | null = null;
  o.fortschritt?.(0, abfragen.length);
  await mapLimit(abfragen, 4, async (p) => {
    if (fehler) return;
    try {
      pruefeAbbruch(o.signal);
      const roh = await ladeWerKann(p.terminId, p.serviceId);
      pruefeAbbruch(o.signal);
      ergebnis.set(abfrageSchluessel(p.terminId, p.serviceId), roh);
      o.fortschritt?.(++fertig, abfragen.length);
    } catch (e) {
      fehler ??= { grund: e };
    }
  });
  if (fehler) throw (fehler as { grund: unknown }).grund;
  return ergebnis;
}
