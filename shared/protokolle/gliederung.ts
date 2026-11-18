/**
 * **Die Gliederung des Protokolls und das Umordnen ihrer Punkte** (Bauplan W7, Alwin 18.11.2026) – die Regel ohne
 * Editor, getestet. Das Fenster „Punkte ordnen“ zeigt `gliederung` und stellt mit `punktVerschieben` um; erst
 * „Übernehmen“ bringt die neue Reihenfolge in den Editor.
 *
 * Entschieden 18.11.2026 (Alwin, Entwurf `punkte-ordnen-v1`, Variante A):
 * - **Ein Punkt nimmt Unterpunkte und allen Inhalt mit** – sein Abschnitt, gerechnet mit `abschnittEnde`
 *   (`abschnitte.ts`, die eine Abschnitt-Regel; hier steht keine zweite). Eine „Überschrift“ (Rang 6) wird nicht
 *   gelistet, sie wandert mit ihrem Abschnitt.
 * - **Die Ebene bleibt:** Ein Unterpunkt wird nur unter seinem Punkt umgestellt, ein Tagesordnungspunkt nur zwischen
 *   Tagesordnungspunkten. Ob das gilt, wird am Ergebnis geprüft (Eltern und Tiefe aller Punkte nach `ableiten`) – nicht
 *   daran, dass der Aufrufer sich brav hielt. So kann auch ein ungewöhnlich gebautes Dokument (Unterpunkte
 *   verschiedener Stufe nebeneinander) keinen Punkt versehentlich in einen anderen hängen: Dann gibt es den Schritt
 *   nicht (`null`).
 * - **Inhalt vor dem ersten Tagesordnungspunkt bleibt oben stehen** – er gehört zu keinem Punkt.
 * - Die **Nummern** kommen aus `ableiten`/`punktNummer`, also dieselbe Zählung wie im Text, in der Lese-Ansicht und in
 *   den Bereichen.
 */
import { abschnittEnde, abschnittVerschoben } from './abschnitte';
import { ableiten, BLOCK, punktNummer, textAus, type Block } from './dokument';

/** Ein Punkt der Gliederung – Tagesordnungspunkt oder Unterpunkt, mit seinen Unterpunkten darunter. */
export interface GliederungsPunkt {
  /** Block-ID der Überschrift. */
  id: string;
  /** So, wie sie im Text steht: `4.` beim Tagesordnungspunkt, `4.1` beim Unterpunkt. */
  nummer: string;
  /** 0 = Tagesordnungspunkt, 1–4 = Ebene des Unterpunkts. */
  tiefe: number;
  titel: string;
  /** Hat einen festen Punkt (Anwesenheit, offene To-Dos, früheres Protokoll) im Inhalt. */
  fest: boolean;
  /** Was mitwandert, in einer Zeile: „3 Stichpunkte · 1 To-Do · 2 Unterpunkte“. */
  mit: string;
  kinder: GliederungsPunkt[];
}

const wort = (n: number, eins: string, viele: string): string => `${n} ${n === 1 ? eins : viele}`;

interface Zaehler {
  stichpunkte: number;
  absaetze: number;
  tabellen: number;
  beschluesse: number;
  todos: number;
  termine: number;
  anwesenheit: boolean;
  fest: boolean;
}

/** Zählt die Blöcke samt ihren eingerückten Unterblöcken. Leere Listenzeilen und Absätze sind kein Inhalt. */
function zaehle(bloecke: readonly Block[], z: Zaehler): void {
  for (const b of bloecke) {
    const hatText = textAus(b.content).trim() !== '';
    if (b.type === 'bulletListItem' || b.type === 'numberedListItem' || b.type === 'checkListItem')
      z.stichpunkte += hatText ? 1 : 0;
    else if (b.type === 'paragraph' || b.type === 'quote') z.absaetze += hatText ? 1 : 0;
    else if (b.type === 'table') z.tabellen++;
    else if (b.type === BLOCK.beschluss) z.beschluesse++;
    else if (b.type === BLOCK.aufgabe) z.todos++;
    else if (b.type === BLOCK.termin) z.termine++;
    else if (b.type === BLOCK.verweis) {
      z.fest = true;
      if (b.props?.art === 'anwesenheit') z.anwesenheit = true;
    }
    zaehle(b.children ?? [], z);
  }
}

