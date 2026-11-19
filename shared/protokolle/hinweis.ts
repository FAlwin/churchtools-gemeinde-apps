/**
 * **Hinweis auf fällige To-Dos** (Protokolle, Alwin 19.11.2026): ChurchTools hat keine zeitgesteuerten Erinnerungen, die
 * Erweiterung läuft nur im Browser – darum ein Hinweis **beim Öffnen**: ein Band auf der Startseite und ein roter Zähler
 * am Reiter „To-Dos“. Gezählt werden nur **meine** offenen To-Dos (`meineOffenen`, dieselbe Menge wie „Meine offenen
 * To-Dos“ auf der Startseite); was „überfällig“ heißt, entscheidet `istUeberfaellig` – hier wird es nicht nachgebaut.
 *
 * **Einstellbar für die ganze Erweiterung:** Admins wählen, ab wann ein To-Do „bald fällig“ ist (`Vorlauf`). Der Wert
 * liegt als eigener Wert in der globalen Kategorie „Vorlagen“ (lesen alle mit eingerichteter Gruppe, schreiben Admins);
 * der Leser (`protokolle/src/todoHinweis.ts`) lässt ihn bei Fehlern auf den Standard fallen – nie auf „Aus“.
 */
import { tagKurz, plusTage } from '../ct/datum';
import { inhaltAus, type Wert } from '../ct/modulDaten';
import { meineOffenen, istUeberfaellig, type Aufgabe } from './aufgaben';

/** Ab wann ein To-Do hinweist: gar nicht, nur Überfällige, oder zusätzlich die in den nächsten N Tagen Fälligen. */
export type Vorlauf = 'aus' | 'ueberfaellig' | 1 | 3 | 7 | 14;

/** Was gilt, wenn nichts eingestellt oder nichts lesbar ist (Alwin: 3 Tage). */
export const STANDARD_VORLAUF: Vorlauf = 3;
const STANDARD_TAGE = 3;

/** Die Auswahl in der Verwaltung – mit dem Text, den man dort sieht. */
export const VORLAUF_WAHL: readonly { wert: Vorlauf; text: string }[] = [
  { wert: 'aus', text: 'Aus (kein Hinweis, kein Zähler)' },
  { wert: 'ueberfaellig', text: 'Nur Überfällige' },
  { wert: 1, text: 'Überfällige und 1 Tag vorher' },
  { wert: 3, text: 'Überfällige und 3 Tage vorher' },
  { wert: 7, text: 'Überfällige und 7 Tage vorher' },
  { wert: 14, text: 'Überfällige und 14 Tage vorher' },
];

export function istVorlauf(x: unknown): x is Vorlauf {
  return VORLAUF_WAHL.some((v) => v.wert === x);
}

/** Der Wert in der Kategorie „Vorlagen“. */
export interface TodoHinweis {
  art: 'todo-hinweis';
  fassung: 1;
  vorlauf: Vorlauf;
}

export function neuerHinweis(vorlauf: Vorlauf): TodoHinweis {
  return { art: 'todo-hinweis', fassung: 1, vorlauf };
}

/** Ist das der Hinweis-Wert von uns, mit gültigem Vorlauf? Für alles, was aus dem Speicher kommt. */
export function istTodoHinweis(x: unknown): x is TodoHinweis {
  const h = x as Partial<TodoHinweis> | null;
  return !!h && h.art === 'todo-hinweis' && h.fassung === 1 && istVorlauf(h.vorlauf);
}

/**
 * **Der Vorlauf aus den Werten der Kategorie „Vorlagen“** – nur die eine Stelle dafür. Kein Wert, ein kaputter oder
 * einer aus einer fremden Fassung → Standard. Gibt es den Wert doppelt (abgebrochenes Anlegen), gilt der mit der
 * kleinsten ID – wie bei Kategorien. Gibt auch die ID des gewählten Werts zurück (zum Ändern statt Neuanlegen).
 */
