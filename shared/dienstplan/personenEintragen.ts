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
import type { RasterGast, RasterZelle } from './personenRaster';

/** Wie die Matrix einen Entwurf an einem Platz kennt (`Sicht.entwurf`, schon auf Spalte und Zeile festgelegt). */
export type PlatzEntwurf = (p: PlanPlatz) => { entwurf: Entwurf; veraltet: boolean } | null;

/**
 * **Ein freier Platz ohne Entwurf.** Liegt am Platz ein Entwurf – auch ein veralteter, sein Eintrag im Speicher bleibt –,
 * ist er nicht zu haben (der Zauberstab lässt ihn aus, „Personen“ legt dort nichts darüber).
 */
export const freiOhneEntwurf = (p: PlanPlatz, entwurf: { entwurf: Entwurf } | null): boolean =>
  p.art === 'frei' && entwurf === null;

/**
 * **Welcher Platz ist für einen neuen Entwurf zu haben?** (P2a-2, Alwin 16.11.2026: „Platz übernehmen“) Zuerst ein wirklich
 * freier Platz ohne Entwurf (`freiOhneEntwurf`). Gibt es keinen, ein Platz mit **gültigem „Zurückziehen“-Entwurf** (Ziel
 * `frei`, belegt mit X): Der Eintrag ersetzt dann den Entwurf – aus „X zurückziehen“ wird „X durch Y ersetzen“, wie
 * „Andere Person wählen“ in der Matrix (mit der Version des Entwurfs als Versions-Schutz). Ein veralteter Entwurf zählt
 * nicht. `null`: nichts zu haben (voll).
 *
 * Der **Zauberstab** nimmt bewusst weiter nur `freiOhneEntwurf`: Er speichert ohne Versions-Schutz (`erwartet: null`), und
 * ein „Zurückziehen“ hat der Planer absichtlich gesetzt – das überschreibt man nicht automatisch.
 */
export function platzFuerEintrag(
  plaetze: readonly PlanPlatz[],
  entwurf: PlatzEntwurf,
): { nr: number; ersetzt: Entwurf | null } | null {
  const frei = plaetze.findIndex((p) => freiOhneEntwurf(p, entwurf(p)));
  if (frei >= 0) return { nr: frei + 1, ersetzt: null };
  for (const [i, p] of plaetze.entries()) {
    const a = entwurf(p);
    if (a && !a.veraltet && a.entwurf.ziel.art === 'frei') return { nr: i + 1, ersetzt: a.entwurf };
  }
  return null;
}

/**
 * Was ein Klick in eine Zelle tut:
 * - `eintragen`: Entwurf auf den Platz `nr` (1-basiert, wie `freierPlatz`) dieses Dienstes an diesem Termin – ein freier
 *   Platz oder (`ersetzt`: die Version des Entwurfs) ein Platz, dessen „Zurückziehen“-Entwurf damit ersetzt wird.
 * - `voll`: kein Platz mehr zu haben – alle `von` Plätze sind belegt oder haben einen Entwurf, der nicht „Zurückziehen“
 *   ist (P2c bringt „Platz dazunehmen“, bis dahin nur ein Hinweis).
 * - `direkt` / `wegnehmen`: der eigene Entwurf der Person in dieser Zelle (P2m, Klick-Zyklus **Anfrage → direkt → weg**):
 *   ist er noch eine Anfrage, stellt der Klick ihn auf „direkt“ um (`direkt`), ist er schon direkt, nimmt er ihn weg
 *   (`wegnehmen`). `nr`/`entwurf`: der Platz und der Entwurf mit seiner Version, damit der Aufrufer mit dem
 *   Versions-Schutz arbeiten kann.
 * - `belegt` / `entwurfFach` (P2b): eine **bestehende Einteilung** (zugesagt, angefragt, Gast) bzw. eine, die ein Entwurf
 *   wegnimmt (rot durchgestrichen): der Klick öffnet **dasselbe Fenster wie in der Matrix** – das Fenster „zurückziehen
 *   oder ersetzen“ (`onBelegt`) bzw. das Entwurfs-Fenster (`onEntwurf`). `nr`: der Platz, 1-basiert. Das Recht dafür
 *   prüft der Aufrufer wie die Matrix (`darfPlanen`, für das Entwurfs-Fenster zusätzlich `darfAendern`).
 * - `null`: nichts (Entwurf eines anderen Planers, Dienst nicht vorgesehen, Entwurf am Platz veraltet).
 */
export type ZellenAktion =
  | { art: 'eintragen'; nr: number; ersetzt?: number }
  | { art: 'voll'; von: number }
  | { art: 'wegnehmen'; nr: number; entwurf: Entwurf }
  | { art: 'direkt'; nr: number; entwurf: Entwurf }
  | { art: 'belegt'; nr: number }
  | { art: 'entwurfFach'; nr: number }
  | null;

/** Die Plätze, an denen die Person in ChurchTools steht (zugesagt oder angefragt, Name sichtbar) – 1-basiert. */
const plaetzeDerPerson = (plaetze: readonly PlanPlatz[], personId: number) =>
  plaetze.flatMap((p, i) =>
    p.art !== 'frei' && !p.verborgen && p.personId === personId ? [{ nr: i + 1, p }] : [],
  );

/** Was ein Klick auf einen Gast tut – dieselbe Regel wie für Personen, der Platz steht schon im Raster. */
export const gastAktion = (g: Pick<RasterGast, 'nr' | 'klick'>): ZellenAktion =>
  g.klick === 'belegt'
    ? { art: 'belegt', nr: g.nr }
    : g.klick === 'entwurf'
      ? { art: 'entwurfFach', nr: g.nr }
      : null;

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
        if (a.entwurf.von.personId !== o.ichId) return null;
        return {
          art: a.entwurf.modus === 'anfrage' ? 'direkt' : 'wegnehmen',
          nr: i + 1,
          entwurf: a.entwurf,
        };
      }
    }
    return null;
  }
  // Wird sie weggenommen (rot durchgestrichen): der Klick öffnet den Entwurf, der es tut – wie in der Matrix.
  if (o.zustand === 'zurueck') {
    for (const { nr, p } of plaetzeDerPerson(plaetze, o.personId)) {
      const a = o.entwurf(p);
      if (a && !a.veraltet) return { art: 'entwurfFach', nr };
    }
    return null;
  }
  // Zugesagt und angefragt: der erste Platz der Person ohne Entwurf – dort öffnet sich dasselbe Fenster wie beim
  // Antippen eines belegten Platzes in der Matrix (die dort nur Plätze OHNE Entwurf zum Knopf macht; ein veralteter
  // Entwurf zählt auch, dort gilt ChurchTools und es gibt nur das Schild).
  if (o.zustand === 'zugesagt' || o.zustand === 'angefragt') {
    const platz = plaetzeDerPerson(plaetze, o.personId).find(({ p }) => o.entwurf(p) === null);
    return platz ? { art: 'belegt', nr: platz.nr } : null;
  }
  if (o.zustand !== null) return null;
  const platz = platzFuerEintrag(plaetze, o.entwurf);
  if (platz)
    return platz.ersetzt
      ? { art: 'eintragen', nr: platz.nr, ersetzt: platz.ersetzt.version }
      : { art: 'eintragen', nr: platz.nr };
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
