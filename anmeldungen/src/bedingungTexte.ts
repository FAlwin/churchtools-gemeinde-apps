import { BAUSTEINE, type Feld, type Formular } from '@shared/anmeldung/formular';
import {
  bedingungSatz,
  feldName,
  kurzname,
  vergleicheFuer,
  vergleichMitWert,
  wahlAntworten,
  type AntwortBedingung,
  type Bedingung,
  type Regel,
  type RegelZiel,
} from '@shared/anmeldung/bedingungen';

/**
 * **Hilfen für die Bedingungs-Fenster** (F1c/F1d) – neben `Bedingungen.tsx` und `RegelListe.tsx`, damit dort nur
 * Komponenten stehen.
 */

/** Die erste Regel für eine neue Bedingung: die letzte Frage davor mit Antworten (sonst die letzte). */
export function standardRegel(quellen: Feld[]): Regel {
  const q = [...quellen].reverse().find((x) => wahlAntworten(x).length > 0) ?? quellen.at(-1)!;
  return regelFuer(q);
}
export function regelFuer(q: Feld, op = vergleicheFuer(q)[0]): Regel {
  return vergleichMitWert(op) ? { feld: q.id, op, wert: wahlAntworten(q)[0] } : { feld: q.id, op };
}

/** Der Satz unten im Fenster bei einer Antwort: „„X“ ist nur wählbar, wenn …. Sonst ausgegraut mit „…“.“ */
export function antwortSatz(formular: Formular, antwort: string, bed: AntwortBedingung): string {
  const grund = bed.grund?.trim();
  return `„${antwort}“ ist nur wählbar, wenn ${bedingungSatz(formular, bed)}. Sonst ${
    bed.art === 'weg' ? 'ausgeblendet' : `ausgegraut${grund ? ` mit „${grund}“` : ''}`
  }. Wer es schon gewählt hat, bekommt einen Hinweis und wählt neu.`;
}

/**
 * Wie ein Ziel in Chips und Listen heißt: der Kurzname der Frage – bei Hinweis oder Trennlinie ohne Text ihre Art, ein
 * Schritt als Schritt „Name“ (F2c, `feldName`). `zitiert`: in Anführungszeichen, für einen Satz.
 */
export function zielName(formular: Formular, z: RegelZiel, zitiert = false): string {
  const x = [...formular.anmeldung, ...formular.person].find((f) => f.id === z.id);
  if (!x) return '(Frage fehlt)';
  if (x.typ === 'schritt') return feldName(x);
  const name = kurzname(x) || (BAUSTEINE.find((b) => b.typ === x.typ)?.name ?? 'Feld');
  return zitiert ? `„${name}“` : name;
}

/**
 * **Der Satz unten im Fenster, wenn eine Bedingung Felder zeigt** – im Fenster am Feld und im Regel-Fenster dieselbe
 * Stelle. Bei einem Schritt (F2c) sagt er, dass die ganze Seite übersprungen wird.
 */
export function zeigeSatz(formular: Formular, ziele: Feld[], bed: Bedingung): string {
  const wenn = bedingungSatz(formular, bed);
  if (ziele.length === 1 && ziele[0].typ === 'schritt')
    return `Der ${feldName(ziele[0])} erscheint nur, wenn ${wenn}. Sonst wird er übersprungen – mit allen Fragen darin.`;
  return `${ziele.length > 1 ? `Diese ${ziele.length} Felder erscheinen` : 'Die Frage erscheint'} nur, wenn ${wenn}. Pflicht gilt nur, solange sie zu sehen ist.`;
}
