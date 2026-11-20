import { tagMonat } from '@shared/ct/datum';
import { gemeindeZeitzone, tagAusIso } from '@shared/ct/zeit';
import { erledigtVon, teilStand, type Aufgabe } from '@shared/protokolle/aufgaben';

/**
 * Texte der To-Do-Karte, die auch das Fenster braucht (W8b) – getrennt von den Bausteinen, damit es EINE Stelle gibt und die
 * Komponenten-Dateien nur Komponenten enthalten.
 */

/** Datum eines ISO-Zeitpunkts als „12.11.“ in der Gemeinde-Zeitzone. */
export const kurzDatum = (iso: string): string => tagMonat(tagAusIso(iso, gemeindeZeitzone()));

/**
 * **Der Satz „Erledigt von Peter am 12.11.“** – bei „Jeder für sich“ „Alle fertig am 12.11.“, ohne bekannten Zeitpunkt (alter
 * Stand) nur „Erledigt“. Die eine Stelle für Karte, Tabelle und Fenster; wer es war, sagt `erledigtVon`.
 */
export function erledigtSatz(
  a: Aufgabe,
  ich: number,
  name: (p: number) => string | null,
  nurMein = false,
): string {
  const e = erledigtVon(a);
  if (!e) return 'Erledigt';
  // „Jeder für sich“ als Mitarbeiter (W10): Es ist nur meine Aufgabe – „Von dir erledigt am …“, kein „Alle fertig“.
  if (nurMein) return `Von dir erledigt am ${kurzDatum(e.am)}`;
  if (teilStand(a) !== null) return `Alle fertig am ${kurzDatum(e.am)}`;
  const von = e.von[0];
  return `Erledigt von ${von === ich ? 'dir' : (name(von) ?? 'jemand')} am ${kurzDatum(e.am)}`;
}
