/**
 * **Große Werte in Teilen speichern** – die eine Stelle für alles, was länger ist als ein Wert des Erweiterungs-Speichers
 * (höchstens `MAX_ZEICHEN` = 10.000 Zeichen, gemessen). Stand bis 20.11.2026 nur in `shared/protokolle/speicher.ts`; die
 * Website braucht dieselbe Aufteilung für ihre Seiten (Bauplan Website W3a-1). Hier steht nur, WIE geteilt und wieder
 * zusammengesetzt wird – was ein Teil sonst noch trägt (`art`, `fassung`, Verweis auf Sitzung bzw. Seite) und wie der Kopf
 * aussieht, bestimmt die Anwendung (Protokolle, Website).
 *
 * Aufbau: Der Inhalt (als Text) wird gepackt (deflate + Base64url, `packen.ts`), in Stücke von `TEIL_ZEICHEN` geschnitten
 * und je Stück in eine Hülle gelegt. Der **Stand** ist die Prüfsumme des Klartexts; der Kopf trägt ihn, jeder Teil auch –
 * so gehört beim Lesen nur dazu, was zum Kopf passt (ein abgebrochenes Speichern lässt immer einen vollständigen Stand
 * zurück). **Die Reihenfolge beim Schreiben ist Sache des Aufrufers:** neue Teile → nachlesen → Kopf umstellen → nachlesen
 * → alte Teile löschen.
 */
import { MAX_ZEICHEN } from './modulDaten';
import { textEntpacken, textPacken } from './packen';

/** Wie lang das gepackte Stück in einem Teil sein darf – Platz für die Hülle bleibt (`teileBauen` prüft das). */
export const TEIL_ZEICHEN = 9_500;

/** FNV-1a über den Text – reicht, um „ist das derselbe Stand?“ zu beantworten (kein Schutz gegen Absicht). */
export function pruefsumme(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Was jeder Teil trägt, egal wofür. */
export interface TeilStueck {
  stand: string;
  nr: number;
  von: number;
  daten: string;
}

/**
 * Den Text als Teil-Werte (fertige Texte für `customdatavalues`) und den Stand für den Kopf. `huelle` macht aus einem
 * Stück das JSON-Objekt, das gespeichert wird (mit den Feldern der Anwendung). Wirft, wenn ein Teil die Grenze sprengen
 * würde – das darf nie still passieren; `was` steht in der Meldung („Ein Protokoll-Teil“).
 */
export function teileBauen(
  text: string,
  huelle: (stueck: TeilStueck) => object,
  was: string,
): { stand: string; werte: string[] } {
  const stand = pruefsumme(text);
  const code = textPacken(text);
  const stuecke: string[] = [];
  for (let i = 0; i < code.length; i += TEIL_ZEICHEN) stuecke.push(code.slice(i, i + TEIL_ZEICHEN));
  if (!stuecke.length) stuecke.push('');
  const werte = stuecke.map((daten, nr) =>
    JSON.stringify(huelle({ stand, nr, von: stuecke.length, daten })),
  );
  const zuLang = werte.find((w) => w.length > MAX_ZEICHEN);
  if (zuLang) throw new Error(`${was} hätte ${zuLang.length} Zeichen (höchstens ${MAX_ZEICHEN}).`);
  return { stand, werte };
}

/**
 * **Der Text zum Stand** aus den gelesenen Teilen. `null`, wenn Teile fehlen, zu einem anderen Stand gehören oder kaputt
 * sind – der Aufrufer liest dann neu oder meldet es; er nimmt nie einen halben Stand. Die Teile müssen schon zum richtigen
 * Besitzer gehören (gleiche Sitzung bzw. Seite) – das filtert der Aufrufer, hier zählt nur der Stand.
 */
export function textAusTeilen(stand: string, teile: readonly TeilStueck[]): string | null {
  // Gleicher Stand heißt gleicher Inhalt: Liegt ein Teil doppelt da (ein früheres Speichern mit demselben Text, dessen
  // Aufräumen scheiterte), zählt er einmal – sonst wäre der Inhalt unlesbar, bis jemand von Hand aufräumt.
  const jeNr = new Map<number, TeilStueck>();
  for (const t of teile) if (t.stand === stand && !jeNr.has(t.nr)) jeNr.set(t.nr, t);
  const passend = [...jeNr.values()].sort((a, b) => a.nr - b.nr);
  if (!passend.length) return null;
  const anzahl = passend[0].von;
  if (passend.length !== anzahl || passend.some((t, i) => t.nr !== i || t.von !== anzahl))
    return null;
  try {
    const text = textEntpacken(passend.map((t) => t.daten).join(''));
    return pruefsumme(text) === stand ? text : null;
  } catch {
    return null;
  }
}
