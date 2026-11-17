/**
 * **Eintragen per Klick in „Personen“** (Wunsch 5, Scheibe P2a, Entwurf `e9-p2-eintragen.html`): Was ein Klick in eine
 * Zelle (Person × Termin im Block eines Dienstes) tut und welche Warnung davor kommt. Nur Rechnen – die Oberfläche
 * (`dienstplaner/src/PersonenRaster.tsx`) zeigt es an, das Anlegen des Entwurfs macht dieselbe Funktion wie „Wer kann?“
 * (`useEinteilen`).
 *
 * Nichts davon ist eine neue Regel für Plätze oder Entwürfe: Welcher Platz frei ist, entscheidet `freiOhneEntwurf` (auch
 * der Zauberstab fragt sie), wer an einem Platz als Entwurf steht, die Matrix (`entwurf`), wer abwesend ist und in
 * welchem anderen Dienst am Tag, das Raster (`RasterZelle`).
 */
import { tagKurz, tagMonat } from '../ct/datum';
import type { Entwurf } from './entwuerfe';
import type { PlanPlatz } from './plan';
import type { RasterZelle } from './personenRaster';

/** Wie die Matrix einen Entwurf an einem Platz kennt (`Sicht.entwurf`, schon auf Spalte und Zeile festgelegt). */
export type PlatzEntwurf = (p: PlanPlatz) => { entwurf: Entwurf; veraltet: boolean } | null;

/**
 * **Ein freier Platz ohne Entwurf.** Liegt am Platz ein Entwurf – auch ein veralteter, sein Eintrag im Speicher bleibt –,
 * ist er nicht zu haben (der Zauberstab lässt ihn aus, „Personen“ legt dort nichts darüber).
 */
export const freiOhneEntwurf = (p: PlanPlatz, entwurf: { entwurf: Entwurf } | null): boolean =>
  p.art === 'frei' && entwurf === null;

/**
 * Was ein Klick in eine Zelle tut:
 * - `eintragen`: Entwurf auf den freien Platz `nr` (1-basiert, wie `freierPlatz`) dieses Dienstes an diesem Termin.
 * - `voll`: kein freier Platz mehr – alle `von` Plätze sind belegt oder haben einen Entwurf (P2c bringt „Platz
 *   dazunehmen“, bis dahin nur ein Hinweis).
 * - `wegnehmen`: der eigene Entwurf der Person in dieser Zelle – `nr`/`version` des Platzes, damit der Aufrufer ihn
 *   mit dem Versions-Schutz entfernen kann.
 * - `null`: nichts (bestehende Einteilung – kommt mit P2b –, Entwurf eines anderen Planers, Dienst nicht vorgesehen).
 */
export type ZellenAktion =
  | { art: 'eintragen'; nr: number }
  | { art: 'voll'; von: number }
  | { art: 'wegnehmen'; nr: number; entwurf: Entwurf }
  | null;

export function zellenAktion(o: {
  /** Die Plätze des Dienstes an diesem Termin – `null`: der Dienst ist dort nicht vorgesehen. */
  plaetze: readonly PlanPlatz[] | null;
  personId: number;
  /** `RasterZelle.zustand` dieser Zelle. */
  zustand: RasterZelle['zustand'];
  entwurf: PlatzEntwurf;
  /** Die eigene Person – nur eigene Entwürfe nimmt ein Klick weg. */
  ichId: number | null;
}): ZellenAktion {
  const { plaetze } = o;
  if (!plaetze) return null;
  if (o.zustand === 'entwurf') {
    for (const [i, p] of plaetze.entries()) {
      const a = o.entwurf(p);
      if (!a || a.veraltet) continue;
      const ziel = a.entwurf.ziel;
      if (ziel.art === 'person' && ziel.personId === o.personId) {
        return a.entwurf.von.personId === o.ichId
          ? { art: 'wegnehmen', nr: i + 1, entwurf: a.entwurf }
          : null;
      }
    }
    return null;
  }
  // Zugesagt und angefragt: ein Klick tut noch nichts (P2b).
  if (o.zustand !== null) return null;
  const nr = plaetze.findIndex((p) => freiOhneEntwurf(p, o.entwurf(p))) + 1;
  if (nr > 0) return { art: 'eintragen', nr };
  return { art: 'voll', von: plaetze.length };
}

/** „29.11.“ oder „28.11.–30.11.“ – der Zeitraum einer Abwesenheit. */
const zeitraumText = (von: string, bis: string) =>
  von === bis ? tagMonat(von) : `${tagMonat(von)}–${tagMonat(bis)}`;

/** „Daniel F. ist am Fr, 20.11. schon bei Gesang eingeteilt.“ – mehrere Dienste mit „und“. */
export function schonEingeteiltText(name: string, tag: string, dienste: readonly string[]): string {
  const liste =
    dienste.length > 1
      ? `${dienste.slice(0, -1).join(', ')} und ${dienste[dienste.length - 1]}`
      : (dienste[0] ?? '');
  return `${name} ist am ${tagKurz(tag)} schon bei ${liste} eingeteilt.`;
}

/** „Daniel F. ist am So, 29.11. abwesend: Urlaub (28.11.–30.11.).“ */
export function abwesendText(
  name: string,
  tag: string,
  a: { grund: string; von: string; bis: string },
): string {
  return `${name} ist am ${tagKurz(tag)} abwesend: ${a.grund} (${zeitraumText(a.von, a.bis)}).`;
}

/** „Ton am 27.11. ist voll (2 von 2).“ */
export const vollText = (dienst: string, tag: string, von: number): string =>
  `${dienst} am ${tagMonat(tag)} ist voll (${von} von ${von}).`;

export interface EintragenWarnung {
  /** Je ein Satz: „… schon bei … eingeteilt.“, „… abwesend: …“. */
  saetze: string[];
  /** Die Frage darunter – „Trotzdem für Ton eintragen?“ */
  frage: string;
}

/**
 * **Die Warnung vor dem Eintragen** – `null`, wo keine nötig ist. Zwei Gründe, beide in einem Fenster, wenn sie
 * zusammen zutreffen: die Person ist am selben Tag schon in einem anderen Dienst eingeteilt (`weitere`), oder sie ist an
 * dem Tag abwesend. „Dienst voll“ gehört nicht hierher – dort wird nicht eingetragen.
 */
export function eintragenWarnung(o: {
  name: string;
  /** Der Dienst, für den eingetragen wird. */
  dienst: string;
  tag: string;
  zelle: Pick<RasterZelle, 'weitere' | 'abwesend'>;
}): EintragenWarnung | null {
  const saetze: string[] = [];
  if (o.zelle.weitere.length > 0)
    saetze.push(
      schonEingeteiltText(
        o.name,
        o.tag,
        o.zelle.weitere.map((w) => w.dienst),
      ),
    );
  if (o.zelle.abwesend) saetze.push(abwesendText(o.name, o.tag, o.zelle.abwesend));
  return saetze.length > 0 ? { saetze, frage: `Trotzdem für ${o.dienst} eintragen?` } : null;
}
