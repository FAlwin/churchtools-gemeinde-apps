/**
 * **Die To-Do-Übersicht** (Bauplan S7, entschieden 30.10.2026; Entwurf `protokolle-planung/entwurf/s7-todos-v2.html`) –
 * wer welche To-Dos sieht und wie sie eingeteilt werden. Ohne ChurchTools; gelesen wird in `protokolle/src/lesen.ts`.
 *
 * - **Sicht:** Die Leitung sieht alle To-Dos ihrer Gruppen, Mitglieder ihre eigenen und die der Gruppe ohne Zuständigen
 *   (Alwin, Frage 2). Ein To-Do, das jemand angelegt, aber nur anderen gegeben hat, sieht er danach nicht (Frage 3).
 * - **Einteilung:** nach Status (überfällig, in Arbeit, offen, erledigt – wie `gruppieren`) oder nach Person (ich zuerst,
 *   dann nach Namen; „Außerhalb der Gruppe“, „Noch niemand zuständig“). In jedem Bereich die Reihenfolge von
 *   `gruppieren` – das Dringendste oben.
 * - **Erledigte:** die der letzten 30 Tage; ältere nur auf Wunsch (Filter).
 */
import { plusTage } from '../ct/datum';
import { erledigtAm, gruppieren, type Aufgabe } from './aufgaben';

export type Einteilung = 'status' | 'person';

/** Ein To-Do mit seiner Gruppe – die Übersicht mischt mehrere Gruppen. */
export interface ToDoEintrag {
  aufgabe: Aufgabe;
  gruppe: { id: number; name: string };
}

export interface Bereich {
  schluessel: string;
  titel: string;
  art: 'ueberfaellig' | 'arbeit' | 'offen' | 'erledigt' | 'person' | 'extern' | 'ohne';
  eintraege: ToDoEintrag[];
}

/** Wie lange Erledigte ohne Filter zu sehen sind. */
export const ERLEDIGT_TAGE = 30;

const ohneZustaendige = (a: Aufgabe): boolean => a.wer.length === 0 && !a.extern.trim();

/** **Sieht diese Person das To-Do?** Gelöschte nie; die Leitung alle; Mitglieder eigene und solche ohne Zuständigen. */
export function sichtbarFuer(a: Aufgabe, q: { ich: number; leitung: boolean }): boolean {
  if (a.geloescht) return false;
  return q.leitung || a.wer.includes(q.ich) || ohneZustaendige(a);
}

export type Zustaendig = 'ich' | 'andere' | 'niemand';

/**
 * **Was statt der Sitzung dasteht**, wenn sie nicht in der geladenen Übersicht ist: ohne Sitzung angelegt – oder aus einer
 * älteren, die die Übersicht nicht mehr lädt (vorher stand auch dann „Ohne Sitzung angelegt.“). Karte und Fenster gleich.
 */
export function ohneHerkunft(a: Pick<Aufgabe, 'sitzung'>): string {
  return a.sitzung === null ? 'Ohne Sitzung angelegt.' : 'Aus einer älteren Sitzung.';
}

/** Für den Filter „Zuständig“: ich (auch zusammen mit anderen), nur andere (auch Externe), noch niemand. */
export function zustaendigFuer(a: Aufgabe, ich: number): Zustaendig {
  if (a.wer.includes(ich)) return 'ich';
  return ohneZustaendige(a) ? 'niemand' : 'andere';
}

/** **Länger als 30 Tage erledigt?** `heute` als `JJJJ-MM-TT`. Ohne bekannten Zeitpunkt zählt es als alt. */
export function langeErledigt(a: Aufgabe, heute: string): boolean {
  if (a.status !== 'erledigt') return false;
  const am = erledigtAm(a);
  return am === null || am.slice(0, 10) < plusTage(heute, -ERLEDIGT_TAGE);
}

/**
 * **In Bereiche einteilen.** `namen` sind die bekannten Namen (Person-ID → Name); wer fehlt, heißt „Person <ID>“.
 * Leere Bereiche fallen weg.
 */
export function einteilen(
  liste: readonly ToDoEintrag[],
  q: { nach: Einteilung; heute: string; ich: number; namen: ReadonlyMap<number, string> },
): Bereich[] {
  const zu = new Map(liste.map((e) => [e.aufgabe, e]));
  const g = gruppieren(
    liste.map((e) => e.aufgabe),
    q.heute,
  );
  const rein = (x: Aufgabe[]) => x.map((a) => zu.get(a)!);
  if (q.nach === 'status')
    return (
      [
        {
          schluessel: 'ueberfaellig',
          titel: 'Überfällig',
          art: 'ueberfaellig',
          eintraege: rein(g.ueberfaellig),
        },
        { schluessel: 'arbeit', titel: 'In Arbeit', art: 'arbeit', eintraege: rein(g.arbeit) },
        { schluessel: 'offen', titel: 'Offen', art: 'offen', eintraege: rein(g.offen) },
        { schluessel: 'erledigt', titel: 'Erledigt', art: 'erledigt', eintraege: rein(g.erledigt) },
      ] satisfies Bereich[]
    ).filter((b) => b.eintraege.length);

  const reihe = rein([...g.ueberfaellig, ...g.arbeit, ...g.offen, ...g.erledigt]);
  const name = (p: number) => q.namen.get(p) ?? `Person ${p}`;
  const personen = [...new Set(reihe.flatMap((e) => e.aufgabe.wer))].sort((x, y) =>
    x === q.ich ? -1 : y === q.ich ? 1 : name(x).localeCompare(name(y), 'de'),
  );
  return (
    [
      ...personen.map(
        (p): Bereich => ({
          schluessel: `p${p}`,
          titel: p === q.ich ? `${name(p)} (du)` : name(p),
          art: 'person',
          eintraege: reihe.filter((e) => e.aufgabe.wer.includes(p)),
        }),
      ),
      {
        schluessel: 'extern',
        titel: 'Außerhalb der Gruppe',
        art: 'extern',
        eintraege: reihe.filter((e) => !e.aufgabe.wer.length && e.aufgabe.extern.trim()),
      },
      {
        schluessel: 'ohne',
        titel: 'Noch niemand zuständig',
        art: 'ohne',
        eintraege: reihe.filter((e) => ohneZustaendige(e.aufgabe)),
      },
    ] satisfies Bereich[]
  ).filter((b) => b.eintraege.length);
}
