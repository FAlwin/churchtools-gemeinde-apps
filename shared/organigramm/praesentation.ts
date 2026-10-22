/**
 * **Die Präsentation** (Bauplan O4, abgenommen im Entwurf am 19.10.2026) – z. B. für die Mitgliederversammlung.
 *
 * - **Übersicht:** die Bereiche (oberste Gruppen) als Kacheln, in derselben Reihenfolge wie der Baum
 *   (`bereicheSortiert`), mit Leitung, Gruppen und Zahl der Personen.
 * - **Bereich:** seine Gruppen als Spalten. Jede Spalte listet jede Person ihres ganzen Teilbaums **einmal**
 *   (`teilbaumPersonen` – „unter Technik steht jeder Techniker einmal“); die Untergruppen stehen aufklappbar
 *   darunter, mit Pfad. Ein Bereich ohne Untergruppen ist selbst die einzige Spalte.
 *
 * Gezählt wird nur, was man sehen darf: Gruppen, deren Mitglieder ChurchTools nicht zeigt, fehlen in
 * `mitglieder` und tragen `sichtbar: false`. `vollstaendig` heißt: die Gruppe UND ihr ganzer Teilbaum sind lesbar –
 * nur dann darf die Oberfläche bei null Personen „gesucht“ sagen, sonst „nicht sichtbar“.
 * Nur „Heute“ (Alwin, 22.10.2026): „Neue Gliederung“ kommt mit dem Plan in O7.
 */
import { nachfahren, type Knoten } from './gruppen';
import { rollenRang, type Mitglied, type Rolle } from './mitglieder';
import { gruppenLeitung, gruppenPersonen, teilbaumPersonen } from './personen';

/** Große Bereiche zuerst (die meisten Gruppen darunter), dann nach Name – EINE Reihenfolge für Baum und Präsentation. */
export function bereicheSortiert(baum: readonly Knoten[]): Knoten[] {
  return [...baum].sort(
    (a, b) =>
      nachfahren(b).length - nachfahren(a).length ||
      a.gruppe.name.localeCompare(b.gruppe.name, 'de'),
  );
}

export interface PUntergruppe {
  knoten: Knoten;
  /** Gruppen zwischen Spalte und Untergruppe (ohne beide), für „Ton › Kurs“. */
  pfad: string[];
  personen: Mitglied[];
  sichtbar: boolean;
}

export interface PSpalte {
  knoten: Knoten;
  /** Jede Person des Teilbaums einmal – Leitung dieser Gruppe zuerst. */
  personen: Mitglied[];
  sichtbar: boolean;
  vollstaendig: boolean;
  unter: PUntergruppe[];
}

export interface PBereich {
  knoten: Knoten;
  leitung: Mitglied[];
  /** Personen im ganzen Bereich, jede einmal. */
  personen: number;
  sichtbar: boolean;
  vollstaendig: boolean;
  /** Die direkten Gruppen – oder der Bereich selbst, wenn er keine hat. */
  spalten: PSpalte[];
}

export interface Praesentation {
  bereiche: PBereich[];
  /** Gruppen direkt unter den Bereichen, zusammengezählt. */
  gruppen: number;
  /** Personen in allen Bereichen, jede einmal. */
  personen: number;
}

export function praesentationAus(
  baum: readonly Knoten[],
  mitglieder: ReadonlyMap<number, readonly Mitglied[]>,
  rollen: ReadonlyMap<number, Rolle>,
  name: (personId: number) => string,
): Praesentation {
  const rang = rollenRang(rollen);
  const eigene = (k: Knoten) => mitglieder.get(k.gruppe.id) ?? [];
  const sichtbar = (k: Knoten) => mitglieder.has(k.gruppe.id);
  const vollstaendig = (k: Knoten) =>
    sichtbar(k) && nachfahren(k).every((id) => mitglieder.has(id));

  const unterVon = (k: Knoten, pfad: string[]): PUntergruppe[] =>
    k.kinder.flatMap((c) => [
      { knoten: c, pfad, personen: gruppenPersonen(eigene(c), name, rang), sichtbar: sichtbar(c) },
      ...unterVon(c, [...pfad, c.gruppe.name]),
    ]);
  const spalte = (k: Knoten, mitUnter: boolean): PSpalte => ({
    knoten: k,
    personen: teilbaumPersonen(k, mitglieder, name, rang),
    sichtbar: sichtbar(k),
    vollstaendig: vollstaendig(k),
    unter: mitUnter ? unterVon(k, []) : [],
  });

  const alle = new Set<number>();
  const bereiche = bereicheSortiert(baum).map((b): PBereich => {
    const personen = teilbaumPersonen(b, mitglieder, name, rang);
    for (const p of personen) alle.add(p.personId);
    return {
      knoten: b,
      leitung: gruppenLeitung(eigene(b), rollen, name, rang),
      personen: personen.length,
      sichtbar: sichtbar(b),
      vollstaendig: vollstaendig(b),
      spalten: b.kinder.length ? b.kinder.map((c) => spalte(c, true)) : [spalte(b, false)],
    };
  });
  return {
    bereiche,
    gruppen: bereiche.reduce((n, b) => n + b.knoten.kinder.length, 0),
    personen: alle.size,
  };
}
