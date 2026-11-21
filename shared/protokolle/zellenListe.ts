/**
 * **Aufzählungen in Tabellenzellen** (W11, Alwin 21.11.2026). BlockNote-Zellen kennen nur Text, keine Listenblöcke –
 * darum ist die Aufzählung in der Zelle **Text**: Zeilen, die mit „• “ oder „1. “ beginnen, getrennt durch Zeilenumbrüche.
 * Hier steht nur die Regel (reine Funktionen); die Tasten hängen in `protokolle/src/zellenListe.ts`.
 *
 * Lese-Ansicht und PDF brauchen nichts davon: „• “ und „1. “ sind gewöhnlicher Text, die Zeilenumbrüche kommen als
 * `\n` im Inhalt an (`zeilenAus`).
 */
import { aufzaehlungsZeichen } from './aufzaehlung';

/** Das Zeichen der Text-Aufzählung in der Zelle – dasselbe wie Ebene 1 der Listen. */
export const ZELLEN_PUNKT = aufzaehlungsZeichen(0);

/** Die Marke am Anfang einer Zeile: `•` oder eine Nummer. */
export type Marke = { art: 'punkt' } | { art: 'nummer'; nr: number };

const NUMMER_ZEILE = /^(\d{1,3})\. /;

/** Die Marke der Zeile (`null`, wenn sie nicht mit „• “ oder „N. “ beginnt) und wie lang sie ist. */
export function markeDerZeile(zeile: string): { marke: Marke; laenge: number } | null {
  if (zeile.startsWith(`${ZELLEN_PUNKT} `)) return { marke: { art: 'punkt' }, laenge: 2 };
  const m = NUMMER_ZEILE.exec(zeile);
  return m ? { marke: { art: 'nummer', nr: Number(m[1]) }, laenge: m[0].length } : null;
}

/** Der Text vor dem nächsten Eintrag: „• “ bzw. „N+1. “. */
export const naechsteMarke = (m: Marke): string =>
  m.art === 'punkt' ? `${ZELLEN_PUNKT} ` : `${m.nr + 1}. `;

/** Die Zeile, in der der Cursor steht: alles nach dem letzten Zeilenumbruch vor ihm. */
export const zeileVorCursor = (textVorCursor: string): string =>
  textVorCursor.slice(textVorCursor.lastIndexOf('\n') + 1);

/**
 * **Tippt jemand ein Leerzeichen hinter „-“ oder „*“ am Zeilenanfang?** Dann wird daraus „• “ – `true`, wenn ja
 * (`zeileVorCursor` = alles in der Zeile vor dem Cursor). „1. “ braucht nichts: es bleibt, wie getippt.
 */
export const wirdZuPunkt = (zeileVorCursor: string): boolean => /^[-*]$/.test(zeileVorCursor);

/** Was Enter in einer Zelle tut. */
export type EnterInZelle =
  /** Nichts Eigenes – BlockNote verhält sich wie bisher (in die Zelle darunter). */
  | { tun: 'nichts' }
  /** Zeilenumbruch einfügen und `vorsatz` davor setzen. */
  | { tun: 'weiter'; vorsatz: string }
  /** Die Zeile besteht nur aus der Marke: sie wegnehmen (`laenge` Zeichen am Zeilenanfang) – die Aufzählung ist zu Ende. */
  | { tun: 'beenden'; laenge: number };

/**
 * **Enter in einer Zellzeile.** `zeile` ist die GANZE Zeile (auch hinter dem Cursor), `vorCursor` der Teil davor.
 * Beginnt sie mit einer Marke: steht nur die Marke da → beenden; sonst → nächste Marke in einer neuen Zeile. Alles
 * andere bleibt beim bisherigen Verhalten.
 */
export function enterInZelle(zeile: string, vorCursor: string): EnterInZelle {
  const z = markeDerZeile(zeile);
  if (!z) return { tun: 'nichts' };
  if (zeile.length === z.laenge) return { tun: 'beenden', laenge: z.laenge };
  // Der Cursor steht noch in der Marke („•| Text“): dort einen neuen Eintrag anzufangen ergäbe Unsinn – bisheriges Verhalten.
  if (vorCursor.length < z.laenge) return { tun: 'nichts' };
  return { tun: 'weiter', vorsatz: naechsteMarke(z.marke) };
}
