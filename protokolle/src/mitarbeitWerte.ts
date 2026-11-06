/**
 * **Werte in „Mitarbeit“ lesen und einzeln ändern** – gemeinsam für To-Dos (`aufgabenSchreiben.ts`) und Vorschläge
 * (`vorschlaegeSchreiben.ts`, S5-4). Beide liegen als eigene Werte in derselben Kategorie und werden an `art`
 * unterschieden; der Ablauf ist derselbe: frisch lesen, auf diesen Stand anwenden, schreiben, **nachlesen** (ein `201`
 * ist kein Beleg). Jeder Fehler wird geworfen. Gelöscht wird nie hart (S0).
 */
import { werteLesen, wertAendern, wertAnlegen } from '@shared/ct/modulDaten';
import { wertInhalt } from '@shared/protokolle/speicher';
import { modulPort } from '@ui/ct/modulPort';

/** Wo die Mitarbeit-Werte einer Gruppe liegen. */
export interface MitarbeitOrt {
  modul: number;
  /** Kategorie „Mitarbeit“ der Gruppe. */
  kategorie: number;
}

/** Alle Werte der Kategorie, einmal gelesen – roh, mit ihrer Wert-ID, aufsteigend. */
export async function mitarbeitRoh(ort: MitarbeitOrt): Promise<{ wert: number; x: unknown }[]> {
  return [...(await werteLesen(modulPort, ort.modul, ort.kategorie))]
    .sort((a, b) => a.id - b.id)
    .map((w) => ({ wert: w.id, x: wertInhalt(w) }));
}

/**
 * **Die Werte einer Art** aus einem gelesenen Stand. Trägt dieselbe ID zweimal (etwa nach einem abgebrochenen
 * Anlegen), gilt der Wert mit der kleinsten ID – wie bei Kategorien.
 */
export function derArt<T extends { id: string }>(
  roh: readonly { wert: number; x: unknown }[],
  ist: (x: unknown) => x is T,
): { wert: number; x: T }[] {
  const je = new Map<string, { wert: number; x: T }>();
  for (const r of roh) if (ist(r.x) && !je.has(r.x.id)) je.set(r.x.id, { wert: r.wert, x: r.x });
  return [...je.values()];
}

/** Stimmt der gelesene Stand mit dem geschriebenen überein? */
export const gleich = <T>(a: T | undefined, b: T): boolean =>
  !!a && JSON.stringify(a) === JSON.stringify(b);

/**
 * **Einen Wert ändern**: frisch lesen, `aendern` auf den aktuellen Stand anwenden, schreiben, nachlesen. Gibt es ihn
 * noch nicht, entsteht er aus `anlegen()` – wer `anlegen` werfen lässt, ändert nur Vorhandenes. Liefert den Stand.
 */
export async function wertNachgelesen<T extends { id: string }>(
  ort: MitarbeitOrt,
  ist: (x: unknown) => x is T,
  id: string,
  aendern: (x: T) => T,
  anlegen: () => T,
  texte: { verweigert: string; nichtUebernommen: string },
): Promise<T> {
  const da = derArt(await mitarbeitRoh(ort), ist).find((w) => w.x.id === id);
  const neu = aendern(da?.x ?? anlegen());
  if (da)
    await wertAendern(
      modulPort,
      ort.modul,
      ort.kategorie,
      da.wert,
      JSON.stringify(neu),
      texte.verweigert,
    );
  else
    await wertAnlegen(modulPort, ort.modul, ort.kategorie, JSON.stringify(neu), texte.verweigert);
  const nachgelesen = derArt(await mitarbeitRoh(ort), ist).find((w) => w.x.id === id)?.x;
  if (!gleich(nachgelesen, neu)) throw new Error(texte.nichtUebernommen);
  return neu;
}
