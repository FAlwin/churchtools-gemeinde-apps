/**
 * **Das Formular in Schritten** (Etappe F2a, Entwurf `f2-schritte-v1`, Klick-Runden 7 und 8 am 16.11.2026) – welche
 * Felder auf welcher Seite stehen, welche Seiten gezeigt werden und was auf einer Seite fehlt. Die EINE Stelle dafür
 * für das öffentliche Formular, die Vorschau im Baukasten und die Anmeldung von Hand.
 *
 * - Ein Baustein „Neuer Schritt“ (`typ: 'schritt'`) beginnt eine neue Seite – im Kontakt-Teil wie mitten in den
 *   Fragen je Person. Eine Seite zeigt ihren Teil der Kontakt-Fragen und ihren Teil der Fragen je Person (für alle
 *   Personen untereinander).
 * - Vor dem ersten Baustein steht Schritt 1; sein Name steht in den Einstellungen (`ersterSchritt`).
 * - Preis und Datenschutz gehören zu keinem Schritt: Sie stehen am Ende des letzten (`amEnde`).
 * - Hat ein Schritt eine Bedingung, wird er übersprungen, solange sie nicht erfüllt ist. Dass dann auch seine Felder
 *   nicht zu sehen sind, regelt `feldSichtbar` (`schrittVon` in `bedingungen.ts`) – so gilt es auch beim Leeren vor
 *   dem Absenden und in der Pflichtprüfung.
 */
import {
  ERSTER_SCHRITT,
  pruefeAntworten,
  type Antworten,
  type Feld,
  type Formular,
  type OeffentlicheEinstellungen,
} from './formular';
import { amEnde, feldSichtbar } from './bedingungen';

/** Eine Seite des Formulars. `schritt` = der Baustein, mit dem sie beginnt; `null` = Schritt 1. */
export interface Seite {
  schritt: Feld | null;
  anmeldung: Feld[];
  person: Feld[];
}

const istSchritt = (x: Feld) => x.typ === 'schritt' && x.zustand !== 'aus';

/** Hat das Formular Schritte? Nur dann gibt es Seiten, Fortschritt und „Weiter“. */
export function mitSchritten(f: Formular): boolean {
  return [...f.anmeldung, ...f.person].some(istSchritt);
}

/**
 * **Die Seiten** in ihrer Reihenfolge – ohne Schritte genau eine. Die Bausteine „Neuer Schritt“ selbst, Preis und
 * Datenschutz stehen auf keiner Seite (Preis und Datenschutz kommen ans Ende der letzten gezeigten).
 */
export function seiten(f: Formular): Seite[] {
  const aus: Seite[] = [{ schritt: null, anmeldung: [], person: [] }];
  for (const x of f.anmeldung) {
    if (istSchritt(x)) aus.push({ schritt: x, anmeldung: [], person: [] });
    else if (x.typ !== 'schritt' && !amEnde(x)) aus.at(-1)!.anmeldung.push(x);
  }
  for (const x of f.person) {
    if (istSchritt(x)) aus.push({ schritt: x, anmeldung: [], person: [] });
    else if (x.typ !== 'schritt' && !amEnde(x)) aus.at(-1)!.person.push(x);
  }
  return aus;
}

/**
 * **Wird die Seite gezeigt?** Schritt 1 immer. Ein Schritt mit Bedingung nur, solange sie erfüllt ist – steht er bei
 * den Fragen je Person, genügt es, wenn sie für eine Person erfüllt ist (für die anderen sind seine Felder dann nicht
 * zu sehen).
 */
export function seiteSichtbar(f: Formular, s: Seite, a: Antworten): boolean {
  if (!s.schritt) return true;
  if (!f.person.includes(s.schritt)) return feldSichtbar(f, s.schritt, a);
  return a.personen.length === 0
    ? feldSichtbar(f, s.schritt, a)
    : a.personen.some((_, i) => feldSichtbar(f, s.schritt!, a, i));
}

/**
 * Die gezeigten Seiten in ihrer Reihenfolge – daraus „Schritt 2 von 3“ und „Weiter“/„Anmelden“. `alle`: schon gebaute
 * Seiten (`seiten` baut bei jedem Aufruf neue) – wer gezeigte und alle vergleicht, muss dieselben übergeben.
 */
export function gezeigteSeiten(f: Formular, a: Antworten, alle: Seite[] = seiten(f)): Seite[] {
  return alle.filter((s) => seiteSichtbar(f, s, a));
}

/**
 * **Ein Schritt im Baukasten** (F2c): seine Nummer – gezählt wie im Formular, Schritt 1 ist der feste Balken oben, also
 * ab 2; bedingte zählen mit – und ob seine Seite noch leer ist (dann blätterte das Formular auf eine Seite ohne Fragen).
 * `null` = kein eingeschalteter Schritt.
 */
export function schrittImBaukasten(f: Formular, x: Feld): { nr: number; leer: boolean } | null {
  const alle = seiten(f);
  const i = alle.findIndex((s) => s.schritt?.id === x.id);
  if (i < 0) return null;
  return { nr: i + 1, leer: alle[i].anmeldung.length + alle[i].person.length === 0 };
}

/** Wie der Schritt heißt – Schritt 1 aus den Einstellungen, die übrigen am Baustein. */
export function schrittName(e: Pick<OeffentlicheEinstellungen, 'ersterSchritt'>, s: Seite): string {
  return s.schritt ? s.schritt.frage.trim() : e.ersterSchritt?.trim() || ERSTER_SCHRITT;
}

/**
 * **Was auf dieser Seite fehlt** – die Pflichtprüfung des ganzen Formulars (`pruefeAntworten`, dieselbe wie beim
 * Absenden), beschränkt auf die Felder der Seite. `letzte`: Auf der letzten Seite zählen auch Preis und Datenschutz.
 */
export function seiteFehlt(f: Formular, a: Antworten, s: Seite, letzte: boolean): string[] {
  const kontakt = new Set(s.anmeldung.map((x) => x.id));
  if (letzte) for (const x of f.anmeldung) if (amEnde(x)) kontakt.add(x.id);
  const person = new Set(s.person.map((x) => x.id));
  return pruefeAntworten(f, a).filter((pfad) => {
    const teile = pfad.split('.');
    if (teile[0] === 'anmeldung') return kontakt.has(teile[1]);
    if (pfad === 'personen') return person.size > 0;
    if (teile[0] === 'personen') return person.has(teile[2]);
    return letzte;
  });
}
