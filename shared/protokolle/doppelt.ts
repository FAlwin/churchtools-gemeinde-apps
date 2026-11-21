/**
 * **Steht das schon da?** (W12, „Mit KI füllen“) – ein vorgeschlagener Stichpunkt, der inhaltlich einer Zeile entspricht,
 * die schon im Protokoll steht. Eine Regel, ein Ort: `ki.ts` ruft nur `aehnlicheZeile`, die Vorschau markiert den
 * Stichpunkt damit als „steht schon da“ und wählt ihn ab.
 *
 * Verglichen werden **Wortmengen**, nicht Zeichenfolgen: Groß-/Kleinschreibung, Satzzeichen, Umlaut-Schreibweise und
 * Füllwörter (der, die, und, in, am …) spielen keine Rolle, und die Wörter werden auf ihren Anfang gekürzt
 * (`STAMM`), damit „Eishalle“ und „Eishallen“ oder „anfragen“ und „Anfrage“ dasselbe Wort sind. Ein Treffer braucht
 *
 * - mindestens `MIN_GEMEINSAM` (2) gemeinsame Wörter – ein einzelnes Wort (etwa „Uhr“) macht noch keinen Doppelten –, und
 * - dass mindestens `SCHWELLE` (75 %) der Wörter des **kürzeren** Textes im anderen vorkommen. Der kürzere zählt, weil
 *   ein knapper Stichpunkt („Kochteam steht“) in einer längeren Zeile („Das Kochteam steht, wir kochen für 70 Personen“)
 *   vollständig enthalten sein kann – das ist dann ein Doppelter. 3 von 4 Wörtern reichen, 2 von 4 nicht.
 *
 * Lieber einmal einen Doppelten übersehen als einen echten Stichpunkt abwählen: Die Schwelle ist bewusst hoch, und ein
 * abgewählter Stichpunkt lässt sich in der Vorschau mit einem Haken wieder wählen.
 */

/** Wie viel Prozent der Wörter des kürzeren Textes im anderen stehen müssen. */
export const SCHWELLE = 0.75;
/** So viele Wörter müssen mindestens gemeinsam sein. */
export const MIN_GEMEINSAM = 2;
/** Wörter ab dieser Länge werden auf ihre ersten `STAMM` Buchstaben gekürzt. */
export const STAMM = 6;

/** Wörter, die nichts sagen – kommen nicht in die Wortmenge. */
const FUELLWOERTER = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'und',
  'oder',
  'mit',
  'von',
  'vom',
  'zum',
  'zur',
  'bei',
  'beim',
  'auf',
  'aus',
  'fuer',
  'ist',
  'sind',
  'wird',
  'werden',
  'wurde',
  'wir',
  'ich',
  'sie',
  'es',
  'im',
  'in',
  'am',
  'an',
  'um',
  'zu',
  'als',
  'auch',
  'noch',
  'dann',
  'sonst',
  'nur',
  'nach',
  'vor',
]);

/** Kleinschreibung, ß/Umlaute ausgeschrieben – „Für“ und „fuer“ sind dasselbe Wort. */
function glatt(t: string): string {
  return t
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue');
}

/** Die Wortmenge eines Textes (ohne Füllwörter, gekürzt auf den Stamm; Zahlen bleiben). */
export function woerter(t: string): Set<string> {
  const aus = new Set<string>();
  for (const w of glatt(t).split(/[^\p{L}\p{N}]+/u)) {
    if (!w || FUELLWOERTER.has(w)) continue;
    aus.add(w.length > STAMM ? w.slice(0, STAMM) : w);
  }
  return aus;
}

/** Sagen die beiden Texte dasselbe? (Regeln im Dateikopf.) */
export function aehnlich(a: string, b: string): boolean {
  const x = woerter(a);
  const y = woerter(b);
  if (!x.size || !y.size) return false;
  let gemeinsam = 0;
  for (const w of x) if (y.has(w)) gemeinsam++;
  // Ein Text aus einem einzigen Wort zählt nur gegen einen Text, der genau dieses eine Wort ist.
  const noetig = x.size === 1 && y.size === 1 ? 1 : MIN_GEMEINSAM;
  if (gemeinsam < noetig) return false;
  return gemeinsam / Math.min(x.size, y.size) >= SCHWELLE;
}

/** Die erste Zeile aus `zeilen`, der `text` entspricht – oder `null`. */
export function aehnlicheZeile<T extends { text: string }>(
  text: string,
  zeilen: readonly T[],
): T | null {
  return zeilen.find((z) => aehnlich(text, z.text)) ?? null;
}
