/**
 * **Ein To-Do aus dem Fenster „To-Do“ schreiben** (Bauplan S7-2a) – ändern, neu anlegen, als gelöscht vermerken, in eine
 * andere Gruppe verschieben. Die Regeln stehen in `@shared/protokolle/aufgaben` (`bearbeiten`, `verschieben`); gelesen
 * und geschrieben wird über `aufgabeAendern` (frisch lesen, schreiben, nachlesen – ein `201` ist kein Beleg).
 *
 * Ein neues To-Do bekommt seine ID schon beim Öffnen des Fensters (`neueId`): Kommt die Antwort unklar zurück und wird
 * noch einmal gespeichert, findet `aufgabeAendern` es vor und legt kein zweites an. Dasselbe beim Verschieben.
 */
import {
  alsGeloescht,
  bearbeiten,
  neueAufgabe,
  verschieben,
  type Aufgabe,
  type AufgabenStatus,
  type ToDoAenderung,
} from '@shared/protokolle/aufgaben';
import { ApiError } from '@ui/ct/fehler';
import {
  aufgabeAendern,
  aufgabenWerte,
  type MitarbeitOrt,
  type Schreibend,
} from './aufgabenSchreiben';

const WEG = 'Dieses To-Do gibt es nicht mehr – bitte neu laden.';
// 409 statt einfachem Fehler: `fehlerMeldung` zeigt den Text, statt „ChurchTools antwortet gerade nicht“.
const fehlt = (): never => {
  throw new ApiError(409, WEG);
};
const jetzt = () => new Date().toISOString();

/** Ändern – `x` enthält nur, was im Fenster angefasst wurde; angewendet auf den frisch gelesenen Stand. */
export function toDoAendern(
  ort: MitarbeitOrt,
  id: string,
  x: ToDoAenderung,
  ich: Schreibend,
): Promise<Aufgabe> {
  return aufgabeAendern(ort, id, (a) => bearbeiten(a, x, ich.person, jetzt()), fehlt, ich);
}

/** Neu anlegen (ohne Sitzung). Gibt es `neueId` schon (zweiter Versuch), bleibt es, wie es ist. */
export function toDoAnlegen(
  ort: MitarbeitOrt,
  q: {
    neueId: string;
    gruppe: number;
    text: string;
    wer: number[];
    extern: string;
    bis: string | null;
    status: AufgabenStatus;
    notiz: string;
    karte: { notiz?: boolean; sitzung?: boolean };
  },
  ich: Schreibend,
): Promise<Aufgabe> {
  const am = jetzt();
  const neu = bearbeiten(
    neueAufgabe({
      id: q.neueId,
      gruppe: q.gruppe,
      sitzung: null,
      text: q.text,
      wer: q.wer,
      extern: q.extern,
      bis: q.bis,
      von: ich.person,
      am,
    }),
    { status: q.status, notiz: q.notiz, karte: q.karte },
    ich.person,
    am,
  );
  return aufgabeAendern(
    ort,
    q.neueId,
    (a) => a,
    () => neu,
    ich,
  );
}

/** Als gelöscht vermerken – nie hart gelöscht (wer in „Mitarbeit“ schreibt, dürfte sonst jeden Wert löschen). */
export async function toDoLoeschen(ort: MitarbeitOrt, id: string, ich: Schreibend): Promise<void> {
  await aufgabeAendern(ort, id, (a) => alsGeloescht(a, ich.person, jetzt()), fehlt, ich);
}

/**
 * **In eine andere Gruppe verschieben** – erst in der neuen Gruppe anlegen (nachgelesen), **dann** das alte als gelöscht
 * vermerken: Scheitert das Zweite, steht das To-Do doppelt da statt nirgends. Liefert einen Hinweis, wenn das alte
 * stehen blieb.
 */
export async function toDoVerschieben(q: {
  von: { ort: MitarbeitOrt; name: string };
  nach: { ort: MitarbeitOrt; gruppe: number; name: string };
  id: string;
  neueId: string;
  x: ToDoAenderung;
  wer: number[];
  ich: Schreibend;
}): Promise<{ hinweis: string | null }> {
  const am = jetzt();
  const wohin = {
    gruppe: q.nach.gruppe,
    neueId: q.neueId,
    von: q.von.name,
    nach: q.nach.name,
    wer: q.wer,
    ich: q.ich.person,
    am,
  };
  const a = (await aufgabenWerte(q.von.ort)).find((w) => w.aufgabe.id === q.id)?.aufgabe ?? fehlt();
  const { neu } = verschieben(bearbeiten(a, q.x, q.ich.person, am), wohin);
  await aufgabeAendern(
    q.nach.ort,
    q.neueId,
    (v) => v,
    () => neu,
    q.ich,
  );
  try {
    await aufgabeAendern(
      q.von.ort,
      q.id,
      // Auf den frisch gelesenen Stand – dieselbe Regel wie oben (`verschieben(…).alt`); schon gelöscht = zweiter Versuch.
      (f) => (f.geloescht ? f : verschieben(f, wohin).alt),
      fehlt,
      q.ich,
    );
    return { hinweis: null };
  } catch {
    return {
      hinweis: `Das To-Do steht jetzt in „${q.nach.name}“ – in „${q.von.name}“ ließ es sich nicht entfernen. Bitte dort löschen.`,
    };
  }
}
