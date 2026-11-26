/**
 * **Den Erinnerungsplan bearbeiten – die Rechenregeln** (Bauplan R-4, 25.11.2026): Liste der Erinnerungen, Hinzufügen,
 * Entfernen, Ändern, „Was hat sich geändert?“ und „wie Standard?“, dazu die kleine Vorschau. Nur Rechnen und Texte – gelesen und
 * gespeichert wird in `abfragenSpeicher.ts`, die Oberfläche steht in `dienstplaner/src/ErinnerungsplanAbschnitt.tsx`.
 *
 * **Feste Reihenfolge** (`ordne`): beim Öffnen, dann „n Tage vor der Frist“ (größtes n zuerst), am Tag der Frist, nach der
 * Frist. Nur so ist „entfernen und wieder hinzufügen“ gleich dem Standard (kein unnötiges Schreiben) und die Liste liest sich
 * wie ein Zeitstrahl.
 *
 * **`plan: null` heißt Standard.** `planFuerSpeicher` liefert `null`, wenn Punkte UND Mail dem Standard entsprechen – so wirkt
 * eine spätere Änderung des Standards weiter. Ein leerer Betreff oder Text gilt als „Standard“ (das Schema verlangt Text).
 *
 * **Nichts nachgebaut:** Welche Tage erinnert wird, rechnet allein `erinnerungsTage` (`abfragen.ts`).
 */
import { plusTage, tagKurz } from '../ct/datum';
import {
  erinnerungsTage,
  GRENZEN,
  STANDARD_PLAN,
  geltenderPlan,
  type Abfrage,
  type AbfragenInhalt,
  type Erinnerungspunkt,
  type Erinnerungsplan,
} from './abfragen';
import { istStandardText, STANDARD_BETREFF, standardText } from './abfrageMail';
import type { VerfuegbarkeitArt } from './abfragen';

/** Was im Fenster bearbeitet wird: die Punkte und die beiden Mail-Felder (immer gefüllt, sonst die Standardtexte). */
export interface PlanEntwurf {
  punkte: Erinnerungspunkt[];
  betreff: string;
  text: string;
}

export type Punktart = Erinnerungspunkt['art'];

const RANG: Record<Punktart, number> = { oeffnen: 0, vorFrist: 1, frist: 2, nachFrist: 3 };

/** Die Punkte in der festen Reihenfolge (neue Liste, Eingabe bleibt unberührt). */
export function ordne(punkte: readonly Erinnerungspunkt[]): Erinnerungspunkt[] {
  return [...punkte].sort((a, b) => {
    if (a.art !== b.art) return RANG[a.art] - RANG[b.art];
    return a.art === 'vorFrist' && b.art === 'vorFrist' ? b.tage - a.tage : 0;
  });
}

const punktGleich = (a: Erinnerungspunkt, b: Erinnerungspunkt): boolean => {
  if (a.art !== b.art) return false;
  if (a.art === 'vorFrist' && b.art === 'vorFrist') return a.tage === b.tage;
  if (a.art === 'nachFrist' && b.art === 'nachFrist')
    return a.alleTage === b.alleTage && a.hoechstens === b.hoechstens;
  return true;
};

/**
 * Der Entwurf zu einem Plan; ohne eigene Mail stehen die Standardtexte **der Art** da (`standardText`). Ein gespeicherter Text,
 * der wörtlich ein Standardtext ist, zeigt ebenfalls den der Art (`istStandardText`).
 */
export function entwurfAus(plan: Erinnerungsplan, art: VerfuegbarkeitArt): PlanEntwurf {
  const text = plan.mail?.text;
  return {
    punkte: ordne(plan.punkte),
    betreff: plan.mail?.betreff ?? STANDARD_BETREFF,
    text: text === undefined || istStandardText(text) ? standardText(art) : text,
  };
}

/** Der Entwurf eines Dokuments: der geltende Plan (eigener oder Standard) mit den Texten der Art. */
export const entwurfVon = (
  inhalt: Pick<AbfragenInhalt, 'plan'>,
  art: VerfuegbarkeitArt,
): PlanEntwurf => entwurfAus(geltenderPlan(inhalt), art);

/** Leer = Standard, sonst getrimmt (so liest es auch das Schema). */
const feld = (s: string, standard: string): string => s.trim() || standard;