/** „3 Stichpunkte · 1 To-Do · 2 Unterpunkte“ – was mit dem Punkt wandert (`fest`: ein fester Punkt steckt darin). */
function mitText(inhalt: readonly Block[], unterpunkte: number): { mit: string; fest: boolean } {
  const z: Zaehler = {
    stichpunkte: 0,
    absaetze: 0,
    tabellen: 0,
    beschluesse: 0,
    todos: 0,
    termine: 0,
    anwesenheit: false,
    fest: false,
  };
  zaehle(inhalt, z);
  const teile: string[] = [];
  if (z.fest) teile.push('fester Punkt');
  if (z.anwesenheit) teile.push('Anwesenheitsliste');
  if (z.stichpunkte) teile.push(wort(z.stichpunkte, 'Stichpunkt', 'Stichpunkte'));
  if (z.beschluesse) teile.push(wort(z.beschluesse, 'Beschluss', 'Beschlüsse'));
  if (z.todos) teile.push(wort(z.todos, 'To-Do', 'To-Dos'));
  if (z.termine) teile.push(wort(z.termine, 'Termin', 'Termine'));
  if (z.absaetze) teile.push(wort(z.absaetze, 'Absatz', 'Absätze'));
  if (z.tabellen) teile.push(wort(z.tabellen, 'Tabelle', 'Tabellen'));
  if (unterpunkte) teile.push(wort(unterpunkte, 'Unterpunkt', 'Unterpunkte'));
  return { mit: teile.join(' · ') || 'noch ohne Inhalt', fest: z.fest };
}

/**
 * **Die Gliederung aus dem Dokument** (oberste Ebene): die Tagesordnungspunkte mit ihren Unterpunkten darunter, so
 * gezählt wie überall (`ableiten`). Der Inhalt eines Punkts ist alles bis zum nächsten Punkt oder Unterpunkt.
 */
export function gliederung(bloecke: readonly Block[]): GliederungsPunkt[] {
  const punkte = ableiten(bloecke).punkte;
  const stelle = new Map(bloecke.map((b, i) => [b.id, i]));
  const wurzeln: GliederungsPunkt[] = [];
  const pfad: GliederungsPunkt[] = [];
  const knoten: { punkt: GliederungsPunkt; inhalt: Block[] }[] = [];
  punkte.forEach((p, i) => {
    const von = (stelle.get(p.blockId) ?? 0) + 1;
    const bis = i + 1 < punkte.length ? (stelle.get(punkte[i + 1].blockId) ?? von) : bloecke.length;
    const punkt: GliederungsPunkt = {
      id: p.blockId,
      nummer: punktNummer(p),
      tiefe: p.tiefe,
      titel: p.titel,
      fest: false,
      mit: '',
      kinder: [],
    };
    pfad.length = p.tiefe;
    (pfad[p.tiefe - 1]?.kinder ?? wurzeln).push(punkt);
    pfad[p.tiefe] = punkt;
    knoten.push({ punkt, inhalt: bloecke.slice(von, bis) });
  });
  // Erst jetzt sind die Unterpunkte da, die in der Zeile mitgezählt werden.
  for (const { punkt, inhalt } of knoten) {
    const { mit, fest } = mitText(inhalt, punkt.kinder.length);
    punkt.mit = mit;
    punkt.fest = fest;
  }
  return wurzeln;
}