export function vorlaufAus(werte: readonly Wert[]): { vorlauf: Vorlauf; wert: number | null } {
  const eigene = werte
    .filter((w) => inhaltAus(w, 'todo-hinweis', 1) !== null)
    .sort((a, b) => a.id - b.id);
  if (!eigene.length) return { vorlauf: STANDARD_VORLAUF, wert: null };
  const w = eigene[0];
  const h = inhaltAus<unknown>(w, 'todo-hinweis', 1);
  return { vorlauf: istTodoHinweis(h) ? h.vorlauf : STANDARD_VORLAUF, wert: w.id };
}

/**
 * **Bald fällig:** nicht erledigt, nicht gelöscht, Datum heute oder in den nächsten `tage` Tagen. Überfällige gehören
 * nicht dazu (`istUeberfaellig`). `heute` als `JJJJ-MM-TT`, Ortszeit des Aufrufers – wie bei `istUeberfaellig`.
 */
export function istBaldFaellig(a: Aufgabe, heute: string, tage: number): boolean {
  return (
    !a.geloescht &&
    a.status !== 'erledigt' &&
    a.bis !== null &&
    a.bis >= heute &&
    a.bis <= plusTage(heute, tage)
  );
}

export interface Faellige {
  ueberfaellig: Aufgabe[];
  bald: Aufgabe[];
}

/** **Meine fälligen To-Dos** unter dem Vorlauf: „Aus“ → nichts, „Nur Überfällige“ → keine „bald“-Fälligen. */
export function faellige(
  liste: readonly Aufgabe[],
  ich: number,
  heute: string,
  vorlauf: Vorlauf,
): Faellige {
  if (vorlauf === 'aus') return { ueberfaellig: [], bald: [] };
  const offen = meineOffenen(liste, ich, heute);
  return {
    ueberfaellig: offen.filter((a) => istUeberfaellig(a, heute)),
    bald: vorlauf === 'ueberfaellig' ? [] : offen.filter((a) => istBaldFaellig(a, heute, vorlauf)),
  };
}

/** Die Zahl am Reiter „To-Dos“: überfällig + bald fällig. */
export function faelligZahl(f: Faellige): number {
  return f.ueberfaellig.length + f.bald.length;
}

const todos = (n: number) => `${n} ${n === 1 ? 'To-Do' : 'To-Dos'}`;

/** Wann die „bald“-Fälligen fällig sind: ein einziger Tag mit Datum, sonst der Zeitraum. */
function wann(bald: readonly Aufgabe[], heute: string, tage: number): string {
  const tageDa = [...new Set(bald.map((a) => a.bis))];
  if (tageDa.length === 1) return tageDa[0] === heute ? 'heute' : `bis ${tagKurz(tageDa[0]!)}`;
  return tage === 1 ? 'heute oder morgen' : `in den nächsten ${tage} Tagen`;
}

/**
 * **Der Text des Bands auf der Startseite** – `fett` und `rest` getrennt, damit das Band den Anfang hervorheben kann.
 * `rot`, solange etwas überfällig ist, sonst `ruhig` (neutral/blau). Nichts fällig → `null` (kein Band).
 * Beispiele: „**2 To-Dos überfällig**, 1 bis Sa, 21.11. fällig“ · „**3 To-Dos** in den nächsten 7 Tagen fällig“.
 */
export function hinweisText(
  f: Faellige,
  vorlauf: Vorlauf,
  heute: string,
): { art: 'rot' | 'ruhig'; fett: string; rest: string } | null {
  // „bald“ gibt es nur mit Tagen – sonst ist `bald` ohnehin leer, die Zahl wird dann nicht gebraucht.
  const tage = typeof vorlauf === 'number' ? vorlauf : STANDARD_TAGE;
  const baldText = f.bald.length ? `${wann(f.bald, heute, tage)} fällig` : '';
  if (f.ueberfaellig.length)
    return {
      art: 'rot',
      fett: `${todos(f.ueberfaellig.length)} überfällig`,
      rest: f.bald.length ? `, ${f.bald.length} ${baldText}` : '',
    };
  if (f.bald.length) return { art: 'ruhig', fett: todos(f.bald.length), rest: ` ${baldText}` };
  return null;
}

/** Name für Vorleser am Reiter: „To-Dos, 3 fällig“ – ohne Zahl nur „To-Dos“. */
export function reiterName(zahl: number): string {
  return zahl > 0 ? `To-Dos, ${zahl} fällig` : 'To-Dos';
}
