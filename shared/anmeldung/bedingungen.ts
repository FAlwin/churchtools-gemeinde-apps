/**
 * **Bedingungen im Formular** (Etappe F1a, Entwurf `f1-bedingungen-nachweise-v1`, Alwin 11.11.2026) – eine Frage nur
 * zeigen, wenn …; eine einzelne Antwort nur wählbar, wenn …. Die EINE Stelle für diese Regeln: das öffentliche
 * Formular, die Pflichtprüfung (`pruefeAntworten`), die Anmeldung von Hand, die Vorschau (über
 * `ui/anmeldeformular/useBedingungen.ts`) und das Absenden (`anmeldungAufbauen`, `buchungAus`) lesen hier.
 *
 * - Wie bei Tally: beliebig viele Bedingungen je Frage, „eine reicht“ oder „alle müssen“.
 * - Als Quelle gehen nur Fragen **davor** – so entstehen keine Kreise. Eine Frage je Person darf zusätzlich auf jede
 *   Kontakt-Frage schauen, eine Kontakt-Frage nie auf eine Frage je Person (Klick-Runde 4).
 * - Ist die Quelle selbst ausgeblendet, gilt ihre Bedingung als nicht erfüllt.
 * - Pflicht gilt nur, solange die Frage zu sehen ist. Beim Absenden wird Ausgeblendetes geleert (`leeren`), sonst
 *   stünde in ChurchTools eine Antwort, die die Person zuletzt nicht mehr gesehen hat.
 * - Eine Antwort mit Bedingung wird ausgegraut (mit Hinweis) oder ausgeblendet. Wird eine schon gewählte Antwort
 *   ungültig, löst das Formular die Wahl und sagt warum (`ungueltigeAntworten`).
 *
 * Nur `import type` aus `formular.ts` – `formular.ts` braucht diese Datei zur Laufzeit (Pflichtprüfung, Schema).
 */
import { z } from 'zod';
import type { Antwort, Antworten, Feld, Formular } from './formular';

/** Höchstlänge einer Antwort – dieselbe für die Antworten selbst, ausgeblendete und Bedingungen (`formular.ts`). */
export const ANTWORT_MAX = 80;
/** Höchstlänge des freiwilligen Kurznamens einer Frage (Klick-Runde 4). */
export const KURZ_MAX = 40;

export type Vergleich = 'ist' | 'istNicht' | 'enthaelt' | 'enthaeltNicht' | 'ausgefuellt' | 'leer';

export interface Regel {
  /** `id` der Quell-Frage. */
  feld: string;
  op: Vergleich;
  /** Die Antwort bei `ist`, `istNicht`, `enthaelt`, `enthaeltNicht`. */
  wert?: string;
}

export interface Bedingung {
  /** `eine` = eine Regel reicht, `alle` = alle müssen zutreffen. */
  modus: 'eine' | 'alle';
  regeln: Regel[];
}

/** Bedingung an einer einzelnen Antwort: sonst ausgrauen (mit Hinweis) oder ausblenden (Alwin, 11.11.2026). */
export interface AntwortBedingung extends Bedingung {
  art: 'grau' | 'weg';
  /** Hinweis neben der ausgegrauten Antwort, z. B. „nur für Getaufte“. */
  grund?: string;
}

const VERGLEICHE = ['ist', 'istNicht', 'enthaelt', 'enthaeltNicht', 'ausgefuellt', 'leer'] as const;
const regelSchema = z.object({
  feld: z.string().min(1).max(20),
  op: z.enum(VERGLEICHE),
  wert: z.string().max(ANTWORT_MAX).optional(),
});
export const bedingungSchema = z.object({
  modus: z.enum(['eine', 'alle']),
  regeln: z.array(regelSchema).min(1).max(10),
});
export const antwortBedingungSchema = bedingungSchema.extend({
  art: z.enum(['grau', 'weg']),
  grund: z.string().max(KURZ_MAX).optional(),
});

/** Antwortmöglichkeiten einer Auswahlfrage – bei „Ja / Nein“ fest. Die EINE Stelle dafür. */
export const JA_NEIN = ['Ja', 'Nein'];
export function wahlAntworten(x: Feld): string[] {
  return x.typ === 'janein' ? JA_NEIN : x.antworten;
}

/** Fragen mit Antwortmöglichkeiten – nur sie können einzelne Antworten an Bedingungen knüpfen. */
const MIT_WAHL = new Set<Feld['typ']>(['janein', 'radio', 'select', 'multi']);
/** Was als Quelle einer Bedingung taugt (nicht: Text-Bausteine, Name, Unterschrift …). */
const QUELLE = new Set<Feld['typ']>([
  'janein',
  'radio',
  'select',
  'multi',
  'check',
  'text',
  'textarea',
  'number',
  'date',
  'tel',
  'email',
]);

