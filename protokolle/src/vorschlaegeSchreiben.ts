/**
 * **Vorschläge in „Mitarbeit“ lesen und schreiben** (Bauplan S5-4). Die Regeln stehen in
 * `@shared/protokolle/vorschlaege`; gelesen und geschrieben wird über `mitarbeitWerte` – derselbe Weg wie bei den
 * To-Dos (frisch lesen, anwenden, schreiben, nachlesen).
 *
 * Ein neuer Vorschlag bekommt seine ID schon beim Öffnen des Fensters: Kommt die Antwort unklar zurück und wird noch
 * einmal gespeichert, findet `wertNachgelesen` ihn vor und legt keinen zweiten an.
 */
import { istVorschlag, SchonEntschieden, type Vorschlag } from '@shared/protokolle/vorschlaege';
import { ApiError } from '@ui/ct/fehler';
import { derArt, mitarbeitRoh, wertNachgelesen, type MitarbeitOrt } from './mitarbeitWerte';

const TEXTE = {
  verweigert: 'Du darfst in dieser Gruppe keine Punkte vorschlagen.',
  nichtUebernommen: 'ChurchTools hat den Vorschlag nicht übernommen.',
};

// 409 statt einfachem Fehler: `fehlerMeldung` zeigt den Text, statt „ChurchTools antwortet gerade nicht“.
const meldung = (text: string): never => {
  throw new ApiError(409, text);
};

/** Alle Vorschläge der Gruppe – auch zurückgezogene (die Anzeige lässt sie weg). */
export async function vorschlagWerte(ort: MitarbeitOrt): Promise<Vorschlag[]> {
  return derArt(await mitarbeitRoh(ort), istVorschlag).map((w) => w.x);
}

/** Einreichen. Gibt es die ID schon (zweiter Versuch), bleibt er, wie er ist. */
export function vorschlagEinreichen(ort: MitarbeitOrt, neu: Vorschlag): Promise<Vorschlag> {
  return wertNachgelesen(
    ort,
    istVorschlag,
    neu.id,
    (v) => v,
    () => neu,
    TEXTE,
  );
}

/**
 * **Einen Vorschlag ändern** – `f` ist eine Regel aus `@shared/protokolle/vorschlaege` (ändern, zurückziehen,
 * ablehnen …), angewendet auf den frisch gelesenen Stand. Hat die Leitung inzwischen entschieden, kommt das als
 * Meldung zurück, nicht als Absturz.
 */
export async function vorschlagSchreiben(
  ort: MitarbeitOrt,
  id: string,
  f: (v: Vorschlag) => Vorschlag,
): Promise<Vorschlag> {
  try {
    return await wertNachgelesen(
      ort,
      istVorschlag,
      id,
      f,
      () => meldung('Diesen Vorschlag gibt es nicht mehr – bitte neu laden.'),
      TEXTE,
    );
  } catch (e) {
    if (e instanceof SchonEntschieden) return meldung(e.message);
    throw e;
  }
}