/**
 * Der Plan, der gelten würde – immer mit ausgeschriebener Mail. Für Vorschau und Vergleich. Ein Standardtext gleich welcher Art
 * wird zum Standardtext von `art` – so ist nach dem Umstellen der Art „nie angefasst“ weiter der Standard, kein eigener Text.
 */
export function wirksamerPlan(e: PlanEntwurf, art: VerfuegbarkeitArt): Erinnerungsplan {
  return {
    punkte: ordne(e.punkte),
    mail: {
      betreff: feld(e.betreff, STANDARD_BETREFF),
      text: istStandardText(e.text) ? standardText(art) : e.text.trim(),
    },
  };
}

/** Sind zwei Entwürfe in dem gleich, was gelten würde (bei dieser Art)? */
export function entwuerfeGleich(a: PlanEntwurf, b: PlanEntwurf, art: VerfuegbarkeitArt): boolean {
  const x = wirksamerPlan(a, art);
  const y = wirksamerPlan(b, art);
  return (
    x.punkte.length === y.punkte.length &&
    x.punkte.every((p, i) => punktGleich(p, y.punkte[i])) &&
    x.mail?.betreff === y.mail?.betreff &&
    x.mail?.text === y.mail?.text
  );
}

/** Der Entwurf weicht vom gelesenen Stand ab (bei dieser Art – ein Wechsel der Art allein ändert den Plan nicht). */
export const entwurfGeaendert = (
  e: PlanEntwurf,
  inhalt: Pick<AbfragenInhalt, 'plan'>,
  art: VerfuegbarkeitArt,
): boolean => !entwuerfeGleich(e, entwurfVon(inhalt, art), art);

/** Ist die Mail des Entwurfs der Standard (Betreff und Text, Text gleich welcher Art)? */
export const mailIstStandard = (e: Pick<PlanEntwurf, 'betreff' | 'text'>): boolean =>
  feld(e.betreff, STANDARD_BETREFF) === STANDARD_BETREFF && istStandardText(e.text);

/**
 * Was in `abfragen.plan` gespeichert wird: `null`, wenn alles dem Standard entspricht. Eine Standard-Mail wird nie
 * ausgeschrieben gespeichert (`mail: null`) – so bekommt sie `mailFuer` immer in der Art, die gerade gilt.
 */
export function planFuerSpeicher(e: PlanEntwurf, art: VerfuegbarkeitArt): Erinnerungsplan | null {
  const w = wirksamerPlan(e, art);
  const mailStandard = mailIstStandard(e);
  const standardPunkte =
    w.punkte.length === STANDARD_PLAN.punkte.length &&
    w.punkte.every((p, i) => punktGleich(p, ordne(STANDARD_PLAN.punkte)[i]));
  if (mailStandard && standardPunkte) return null;
  return { punkte: w.punkte, mail: mailStandard ? null : w.mail };
}

// ── Liste bearbeiten ────────────────────────────────────────────────────────

export const ART_NAMEN: Record<Punktart, string> = {
  oeffnen: 'Beim Öffnen der Abfrage',
  vorFrist: 'Tage vor der Frist',
  frist: 'Am Tag der Frist',
  nachFrist: 'Nach der Frist',
};

/** Die Tage, die „n Tage vor der Frist“ schon benutzt – ohne den Punkt an Stelle `ausser`. */
export function belegteVorFristTage(
  punkte: readonly Erinnerungspunkt[],
  ausser?: number,
): number[] {
  return punkte.flatMap((p, i) => (p.art === 'vorFrist' && i !== ausser ? [p.tage] : []));
}

const VORSCHLAG_TAGE = [2, 3, 5, 7, 14, 1, 4, 6];

/** Der erste noch freie Wert für „n Tage vor der Frist“ (2, 3, 5, 7 …), `null`, wenn alle von 1 bis 60 belegt sind. */
function freierVorFristTag(punkte: readonly Erinnerungspunkt[]): number | null {
  const belegt = new Set(belegteVorFristTage(punkte));
  const alle = [
    ...VORSCHLAG_TAGE,
    ...Array.from({ length: GRENZEN.tage.max }, (_, i) => i + GRENZEN.tage.min),
  ];
  return alle.find((n) => n >= GRENZEN.tage.min && n <= GRENZEN.tage.max && !belegt.has(n)) ?? null;
}

