/**
 * **Namen im Transkript finden und durch Platzhalter ersetzen** (Bauplan S8, „Mit KI füllen“ Weg A).
 *
 * Entschieden 22.10.2026 (Alwin): Die Erweiterung **findet Personennamen selbst** und zeigt sie als Liste; je
 * Name entscheidet man per Häkchen, ob er ersetzt wird. Eigene Begriffe kann man ergänzen. Die Zuordnung
 * Platzhalter ↔ Name bleibt im Browser; beim Zurückholen werden die Namen wieder eingesetzt.
 *
 * Woher die Namen kommen (S0): `GET /persons?limit=500` liefert alle Personen, die man sehen darf (Live: Bereich
 * 1, 127 Personen). Gesucht wird
 * - nach **vollen Namen** aller dieser Personen,
 * - nach **Vornamen allein** nur bei Mitgliedern der Gruppe (sonst gäbe es zu viele falsche Treffer),
 * - nach Mustern wie „Familie Neumann“, „Herr Becker“, „Frau Wiens“.
 * Gefunden wird nur an Wortgrenzen (Umlaute zählen zum Wort), Groß-/Kleinschreibung wie im Text.
 */

export interface Person {
  id: number;
  vorname: string;
  nachname: string;
}

export interface Fund {
  /** So steht es im Text. */
  text: string;
  platzhalter: string;
  art: 'person' | 'vorname' | 'muster' | 'eigen';
  personId?: number;
  anzahl: number;
  /** Häkchen „ersetzen“ – vorbelegt mit ja. */
  ersetzen: boolean;
}

const RAND_VOR = '(?<![\\p{L}\\p{N}_])';
const RAND_NACH = '(?![\\p{L}\\p{N}_])';
const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wortRegex = (s: string): RegExp => new RegExp(`${RAND_VOR}${reEsc(s)}${RAND_NACH}`, 'gu');
const MUSTER =
  /(?<![\p{L}\p{N}_])(?:Familie|Fam\.|Ehepaar|Geschwister|Herrn?|Frau)\s+\p{Lu}[\p{Ll}ß]+(?:-\p{Lu}[\p{Ll}ß]+)?(?![\p{L}\p{N}_])/gu;

const voll = (p: Person): string => `${p.vorname.trim()} ${p.nachname.trim()}`.trim();

/**
 * **Alle Funde im Text**, in der Reihenfolge des ersten Auftretens nummeriert. Längere Funde gehen vor
 * (aus „Anna Klassen“ wird nicht zusätzlich „Anna“ gezählt). Ein Vorname allein bekommt denselben Platzhalter
 * wie die volle Person, wenn genau eine Person der Gruppe so heißt – sonst einen eigenen.
 */
export function namenFinden(
  text: string,
  personen: { alle: readonly Person[]; gruppe: readonly Person[] },
  eigene: readonly string[] = [],
): Fund[] {
  type Kandidat = { text: string; art: Fund['art']; personId?: number };
  const kandidaten = new Map<string, Kandidat>();
  const neu = (k: Kandidat): void => {
    if (k.text.trim() && !kandidaten.has(k.text)) kandidaten.set(k.text, k);
  };
  for (const e of eigene) neu({ text: e.trim(), art: 'eigen' });
  for (const p of personen.alle)
    if (p.vorname.trim() && p.nachname.trim())
      neu({ text: voll(p), art: 'person', personId: p.id });
  for (const m of text.matchAll(MUSTER)) neu({ text: m[0], art: 'muster' });
  const vornamen = new Map<string, Person[]>();
  for (const p of personen.gruppe) {
    const v = p.vorname.trim();
    if (v) vornamen.set(v, [...(vornamen.get(v) ?? []), p]);
  }
  for (const [v, ps] of vornamen)
    neu({ text: v, art: 'vorname', personId: ps.length === 1 ? ps[0].id : undefined });

  // Zählen von lang nach kurz auf einer Kopie, aus der Gezähltes entfernt wird.
  let rest = text;
  const zaehlung = new Map<string, { anzahl: number; erste: number }>();
  for (const k of [...kandidaten.values()].sort((a, b) => b.text.length - a.text.length)) {
    const re = wortRegex(k.text);
    let anzahl = 0;
    let erste = Infinity;
    rest = rest.replace(re, (treffer: string, pos: number) => {
      anzahl++;
      erste = Math.min(erste, pos);
      return '\u0000'.repeat(treffer.length);
    });
    if (anzahl) zaehlung.set(k.text, { anzahl, erste });
  }

  const gefunden = [...kandidaten.values()]
    .filter((k) => zaehlung.has(k.text))
    .sort((a, b) => zaehlung.get(a.text)!.erste - zaehlung.get(b.text)!.erste);

  const proPerson = new Map<number, string>();
  let nPerson = 0;
  let nEigen = 0;
  return gefunden.map((k) => {
    let platzhalter: string;
    if (k.art === 'eigen') platzhalter = `[Vertraulich ${++nEigen}]`;
    else if (k.personId !== undefined && proPerson.has(k.personId))
      platzhalter = proPerson.get(k.personId)!;
    else {
      platzhalter = `[Person ${++nPerson}]`;
      if (k.personId !== undefined) proPerson.set(k.personId, platzhalter);
    }
    return {
      text: k.text,
      platzhalter,
      art: k.art,
      ...(k.personId !== undefined ? { personId: k.personId } : {}),
      anzahl: zaehlung.get(k.text)!.anzahl,
      ersetzen: true,
    };
  });
}

/**
 * Die angehakten Funde ersetzen (lang vor kurz). `zuordnung`: Platzhalter → Text zum Zurücksetzen; teilen sich
 * Vor- und voller Name einen Platzhalter, gilt der volle Name.
 */
export function platzhalterAnwenden(
  text: string,
  funde: readonly Fund[],
): { text: string; zuordnung: Record<string, string> } {
  const aktiv = funde.filter((f) => f.ersetzen).sort((a, b) => b.text.length - a.text.length);
  let out = text;
  const zuordnung: Record<string, string> = {};
  for (const f of aktiv) {
    out = out.replace(wortRegex(f.text), f.platzhalter);
    const bisher = zuordnung[f.platzhalter];
    if (bisher === undefined || f.text.length > bisher.length) zuordnung[f.platzhalter] = f.text;
  }
  return { text: out, zuordnung };
}

/** Platzhalter in der Antwort der KI wieder durch die Namen ersetzen. Unbekannte Platzhalter bleiben stehen. */
export function zuruecksetzen(text: string, zuordnung: Readonly<Record<string, string>>): string {
  return text.replace(/\[(?:Person|Vertraulich) \d+\]/g, (p) => zuordnung[p] ?? p);
}
