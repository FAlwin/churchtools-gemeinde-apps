/**
 * **To-Do-Vorschläge schreiben** (W9b): vorschlagen, ändern, zurückziehen (wer vorschlug) – übernehmen, ablehnen (die
 * Leitung). Die Regeln stehen in `@shared/protokolle/todoVorschlag` (`vorschlagVerboten` + die Rechenregeln); hier wird
 * frisch gelesen, **auf diesem Stand geprüft und geändert**, geschrieben und **nachgelesen** (ein `201` ist kein Beleg).
 * Jede Verweigerung kommt als 409 mit dem Satz zurück – `fehlerMeldung` zeigt ihn.
 *
 * Ein Vorschlag ist derselbe Datensatz wie ein To-Do; die normalen To-Do-Wege (`aufgabeAendern`, also Haken, Status, Löschen)
 * lehnen ihn ab (`VORSCHLAG_KEIN_TODO`). **Übernehmen** schreibt das Ergebnis selbst und liest es nach – erst danach gilt es
 * (ein Erfolgssignal ist kein Beleg).
 */
import {
  anlegenVerboten,
  istAufgabe,
  mitNamen,
  type Aufgabe,
  type ToDoAenderung,
} from '@shared/protokolle/aufgaben';
import {
  neuerToDoVorschlag,
  vorschlagAblehnen,
  vorschlagAendern,
  vorschlagUebernehmen,
  vorschlagVerboten,
  vorschlagZurueckziehen,
  type VorschlagTun,
} from '@shared/protokolle/todoVorschlag';
import { ApiError } from '@ui/ct/fehler';
import type { Schreibend } from './aufgabenSchreiben';
import { wertNachgelesen, type MitarbeitOrt } from './mitarbeitWerte';

const TEXTE = {
  verweigert: 'Du darfst in dieser Gruppe keine To-Dos vorschlagen.',
  nichtUebernommen: 'ChurchTools hat den Vorschlag nicht übernommen.',
};
const WEG = 'Diesen Vorschlag gibt es nicht mehr – bitte neu laden.';
const fehlt = (): never => {
  throw new ApiError(409, WEG);
};
const jetzt = () => new Date().toISOString();

/** Frisch gelesenen Vorschlag prüfen (`vorschlagVerboten`), dann ändern – die eine Form für alle vier Wege. */
function schreiben(
  ort: MitarbeitOrt,
  id: string,
  tun: VorschlagTun,
  ich: Schreibend,
  leitung: boolean,
  aendern: (a: Aufgabe) => Aufgabe,
): Promise<Aufgabe> {
  return wertNachgelesen(
    ort,
    istAufgabe,
    id,
    (a) => {
      const grund = vorschlagVerboten(a, tun, { ich: ich.person, leitung });
      if (grund) throw new ApiError(409, grund);
      return mitNamen(aendern(a), ich);
    },
    fehlt,
    TEXTE,
  );
}

/**
 * **Vorschlagen** – ein neuer Vorschlag (ohne Zuständige, mit Kennzeichen). Gibt es `neueId` schon (zweiter Versuch), bleibt
 * es, wie es ist. `leitung` = schreibt Protokolle in dieser Gruppe; ohne Angabe gilt: Mitarbeiter.
 */
export async function vorschlagAnlegen(
  ort: MitarbeitOrt,
  q: { neueId: string; gruppe: number; text: string; bis: string | null; warum: string },
  ich: Schreibend,
  leitung = false,
): Promise<Aufgabe> {
  const grund = anlegenVerboten(
    { wer: [], extern: '', vorschlag: true },
    { ich: ich.person, leitung },
  );
  if (grund) throw new ApiError(409, grund);
  if (!q.text.trim()) throw new ApiError(409, 'Ein Vorschlag braucht einen Text.');
  const neu = neuerToDoVorschlag({
    id: q.neueId,
    gruppe: q.gruppe,
    text: q.text,
    bis: q.bis,
    warum: q.warum,
    von: ich,
    am: jetzt(),
  });
  return wertNachgelesen(
    ort,
    istAufgabe,
    q.neueId,
    (a) => a,
    () => mitNamen(neu, ich),
    TEXTE,
  );
}

/** **Den eigenen Vorschlag ändern** (Text, Bis, Warum) – nur wer vorschlug, nur solange er offen ist. */
export function todoVorschlagAendern(
  ort: MitarbeitOrt,
  id: string,
  x: { text: string; bis: string | null; warum: string },
  ich: Schreibend,
  leitung = false,
): Promise<Aufgabe> {
  return schreiben(ort, id, 'aendern', ich, leitung, (a) => vorschlagAendern(a, x, ich, jetzt()));
}

/** **Zurückziehen** – als gelöscht vermerkt, nie hart gelöscht; nur wer vorschlug, nur solange er offen ist. */
export function todoVorschlagZurueckziehen(
  ort: MitarbeitOrt,
  id: string,
  ich: Schreibend,
  leitung = false,
): Promise<Aufgabe> {
  return schreiben(ort, id, 'zurueckziehen', ich, leitung, (a) =>
    vorschlagZurueckziehen(a, ich, jetzt()),
  );
}

/**
 * **Übernehmen** (nur die Leitung): aus DEMSELBEN Datensatz wird ein To-Do – `x` sind die Zuständigen und was die Leitung im
 * Fenster sonst änderte. Geschrieben wird der frisch gelesene Stand, danach **nachgelesen**: Liefert das Nachlesen nicht das
 * To-Do (ohne Kennzeichen), ist es nicht geschehen – dann wird geworfen.
 */
export async function todoVorschlagUebernehmen(
  ort: MitarbeitOrt,
  id: string,
  x: ToDoAenderung,
  ich: Schreibend,
  leitung = false,
): Promise<Aufgabe> {
  const a = await schreiben(ort, id, 'uebernehmen', ich, leitung, (v) =>
    vorschlagUebernehmen(v, x, ich, jetzt()),
  );
  if (a.vorschlag) throw new ApiError(409, 'ChurchTools hat den Vorschlag nicht übernommen.');
  return a;
}

/** **Ablehnen** (nur die Leitung) – die Begründung ist freiwillig. */
export function todoVorschlagAblehnen(
  ort: MitarbeitOrt,
  id: string,
  grund: string,
  ich: Schreibend,
  leitung = false,
): Promise<Aufgabe> {
  return schreiben(ort, id, 'ablehnen', ich, leitung, (a) =>
    vorschlagAblehnen(a, grund, ich, jetzt()),
  );
}