/** Welche Arten man noch hinzufügen kann: `oeffnen`, `frist`, `nachFrist` je höchstens einmal, `vorFrist` mehrfach. */
export function artenZumHinzufuegen(punkte: readonly Erinnerungspunkt[]): Punktart[] {
  if (punkte.length >= GRENZEN.punkte) return [];
  const da = new Set(punkte.map((p) => p.art));
  return (['oeffnen', 'vorFrist', 'frist', 'nachFrist'] as const).filter((art) =>
    art === 'vorFrist' ? freierVorFristTag(punkte) !== null : !da.has(art),
  );
}

/** Die Punkte mit einem neuen der Art `art` (geordnet); unverändert, wenn die Art nicht (mehr) geht. */
export function mitNeuemPunkt(
  punkte: readonly Erinnerungspunkt[],
  art: Punktart,
): Erinnerungspunkt[] {
  if (!artenZumHinzufuegen(punkte).includes(art)) return [...punkte];
  switch (art) {
    case 'oeffnen':
      return ordne([...punkte, { art }]);
    case 'frist':
      return ordne([...punkte, { art }]);
    case 'vorFrist':
      return ordne([...punkte, { art, tage: freierVorFristTag(punkte) as number }]);
    case 'nachFrist':
      return ordne([...punkte, { art, alleTage: 1, hoechstens: 3 }]);
  }
}

/** Ohne den Punkt an Stelle `i`. */
export const ohnePunkt = (punkte: readonly Erinnerungspunkt[], i: number): Erinnerungspunkt[] =>
  punkte.filter((_, j) => j !== i);

const imBereich = (n: number, g: { min: number; max: number }) =>
  Number.isInteger(n) && n >= g.min && n <= g.max;

/**
 * Der Punkt an Stelle `i` durch `neu` ersetzt (geordnet). Unverändert, wenn der neue Wert außerhalb von `GRENZEN` liegt oder
 * ein anderer Punkt „n Tage vor der Frist“ schon denselben Wert hat.
 */
export function mitGeaendertemPunkt(
  punkte: readonly Erinnerungspunkt[],
  i: number,
  neu: Erinnerungspunkt,
): Erinnerungspunkt[] {
  const ok =
    neu.art === 'vorFrist'
      ? imBereich(neu.tage, GRENZEN.tage) && !belegteVorFristTage(punkte, i).includes(neu.tage)
      : neu.art === 'nachFrist'
        ? imBereich(neu.alleTage, GRENZEN.tage) && imBereich(neu.hoechstens, GRENZEN.hoechstens)
        : true;
  if (!ok) return [...punkte];
  return ordne(punkte.map((p, j) => (j === i ? neu : p)));
}

// ── Vorschau ────────────────────────────────────────────────────────────────

/**
 * **„Beispiel: Frist Di, 05.01., Zeitraum ab Mo, 01.02. → Erinnerungen am …“** – die Tage kommen aus `erinnerungsTage`.
 * Ohne laufende Abfrage eine Beispiel-Abfrage: Frist in 14 Tagen, Zeitraum 28 Tage danach, Öffnen heute. Läuft eine Abfrage
 * der Gruppe, rechnet die Vorschau mit deren echten Tagen (und dem bearbeiteten, noch ungespeicherten Plan).
 */
export function vorschau(
  plan: Erinnerungsplan,
  laufend: Abfrage | null,
  heute: string,
): { echt: boolean; kopf: string; tage: string[] } {
  const frist = plusTage(heute, 14);
  const von = plusTage(frist, 28);
  const abfrage: Abfrage = laufend ?? {
    id: 'vorschau',
    von,
    bis: plusTage(von, 30),
    frist,
    oeffnen: heute,
    termine: [],
    gestartet: { personId: 1, name: '', zeit: '' },
    beendet: null,
  };
  return {
    echt: laufend !== null,
    kopf: `${laufend ? 'Läuft gerade' : 'Beispiel'}: Frist ${tagKurz(abfrage.frist)}, Zeitraum ab ${tagKurz(abfrage.von)}`,
    tage: erinnerungsTage(plan, abfrage, heute),
  };
}