/** Welche Vergleiche eine Quelle kennt – auch für das Fenster im Baukasten (F1c). */
export function vergleicheFuer(q: Feld): Vergleich[] {
  if (q.typ === 'multi') return ['enthaelt', 'enthaeltNicht', 'ausgefuellt', 'leer'];
  if (MIT_WAHL.has(q.typ)) return ['ist', 'istNicht', 'ausgefuellt', 'leer'];
  return ['ausgefuellt', 'leer'];
}
const mitWert = (op: Vergleich) => op !== 'ausgefuellt' && op !== 'leer';

/** **Kurzname** einer Frage – der eigene, sonst die Frage gekürzt (Regel-Liste, Bedingungs-Fenster). */
export function kurzname(x: Feld, max = 45): string {
  const k = x.kurz?.trim();
  if (k) return k;
  const t = x.frage.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Wo ein Feld steht: Teil und Stelle. */
function ortVon(f: Formular, id: string): { teil: 'anmeldung' | 'person'; i: number } | null {
  const a = f.anmeldung.findIndex((x) => x.id === id);
  if (a >= 0) return { teil: 'anmeldung', i: a };
  const p = f.person.findIndex((x) => x.id === id);
  return p >= 0 ? { teil: 'person', i: p } : null;
}

/** Darf `ziel` auf `quelle` schauen? Davor im selben Teil – oder jede Kontakt-Frage für eine Frage je Person. */
export function quelleErlaubt(f: Formular, ziel: Feld, quelle: Feld): boolean {
  const z = ortVon(f, ziel.id);
  const q = ortVon(f, quelle.id);
  // Ausgeschaltete Felder werden nicht gefragt – eine Bedingung darauf könnte nie zutreffen.
  if (!z || !q || !QUELLE.has(quelle.typ) || quelle.zustand === 'aus') return false;
  if (q.teil === z.teil) return q.i < z.i;
  return z.teil === 'person' && q.teil === 'anmeldung';
}

/** Die Fragen, die `ziel` als Quelle nehmen darf – für das Fenster im Baukasten. */
export function moeglicheQuellen(f: Formular, ziel: Feld): Feld[] {
  return [...f.anmeldung, ...f.person].filter((q) => quelleErlaubt(f, ziel, q));
}

const gefuellt = (w: Antwort) =>
  Array.isArray(w)
    ? w.length > 0
    : typeof w === 'boolean'
      ? w
      : typeof w === 'string'
        ? w.trim() !== ''
        : w !== undefined && w !== null;

/**
 * Die Antworten, in denen eine Frage nachschlägt: die der Person (Frage je Person) und die der Anmeldung. Ohne
 * Person (`person` = undefined) gelten nur Kontakt-Fragen.
 */
interface Blick {
  f: Formular;
  a: Antworten;
  person?: number;
}

function antwortVon(b: Blick, q: Feld): Antwort {
  const ort = ortVon(b.f, q.id);
  if (!ort) return undefined;
  if (ort.teil === 'anmeldung') return b.a.anmeldung[q.id];
  return b.person === undefined ? undefined : b.a.personen[b.person]?.[q.id];
}

function regelErfuellt(b: Blick, ziel: Feld, r: Regel, tiefe: number): boolean {
  const q = [...b.f.anmeldung, ...b.f.person].find((x) => x.id === r.feld);
  // Kaputte Regel (Quelle weg oder an falscher Stelle) gilt als nicht erfüllt – `bedingungFehler` meldet sie.
  if (!q || !quelleErlaubt(b.f, ziel, q)) return false;
  if (!sichtbarIntern(b, q, tiefe + 1)) return false;
  const w = antwortVon(b, q);
  switch (r.op) {
    case 'ist':
      return w === r.wert;
    case 'istNicht':
      return gefuellt(w) && w !== r.wert;
    case 'enthaelt':
      return Array.isArray(w) && r.wert !== undefined && w.includes(r.wert);
    case 'enthaeltNicht':
      return !Array.isArray(w) || r.wert === undefined || !w.includes(r.wert);
    case 'ausgefuellt':
      return gefuellt(w);
    case 'leer':
      return !gefuellt(w);
  }
}

function erfuellt(b: Blick, ziel: Feld, bed: Bedingung, tiefe: number): boolean {
  if (bed.regeln.length === 0) return true;
  return bed.modus === 'alle'
    ? bed.regeln.every((r) => regelErfuellt(b, ziel, r, tiefe))
    : bed.regeln.some((r) => regelErfuellt(b, ziel, r, tiefe));
}

function sichtbarIntern(b: Blick, x: Feld, tiefe: number): boolean {
  // Quellen stehen immer davor – mehr Stufen als Felder kann es nicht geben. Die Grenze schützt vor kaputten Daten.
  if (tiefe > 200) return false;
  return !x.bed || erfuellt(b, x, x.bed, tiefe);
}

/** **Ist die Frage gerade zu sehen?** `person` = Index der Person bei Fragen je Person. */
export function feldSichtbar(f: Formular, x: Feld, a: Antworten, person?: number): boolean {
  return sichtbarIntern({ f, a, person }, x, 0);
}

/** **Ist diese Antwort gerade wählbar?** Ohne Bedingung immer. */
export function antwortFrei(
  f: Formular,
  x: Feld,
  antwort: string,
  a: Antworten,
  person?: number,
): boolean {
  const bed = x.antwortBed?.[antwort];
  return !bed || erfuellt({ f, a, person }, x, bed, 0);
}

export interface UngueltigeAntwort {
  /** Pfad wie bei `pruefeAntworten`: `anmeldung.<id>` oder `personen.<i>.<id>`. */
  pfad: string;
  feld: Feld;
  antwort: string;
}

/** Gewählte Antworten, die gerade nicht wählbar sind – in sichtbaren Fragen (ausgeblendete leert `leeren` ganz). */
export function ungueltigeAntworten(f: Formular, a: Antworten): UngueltigeAntwort[] {
  const aus: UngueltigeAntwort[] = [];
  const pruefe = (x: Feld, w: Antwort, pfad: string, person?: number) => {
    if (!x.antwortBed || !feldSichtbar(f, x, a, person)) return;
    const gewaehlt = Array.isArray(w) ? w : typeof w === 'string' && w ? [w] : [];
    for (const antwort of gewaehlt)
      if (!antwortFrei(f, x, antwort, a, person)) aus.push({ pfad, feld: x, antwort });
  };
  for (const x of f.anmeldung) pruefe(x, a.anmeldung[x.id], `anmeldung.${x.id}`);
  a.personen.forEach((p, i) => {
    for (const x of f.person) pruefe(x, p[x.id], `personen.${i}.${x.id}`, i);
  });
  return aus;
}

/** Der Satz für eine gelöste Wahl: „„Gruppenleiter“ ist nur für Getaufte möglich – bitte neu wählen.“ */
export function geloestHinweis(u: UngueltigeAntwort): string {
  const grund = u.feld.antwortBed?.[u.antwort]?.grund?.trim();
  return `„${u.antwort}“ ist ${grund ? `${grund} möglich` : 'jetzt nicht mehr möglich'} – bitte neu wählen.`;
}

/** Tiefe Kopie der Antworten (eine Ebene je Teil) – die Bereiniger ändern nie die übergebenen Antworten. */
function kopie(a: Antworten): Antworten {
  return { anmeldung: { ...a.anmeldung }, personen: a.personen.map((p) => ({ ...p })) };
}

/** Höchstzahl der Runden: Jede Runde, die etwas ändert, braucht eine Stufe – mehr Stufen als Felder gibt es nicht. */
const runden = (f: Formular) => f.anmeldung.length + f.person.length + 1;

/**
 * **Ungültige Wahl lösen** – nur gewählte Antworten, die gerade nicht wählbar sind; ausgeblendete Fragen bleiben
 * stehen (im Formular kommt ihr Wert zurück, wenn die Frage wieder auftaucht). So lange, bis nichts mehr ungültig
 * ist – eine gelöste Wahl kann eine weitere Antwort sperren. `geloest`: was gelöst wurde, für den Hinweis
 * (`geloestHinweis`).
 */
export function loesen(
  f: Formular,
  a: Antworten,
): { antworten: Antworten; geloest: UngueltigeAntwort[] } {
  const jetzt = kopie(a);
  const geloest: UngueltigeAntwort[] = [];
  for (let runde = 0; runde < runden(f); runde++) {
    const weg = ungueltigeAntworten(f, jetzt);
    if (weg.length === 0) break;
    for (const u of weg) {
      const ziel = u.pfad.startsWith('anmeldung.')
        ? jetzt.anmeldung
        : jetzt.personen[Number(u.pfad.split('.')[1])];
      const w = ziel[u.feld.id];
      ziel[u.feld.id] = Array.isArray(w) ? w.filter((x) => x !== u.antwort) : undefined;
      geloest.push(u);
    }
  }
  return { antworten: jetzt, geloest };
}

/**
 * **Antworten bereinigen** (vor dem Absenden) – ungültige Wahl lösen (`loesen`) und ausgeblendete Fragen leeren, so
 * lange, bis sich nichts mehr ändert (eine geleerte Frage kann weitere ausblenden). Gibt neue Antworten zurück; die
 * alten bleiben unberührt.
 */
export function leeren(f: Formular, a: Antworten): Antworten {
  let jetzt = kopie(a);
  for (let runde = 0; runde < runden(f); runde++) {
    const l = loesen(f, jetzt);
    jetzt = l.antworten;
    let geaendert = l.geloest.length > 0;
    for (const x of f.anmeldung)
      if (jetzt.anmeldung[x.id] !== undefined && !feldSichtbar(f, x, jetzt)) {
        delete jetzt.anmeldung[x.id];
        geaendert = true;
      }
    jetzt.personen.forEach((p, i) => {
      for (const x of f.person)
        if (p[x.id] !== undefined && !feldSichtbar(f, x, jetzt, i)) {
          delete p[x.id];
          geaendert = true;
        }
    });
    if (!geaendert) break;
  }
  return jetzt;
}

/** Wie eine Antwort gerade erscheint: wählbar, ausgegraut (mit Grund) oder gar nicht. */
export type AntwortZustand = { art: 'frei' } | { art: 'grau'; grund?: string } | { art: 'weg' };

/** **Wie erscheint diese Antwort?** – für die Eingabe (`FeldEingabe`); dieselbe Regel wie `antwortFrei`. */
export function antwortZustand(
  f: Formular,
  x: Feld,
  antwort: string,
  a: Antworten,
  person?: number,
): AntwortZustand {
  if (antwortFrei(f, x, antwort, a, person)) return { art: 'frei' };
  const bed = x.antwortBed![antwort];
  return bed.art === 'weg'
    ? { art: 'weg' }
    : { art: 'grau', grund: bed.grund?.trim() || undefined };
}

/**
 * **Was an den Bedingungen nicht stimmt** – für `pruefeFormular` (Speichern im Baukasten). Eine kaputte Bedingung
 * würde eine Frage für immer ausblenden; darum wird sie nicht gespeichert.
 */
export function bedingungFehler(f: Formular): string[] {
  const fehler: string[] = [];
  const alle = [...f.anmeldung, ...f.person];
  const name = (x: Feld) => `„${kurzname(x)}“`;
  const pruefeRegeln = (ziel: Feld, bed: Bedingung, wo: string) => {
    if (bed.regeln.length === 0) fehler.push(`${wo}: Die Bedingung ist leer.`);
    for (const r of bed.regeln) {
      const q = alle.find((x) => x.id === r.feld);
      if (!q) {
        fehler.push(`${wo}: Die Frage, auf die die Bedingung schaut, gibt es nicht mehr.`);
        continue;
      }
      if (q.zustand === 'aus') {
        fehler.push(`${wo}: Die Bedingung schaut auf ${name(q)} – die ist ausgeschaltet.`);
        continue;
      }
      if (!quelleErlaubt(f, ziel, q)) {
        fehler.push(`${wo}: Die Bedingung schaut auf ${name(q)} – die muss davor stehen.`);
        continue;
      }
      if (!vergleicheFuer(q).includes(r.op)) {
        fehler.push(`${wo}: Dieser Vergleich passt nicht zu ${name(q)}.`);
        continue;
      }
      if (mitWert(r.op) && (r.wert === undefined || !wahlAntworten(q).includes(r.wert)))
        fehler.push(`${wo}: Die Antwort „${r.wert ?? ''}“ gibt es bei ${name(q)} nicht mehr.`);
    }
  };
  for (const x of alle) {
    if (x.bed) {
      if (x.art === 'fest' || x.art === 'preis')
        fehler.push(`${name(x)} ist immer dabei und kann keine Bedingung haben.`);
      else pruefeRegeln(x, x.bed, name(x));
    }
    for (const [antwort, bed] of Object.entries(x.antwortBed ?? {})) {
      if (!MIT_WAHL.has(x.typ) || !wahlAntworten(x).includes(antwort)) {
        fehler.push(`${name(x)}: Die Antwort „${antwort}“ mit Bedingung gibt es nicht mehr.`);
        continue;
      }
      pruefeRegeln(x, bed, `${name(x)}, Antwort „${antwort}“`);
    }
  }
  return fehler;
}
