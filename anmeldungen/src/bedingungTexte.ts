import { BAUSTEINE, type Feld, type Formular } from '@shared/anmeldung/formular';
import {
  bedingungSatz,
  kurzname,
  vergleicheFuer,
  vergleichMitWert,
  wahlAntworten,
  type AntwortBedingung,
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

/** Wie ein Ziel in Chips und Listen heißt: der Kurzname der Frage – bei Hinweis oder Trennlinie ohne Text ihre Art. */
export function zielName(formular: Formular, z: RegelZiel): string {
  const x = [...formular.anmeldung, ...formular.person].find((f) => f.id === z.id);
  if (!x) return '(Frage fehlt)';
  return kurzname(x) || (BAUSTEINE.find((b) => b.typ === x.typ)?.name ?? 'Feld');
}
