/**
 * **Die Such-Regeln der Liedwahl** – wohin eine Eingabe geht (Titel oder CCLI-Nummer), ab wann SongSelect von selbst
 * fragt und wie ein Treffer beschrieben wird. Rein und damit prüfbar.
 *
 * Bis zum 06.11.2026 Teil von `liedFormular.ts` (die Formular-Regeln „Neues Lied", damals in `client/src/utils`); umgezogen mit der
 * Liedwahl nach `ui/lied` (Dienstplaner-Bauplan E9, Wunsch 4 „LW1a"), damit Musik-App und Dienstplaner dieselben
 * Regeln nutzen und keine zweite Kopie entsteht.
 */
import type { SongSelectTreffer } from '@shared/types/index';

/**
 * Mindestlänge einer SongSelect-Suche – für Titel und Nummer gleich. Kürzere Eingaben ergeben bei CCLI nur Rauschen.
 * Stand bis 06.11.2026 in `client/src/hooks/useServices.ts`.
 */
export const SONGSELECT_MIN_ZEICHEN = 3;

/**
 * Die Unterzeile eines CCLI-Treffers: Autoren · Nummer · was CCLI dazu hergibt.
 *
 * **Die Merkmale sind nötig, weil die Suche unscharf ist** (147 Treffer für „Wo ich auch stehe",
 * gemessen). Ohne Autor und Nummer stehen in der Liste zwanzig Zeilen mit demselben Titel.
 *
 * „Akkorde" meint das ChordPro, das die App danach holt – deshalb steht es hier und nicht nur als
 * Häkchen: Ohne Akkorde bekommt das Lied kein Notenblatt.
 */
export function trefferUnterzeile(t: SongSelectTreffer): string {
  const teile: string[] = [];
  if (t.authors.length > 0) teile.push(t.authors.join(', '));
  teile.push(`Nr. ${t.songNumber}`);
  if (t.hasChordPro) teile.push('Akkorde');
  else if (t.hasChordSheet) teile.push('nur Notenblatt (PDF)');
  else if (t.hasLyrics) teile.push('nur Text');
  if (t.isPublicDomain) teile.push('gemeinfrei');
  return teile.join(' · ');
}

/**
 * Was hat der Nutzer ins CCLI-Suchfeld getippt – einen **Titel** oder eine **CCLI-Nummer**? (#322)
 *
 * Zwei verschiedene Wege bei CCLI: Der Titel geht in die unscharfe Suche (147 Treffer für „Wo ich auch
 * stehe"), die Nummer in die direkte Abfrage – **ein** Treffer, sofort richtig. Wer die Nummer zur Hand
 * hat, soll sie eintippen können.
 *
 * **Nur Ziffern gelten als Nummer.** Ein Liedtitel besteht praktisch nie ausschließlich aus Ziffern;
 * „Psalm 23" enthält Buchstaben und ist damit ein Titel. Der Randfall bleibt: Wer wirklich nach dem
 * Titel „40" suchen will, findet ihn so nicht – die Meldung nennt deshalb beide Wege, statt nur
 * „nichts gefunden" zu sagen.
 *
 * Die Mindestlänge gilt für beide Wege gleich (`SONGSELECT_MIN_ZEICHEN` beim Aufrufer): Kürzere
 * Eingaben ergeben bei CCLI nur Rauschen.
 */
export function sucheArt(
  eingabe: string,
): { art: 'nummer'; nummer: number } | { art: 'titel'; titel: string } {
  const text = eingabe.trim();
  if (/^\d+$/.test(text)) return { art: 'nummer', nummer: Number(text) };
  return { art: 'titel', titel: text };
}

/**
 * Wie viele Stellen eine CCLI-Nummer mindestens hat, damit **von selbst** abgefragt wird.
 *
 * **Gemessen, nicht geraten** (13.08.2026, `probe-songsuche.ts` gegen den Bestand der ECG): Alle 46
 * vergebenen Nummern haben **7 Stellen**. Ohne diese Schwelle würde die Suche beim Tippen einer Nummer
 * schon nach drei Ziffern abfragen und viermal „findet CCLI kein Lied" melden, bevor die Nummer
 * vollständig ist.
 *
 * **Kürzere Nummern sind trotzdem erreichbar** – über den Knopf „Abfragen". Die Schwelle bremst nur die
 * automatische Suche; sie ist eine Beobachtung an einem Bestand, kein Gesetz von CCLI, und darf
 * niemandem den Weg versperren.
 */
export const CCLI_NUMMER_STELLEN_FUER_AUTO = 7;

/**
 * Darf zu dieser Eingabe **von selbst** gesucht werden? (#322)
 *
 * Getrennt von `sucheArt`, weil es eine andere Frage ist: `sucheArt` sagt, **wohin** die Eingabe geht,
 * diese Funktion, **ob** es dafür schon reicht. Beide Regeln liegen hier und nicht in der Komponente –
 * dort wären sie nur durch Anklicken prüfbar.
 *
 * `mindestens` ist die allgemeine Mindestlänge (`SONGSELECT_MIN_ZEICHEN`); sie kommt vom Aufrufer, damit
 * es die Zahl nicht zweimal gibt.
 */
export function automatischSuchen(eingabe: string, mindestens: number): boolean {
  const text = eingabe.trim();
  if (text.length < mindestens) return false;
  const art = sucheArt(text);
  // Eine Nummer erst, wenn sie vollständig aussieht – siehe `CCLI_NUMMER_STELLEN_FUER_AUTO`.
  return art.art === 'titel' || text.length >= CCLI_NUMMER_STELLEN_FUER_AUTO;
}
