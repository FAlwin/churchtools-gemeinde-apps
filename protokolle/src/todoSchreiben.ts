/**
 * **Ein To-Do aus dem Fenster „To-Do“ schreiben** (Bauplan S7-2a) – ändern, neu anlegen, als gelöscht vermerken, in eine
 * andere Gruppe verschieben. Die Regeln stehen in `@shared/protokolle/aufgaben` (`bearbeiten`, `verschieben`); gelesen
 * und geschrieben wird über `aufgabeAendern` (frisch lesen, schreiben, nachlesen – ein `201` ist kein Beleg).
 *
 * Ein neues To-Do bekommt seine ID schon beim Öffnen des Fensters (`neueId`): Kommt die Antwort unklar zurück und wird
 * noch einmal gespeichert, findet `aufgabeAendern` es vor und legt kein zweites an. Dasselbe beim Verschieben.
 */
import {
  aenderungVerboten,
  alsGeloescht,
  anlegenVerboten,
  bearbeiten,
  neueAufgabe,
  toDoRechte,
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

/** Verweigerung als 409 mit dem Satz – `fehlerMeldung` zeigt ihn, statt „ChurchTools antwortet gerade nicht“. */
const verweigern = (grund: string | null): void => {
  if (grund) throw new ApiError(409, grund);
};

/**
 * Ändern – `x` enthält nur, was im Fenster angefasst wurde; angewendet auf den frisch gelesenen Stand. **Die Rechte gelten
 * hier im Schreibweg, nicht nur in der Oberfläche** (W8a: eigener Teil bei „Jeder für sich“, W9a: Mitarbeiter ändern nur,
 * was `toDoRechte` ihnen gibt – `aenderungVerboten`, geprüft am frisch gelesenen Stand). `leitung` = schreibt Protokolle in
 * dieser Gruppe; ohne Angabe gilt: Mitarbeiter. `imEntwurf`: das To-Do steht noch in einem Protokoll-Entwurf. ChurchTools
 * selbst kennt dafür kein Recht.
 */
export function toDoAendern(
  ort: MitarbeitOrt,
  id: string,
  x: ToDoAenderung,
  ich: Schreibend,
  leitung = false,
  imEntwurf = false,
): Promise<Aufgabe> {
  return aufgabeAendern(
    ort,
    id,
    (a) => {
      verweigern(aenderungVerboten(a, x, { ich: ich.person, leitung, imEntwurf }));
      return bearbeiten(a, x, ich.person, jetzt());
    },
    fehlt,
    ich,
  );
}

/** Neu anlegen (ohne Sitzung). Gibt es `neueId` schon (zweiter Versuch), bleibt es, wie es ist. */
export async function toDoAnlegen(
  ort: MitarbeitOrt,
  q: {
    neueId: string;
    gruppe: number;
    text: string;
    wer: number[];
    extern: string;
    bis: string | null;
    status: AufgabenStatus;
    /** „Jeder für sich“ (nur ab zwei Zuständigen wirksam). */
    jeder?: boolean;
    teile?: { person: number; fertig: boolean }[];
    notiz: string;
    karte: { notiz?: boolean; sitzung?: boolean };
  },
  ich: Schreibend,
  leitung = false,
): Promise<Aufgabe> {
  verweigern(anlegenVerboten(q, { ich: ich.person, leitung }));
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
    { status: q.status, jeder: q.jeder, teile: q.teile, notiz: q.notiz, karte: q.karte },
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

/**
 * Als gelöscht vermerken – nie hart gelöscht (wer in „Mitarbeit“ schreibt, dürfte sonst jeden Wert löschen). Ein Mitarbeiter
 * löscht nur eigene To-Dos, die nicht mehr im Protokoll-Entwurf stehen (`toDoRechte`); `leitung` ohne Angabe = Mitarbeiter.
 */
export async function toDoLoeschen(
  ort: MitarbeitOrt,
  id: string,
  ich: Schreibend,
  leitung = false,
  imEntwurf = false,
): Promise<void> {
  await aufgabeAendern(
    ort,
    id,
    (a) => {
      if (!toDoRechte(a, { ich: ich.person, leitung, imEntwurf }).loeschen)
        throw new ApiError(409, 'Dieses To-Do löscht nur die Leitung.');
      return alsGeloescht(a, ich.person, jetzt());
    },
    fehlt,
    ich,
  );
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
  /** Leitung der Gruppe, **aus der** das To-Do kommt – in eine andere Gruppe verschiebt nur sie (`toDoRechte.gruppe`). */
  leitung?: boolean;
}): Promise<{ hinweis: string | null }> {
  if (!q.leitung) throw new ApiError(409, 'In eine andere Gruppe verschiebt nur die Leitung.');
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