/** Die Geschwister eines Punkts (er selbst eingeschlossen) und sein Platz darunter – `null`, wenn es ihn nicht gibt. */
export function geschwisterVon(
  baum: readonly GliederungsPunkt[],
  id: string,
): { liste: readonly GliederungsPunkt[]; index: number } | null {
  const i = baum.findIndex((k) => k.id === id);
  if (i >= 0) return { liste: baum, index: i };
  for (const k of baum) {
    const r = geschwisterVon(k.kinder, id);
    if (r) return r;
  }
  return null;
}

/** Gibt es etwas zu ordnen – mindestens zwei Punkte unter demselben Punkt (oder zwei Tagesordnungspunkte)? */
export function gibtZuOrdnen(bloecke: readonly Block[]): boolean {
  const pruefen = (liste: readonly GliederungsPunkt[]): boolean =>
    liste.length >= 2 || liste.some((k) => pruefen(k.kinder));
  return pruefen(gliederung(bloecke));
}

/** Eltern jedes Punkts (`null` beim Tagesordnungspunkt) und seine Tiefe – zum Vergleichen vorher/nachher. */
function aufbau(
  baum: readonly GliederungsPunkt[],
): Map<string, { eltern: string | null; tiefe: number }> {
  const m = new Map<string, { eltern: string | null; tiefe: number }>();
  const lauf = (liste: readonly GliederungsPunkt[], eltern: string | null): void => {
    for (const k of liste) {
      m.set(k.id, { eltern, tiefe: k.tiefe });
      lauf(k.kinder, k.id);
    }
  };
  lauf(baum, null);
  return m;
}

/** Ein Schritt im Fenster: die neuen Blöcke und der Satz, der sagt, was passiert ist. */
export interface Umordnung<T extends Block> {
  bloecke: T[];
  hinweis: string;
}

/**
 * **Einen Punkt umstellen:** `neuerIndex` ist sein Platz unter seinen Geschwistern danach (0 = als Erster). Der Punkt
 * nimmt seinen Abschnitt mit (`abschnittVerschoben`). `null`, wenn sich nichts ändert (derselbe Platz, außerhalb der
 * Geschwister) oder die Ebene nicht bliebe.
 */
export function punktVerschieben<T extends Block>(
  bloecke: readonly T[],
  id: string,
  neuerIndex: number,
): Umordnung<T> | null {
  const alt = gliederung(bloecke);
  const g = geschwisterVon(alt, id);
  if (!g || neuerIndex === g.index || neuerIndex < 0 || neuerIndex >= g.liste.length) return null;
  const stelle = new Map(bloecke.map((b, i) => [b.id, i]));
  const start = stelle.get(id);
  if (start === undefined) return null;
  const andere = g.liste.filter((k) => k.id !== id);
  const ziel =
    neuerIndex < andere.length
      ? stelle.get(andere[neuerIndex].id)
      : abschnittEnde(bloecke, stelle.get(andere[andere.length - 1].id) ?? start);
  if (ziel === undefined) return null;
  const neu = abschnittVerschoben(bloecke, start, ziel);

  // Die Ebene bleibt: dieselben Eltern und dieselbe Tiefe für ALLE Punkte, und der Punkt steht an seinem Platz.
  const nach = gliederung(neu);
  const erwartet = [...andere.map((k) => k.id)];
  erwartet.splice(neuerIndex, 0, id);
  const gn = geschwisterVon(nach, id);
  const vorher = aufbau(alt);
  const danach = aufbau(nach);
  const gleich =
    gn !== null &&
    gn.liste.map((k) => k.id).join('\n') === erwartet.join('\n') &&
    vorher.size === danach.size &&
    [...vorher].every(([k, v]) => {
      const d = danach.get(k);
      return d?.eltern === v.eltern && d.tiefe === v.tiefe;
    });
  if (!gleich || !gn) return null;

  const knoten = gn.liste[gn.index];
  const titel = knoten.titel.trim() || 'Punkt';
  return {
    bloecke: neu,
    hinweis: `„${titel}“ ${neuerIndex < g.index ? 'nach oben' : 'nach unten'} verschoben (jetzt ${knoten.nummer})`,
  };
}
