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
import { erledigtAm, gruppieren, type Aufgabe, type ToDoAenderung } from './aufgaben';

export type Einteilung = 'status' | 'person';
/** Liste oder Board (S7-3). */
export type Ansicht = 'liste' | 'board';
/** Wie innerhalb eines Bereichs bzw. einer Spalte sortiert wird (S7-3, eine Wahl für alles). */
export type Sortierung = 'dringlichkeit' | 'bis' | 'alpha' | 'manuell';

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

/** Der Schlüssel eines To-Dos in der Übersicht (eine ID kann es in zwei Gruppen geben). */
export const eintragSchluessel = (e: ToDoEintrag): string => `${e.gruppe.id}:${e.aufgabe.id}`;

/** Eine Spalte im **Board** (S7-3). `nimmtAn: false` – dort kann man nichts ablegen („Außerhalb der Gruppe“). */
export interface Spalte {
  schluessel: string;
  titel: string;
  art: 'offen' | 'arbeit' | 'erledigt' | 'person' | 'extern' | 'ohne';
  /** Bei `person`: wer. */
  person?: number;
  nimmtAn: boolean;
  eintraege: ToDoEintrag[];
}

/**
 * **Die Spalten des Boards** (Entwurf v2): nach Status immer Offen · In Arbeit · Erledigt (auch leer – man muss dort
 * ablegen können; Überfällige stehen in ihrer Status-Spalte), nach Person je Person (ich zuerst; dazu `mitglieder`, auch
 * ohne To-Do), „Außerhalb der Gruppe“ (nur wenn belegt, nimmt nichts an) und immer „Noch niemand zuständig“. Innerhalb
 * die Reihenfolge von `gruppieren` (Dringlichkeit) – `sortieren` ordnet danach um.
 */
export function spalten(
  liste: readonly ToDoEintrag[],
  q: {
    nach: Einteilung;
    heute: string;
    ich: number;
    namen: ReadonlyMap<number, string>;
    mitglieder?: readonly number[];
  },
): Spalte[] {
  const zu = new Map(liste.map((e) => [e.aufgabe, e]));
  const g = gruppieren(
    liste.map((e) => e.aufgabe),
    q.heute,
  );
  const reihe = [...g.ueberfaellig, ...g.arbeit, ...g.offen, ...g.erledigt].map((a) => zu.get(a)!);
  if (q.nach === 'status')
    return (['offen', 'arbeit', 'erledigt'] as const).map((st) => ({
      schluessel: st,
      titel: st === 'offen' ? 'Offen' : st === 'arbeit' ? 'In Arbeit' : 'Erledigt',
      art: st,
      nimmtAn: true,
      eintraege: reihe.filter((e) => e.aufgabe.status === st),
    }));
  const name = (p: number) => q.namen.get(p) ?? `Person ${p}`;
  const personen = [
    ...new Set([...reihe.flatMap((e) => e.aufgabe.wer), ...(q.mitglieder ?? [])]),
  ].sort((x, y) => (x === q.ich ? -1 : y === q.ich ? 1 : name(x).localeCompare(name(y), 'de')));
  const extern = reihe.filter((e) => !e.aufgabe.wer.length && e.aufgabe.extern.trim());
  return [
    ...personen.map(
      (p): Spalte => ({
        schluessel: `p${p}`,
        titel: p === q.ich ? `${name(p)} (du)` : name(p),
        art: 'person',
        person: p,
        nimmtAn: true,
        eintraege: reihe.filter((e) => e.aufgabe.wer.includes(p)),
      }),
    ),
    ...(extern.length
      ? [
          {
            schluessel: 'extern',
            titel: 'Außerhalb der Gruppe',
            art: 'extern',
            nimmtAn: false,
            eintraege: extern,
          } satisfies Spalte,
        ]
      : []),
    {
      schluessel: 'ohne',
      titel: 'Noch niemand zuständig',
      art: 'ohne',
      nimmtAn: true,
      eintraege: reihe.filter((e) => ohneZustaendige(e.aufgabe)),
    },
  ];
}

/**
 * **Was das Ablegen in einer anderen Spalte ändert** (S7-3): nach Status den Status; nach Person **nur die gezogene**
 * Person tauschen (Alwin) – aus „Noch niemand“ kommt jemand dazu, nach „Noch niemand“ fällt die gezogene weg. `null`:
 * nichts zu tun (gleiche Spalte, nimmt nichts an, schon so).
 */
