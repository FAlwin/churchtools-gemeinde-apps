/**
 * **Ein Protokoll löschen** (Bauplan W6, entschieden 17.11.2026) – die Regeln ohne ChurchTools: Welche To-Dos „aus diesem
 * Protokoll“ sind, wen die Mail „Termin gelöscht“ trifft und was die Rückfrage sagt. Geschrieben wird in
 * `protokolle/src/loeschen.ts`; das Fenster steht in `protokolle/src/ProtokollLoeschen.tsx`.
 */
import type { Aufgabe } from './aufgaben';
import type { SitzungsStatus } from './speicher';

/** Der Satz, der im Fenster nicht fehlen darf – hier, damit Fenster und Tests denselben Text meinen. */
export const NICHT_RUECKGAENGIG = 'Das lässt sich nicht rückgängig machen.';

/**
 * **Die To-Dos „aus diesem Protokoll“:** die in dieser Sitzung entstanden sind (`sitzung` am To-Do, wie bei
 * „Offene To-Dos von früher“ in `offeneVonFrueher`) – bereits als gelöscht vermerkte zählen nicht mit. Die eine Stelle
 * dafür: Zahl im Fenster und das, was beim „Mitlöschen“ tatsächlich vermerkt wird.
 */
export function aufgabenAusProtokoll(
  aufgaben: readonly Aufgabe[],
  sitzung: string,
  gruppe?: number,
): Aufgabe[] {
  return aufgaben.filter(
    (a) => a.sitzung === sitzung && !a.geloescht && (gruppe === undefined || a.gruppe === gruppe),
  );
}

/**
 * **Wie viele Eingeladene die Mail „Termin gelöscht“ bekommen:** alle Personen mit Besprechungsanfrage – außer dem, der
 * löscht (ChurchTools mailt ihm nicht; gemessen K2b 29.10.2026). Jede Person einmal.
 */
export function eingeladeneMitMail(eingeladen: readonly number[], ich: number): number {
  return new Set(eingeladen.filter((p) => p !== ich)).size;
}

/** Wie der Status in der Rückfrage heißt (die Liste sagt „freigegeben“, nicht „frei“). */
export function statusWort(status: SitzungsStatus): string {
  return status === 'frei' ? 'freigegeben' : status === 'entwurf' ? 'Entwurf' : 'geplant';
}

/**
 * **Darf ein Protokoll hier gelöscht werden?** Entwurf und freigegeben – ein bloß geplantes ist noch kein Protokoll (es
 * hat keinen Text; das Absagen der Sitzung räumt es mit weg).
 */
export function loeschbar(status: SitzungsStatus | undefined): boolean {
  return status === 'entwurf' || status === 'frei';
}

/** Der Zusatz unter dem Häkchen „Termin“ – wen das Löschen trifft. `serie`: nur dieser Tag fällt heraus, still. */
export function terminZusatz(q: { eingeladene: number; serie: boolean }): string {
  if (q.serie)
    return 'Eine Terminserie: Nur diese Sitzung fällt aus der Serie, die anderen Termine bleiben. Ohne Mail.';
  if (q.eingeladene === 0) return 'Niemand sonst ist eingeladen – es geht keine Mail raus.';
  if (q.eingeladene === 1) return 'Eine Person bekommt die Mail „Termin gelöscht“.';
  return `${q.eingeladene} Eingeladene bekommen die Mail „Termin gelöscht“.`;
}

/** Der Zusatz unter dem Häkchen „Gruppentreffen“ – nur ein abgeschlossenes hat etwas zu verlieren. */
export function treffenZusatz(abgeschlossen: boolean): string | null {
  return abgeschlossen ? 'Abgeschlossen – die Anwesenheit geht mit verloren.' : null;
}

/** Die Zeile über den To-Dos: „To-Dos aus diesem Protokoll (3)“. */
export function todosUeberschrift(n: number): string {
  return `To-Dos aus diesem Protokoll (${n})`;
}

/** Die einzelnen Schritte – ihre Namen stehen in der Meldung, wenn mittendrin etwas scheitert. */
export type LoeschSchritt = 'todos' | 'termin' | 'treffen' | 'termine' | 'protokoll';

const SCHRITT_WORT: Record<LoeschSchritt, string> = {
  todos: 'die To-Dos',
  termin: 'der Termin',
  treffen: 'das Gruppentreffen',
  termine: 'die Vermerke im Reiter „Termine“',
  protokoll: 'das Protokoll',
};

const ERLEDIGT_WORT: Record<LoeschSchritt, string> = {
  todos: 'To-Dos als gelöscht vermerkt',
  termin: 'Termin gelöscht',
  treffen: 'Gruppentreffen gelöscht',
  termine: 'Vermerke im Reiter „Termine“ als gelöscht markiert',
  protokoll: 'Protokoll gelöscht',
};

/**
 * **Die Meldung, wenn mittendrin etwas scheitert:** was schon erledigt ist, was noch aussteht und warum es hakt. Ein
 * zweiter Versuch macht das Erledigte nicht noch einmal (To-Do schon vermerkt, Termin/Treffen schon weg = erledigt).
 */
export function unterbrochenText(q: {
  erledigt: readonly LoeschSchritt[];
  offen: readonly LoeschSchritt[];
  grund: string;
}): string {
  const getan = q.erledigt.length
    ? `Schon erledigt: ${q.erledigt.map((s) => ERLEDIGT_WORT[s]).join(', ')}. `
    : 'Bisher wurde nichts gelöscht. ';
  const rest = q.offen.length
    ? `Noch offen: ${q.offen.map((s) => SCHRITT_WORT[s]).join(', ')}. `
    : '';
  return `${getan}${rest}${q.grund} Beim nächsten Versuch wird nichts doppelt gemacht.`;
}

/**
 * **Die Meldung, wenn jemand am Protokoll schreibt:** Es wird nichts (mehr) gelöscht – wer schreibt (oder dass es ein
 * anderes eigenes Fenster ist) und, falls vorher schon etwas ging, was das war.
 */
export function gesperrtText(
  sperre: { von: number; name: string },
  ich: number,
  erledigt: readonly LoeschSchritt[] = [],
): string {
  const wer =
    sperre.von === ich ? 'Du schreibst in einem anderen Fenster' : `${sperre.name} schreibt gerade`;
  const getan = erledigt.length
    ? ` Schon erledigt: ${erledigt.map((s) => ERLEDIGT_WORT[s]).join(', ')}.`
    : '';
  return `${wer} am Protokoll – es wurde nicht gelöscht. Bitte versuch es danach noch einmal.${getan}`;
}