export function ablegen(a: Aufgabe, von: Spalte, nach: Spalte): ToDoAenderung | null {
  if (von.schluessel === nach.schluessel || !nach.nimmtAn) return null;
  if (nach.art === 'offen' || nach.art === 'arbeit' || nach.art === 'erledigt')
    return a.status === nach.art ? null : { status: nach.art };
  const ohne = von.person === undefined ? a.wer : a.wer.filter((p) => p !== von.person);
  const wer =
    nach.person === undefined || ohne.includes(nach.person) ? ohne : [...ohne, nach.person];
  return wer.length === a.wer.length && wer.every((p) => a.wer.includes(p)) ? null : { wer };
}

/**
 * **Innerhalb eines Bereichs bzw. einer Spalte sortieren** (S7-3). Die Eingabe kommt nach Dringlichkeit (`gruppieren`);
 * `bis`: nach Fälligkeit (ohne Datum zuletzt), Erledigte nach „erledigt am“ (neueste zuerst); `alpha`: nach Text;
 * `manuell`: nach meiner Reihenfolge (`reihenfolge`, Schlüssel aus `eintragSchluessel`) – Neue ans Ende, unter sich nach
 * Dringlichkeit. Bei Gleichstand bleibt die Dringlichkeit.
 */
export function sortieren(
  liste: readonly ToDoEintrag[],
  q: { art: Sortierung; reihenfolge?: readonly string[] },
): ToDoEintrag[] {
  const dringlich = new Map(liste.map((e, i) => [e, i]));
  const nachDringlichkeit = (x: ToDoEintrag, y: ToDoEintrag) =>
    dringlich.get(x)! - dringlich.get(y)!;
  const kopie = [...liste];
  if (q.art === 'alpha')
    return kopie.sort(
      (x, y) =>
        x.aufgabe.text.localeCompare(y.aufgabe.text, 'de', { sensitivity: 'base' }) ||
        nachDringlichkeit(x, y),
    );
  if (q.art === 'bis') {
    const wann = (e: ToDoEintrag) =>
      e.aufgabe.status === 'erledigt' ? null : (e.aufgabe.bis ?? '9999-99-99');
    return kopie.sort((x, y) => {
      const a = wann(x);
      const b = wann(y);
      if (a === null && b === null)
        return (
          (erledigtAm(y.aufgabe) ?? '').localeCompare(erledigtAm(x.aufgabe) ?? '') ||
          nachDringlichkeit(x, y)
        );
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b) || nachDringlichkeit(x, y);
    });
  }
  if (q.art === 'manuell') {
    const platz = new Map((q.reihenfolge ?? []).map((k, i) => [k, i]));
    const p = (e: ToDoEintrag) => platz.get(eintragSchluessel(e)) ?? Number.MAX_SAFE_INTEGER;
    return kopie.sort((x, y) => p(x) - p(y) || nachDringlichkeit(x, y));
  }
  return kopie;
}

/**
 * **Meine Reihenfolge nach einem Umsortieren** (S7-3, „Manuell“): `spalte` = die Schlüssel der Spalte, wie sie gerade
 * zu sehen sind; `gezogen` kommt vor `vor` (`null` = ans Ende). Die Reihenfolge ist **eine** Liste über alle Spalten –
 * so gilt sie in Liste und Board, nach Status wie nach Person; die Spalte rückt an die Stelle ihres ersten Eintrags.
 */
export function umordnen(
  reihenfolge: readonly string[],
  spalte: readonly string[],
  gezogen: string,
  vor: string | null,
): string[] {
  const ohne = spalte.filter((k) => k !== gezogen);
  const i = vor === null ? -1 : ohne.indexOf(vor);
  const neu = i < 0 ? [...ohne, gezogen] : [...ohne.slice(0, i), gezogen, ...ohne.slice(i)];
  const drin = new Set(spalte);
  const erster = reihenfolge.findIndex((k) => drin.has(k));
  const rest = reihenfolge.filter((k) => !drin.has(k));
  const an =
    erster < 0 ? rest.length : reihenfolge.slice(0, erster).filter((k) => !drin.has(k)).length;
  return [...rest.slice(0, an), ...neu, ...rest.slice(an)];
}
