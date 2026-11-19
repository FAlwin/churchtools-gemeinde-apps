import { describe, expect, it } from 'vitest';
import { MAX_ZEICHEN } from './modulDaten';
import { pruefsumme, TEIL_ZEICHEN, teileBauen, textAusTeilen, type TeilStueck } from './teile';

/** Eine Hülle wie die einer Anwendung: eigene Felder plus die vier gemeinsamen. */
const huelle = (t: TeilStueck) => ({ art: 'test-teil', besitzer: 'x', ...t });
const lesen = (werte: string[]): TeilStueck[] => werte.map((w) => JSON.parse(w) as TeilStueck);

/** Text, der sich schlecht packen lässt – damit mehrere Teile nötig sind. */
function zufallsText(laenge: number): string {
  let z = 99;
  let t = '';
  while (t.length < laenge) {
    z = (z * 1103515245 + 12345) & 0x7fffffff;
    t += z.toString(36);
  }
  return t.slice(0, laenge);
}

describe('teileBauen / textAusTeilen (gemeinsam für Protokolle und Website)', () => {
  it('ein kurzer Text ist ein Teil und kommt unverändert zurück', () => {
    const { stand, werte } = teileBauen('Hallo Welt', huelle, 'Ein Teil');
    expect(werte).toHaveLength(1);
    expect(stand).toBe(pruefsumme('Hallo Welt'));
    expect(textAusTeilen(stand, lesen(werte))).toBe('Hallo Welt');
  });

  it('ein langer Text wird in Stücke von höchstens TEIL_ZEICHEN geschnitten – jeder Wert bleibt unter der Grenze', () => {
    const text = zufallsText(40_000);
    const { stand, werte } = teileBauen(text, huelle, 'Ein Teil');
    expect(werte.length).toBeGreaterThan(2);
    const teile = lesen(werte);
    expect(teile.every((t) => t.daten.length <= TEIL_ZEICHEN)).toBe(true);
    expect(werte.every((w) => w.length <= MAX_ZEICHEN)).toBe(true);
    expect(teile.map((t) => t.nr)).toEqual(teile.map((_, i) => i));
    expect(teile.every((t) => t.von === teile.length)).toBe(true);
    expect(textAusTeilen(stand, teile)).toBe(text);
  });

  it('die Reihenfolge der gelesenen Teile ist egal', () => {
    const text = zufallsText(30_000);
    const { stand, werte } = teileBauen(text, huelle, 'Ein Teil');
    expect(textAusTeilen(stand, lesen(werte).reverse())).toBe(text);
  });

  it('fehlt ein Teil, ist der Stand ein anderer oder ist ein Teil kaputt: null – nie ein halber Text', () => {
    const { stand, werte } = teileBauen(zufallsText(30_000), huelle, 'Ein Teil');
    const alle = lesen(werte);
    expect(textAusTeilen(stand, alle.slice(1))).toBeNull();
    expect(textAusTeilen(stand, alle.slice(0, -1))).toBeNull();
    expect(textAusTeilen('anderer-stand', alle)).toBeNull();
    expect(textAusTeilen(stand, [])).toBeNull();
    const kaputt = alle.map((t, i) => (i === 0 ? { ...t, daten: '!!!' } : t));
    expect(textAusTeilen(stand, kaputt)).toBeNull();
  });

  it('Teile eines älteren und eines neueren Stands nebeneinander: jeder Stand liest nur seine', () => {
    const alt = teileBauen(zufallsText(25_000), huelle, 'Ein Teil');
    const neuText = zufallsText(20_000).replace(/a/g, 'b');
    const neu = teileBauen(neuText, huelle, 'Ein Teil');
    const gemischt = [...lesen(alt.werte), ...lesen(neu.werte)];
    expect(textAusTeilen(neu.stand, gemischt)).toBe(neuText);
    expect(textAusTeilen(alt.stand, gemischt)).not.toBeNull();
  });

  it('ein doppelt liegender Teil (Aufräumen eines früheren Speicherns scheiterte) zählt einmal', () => {
    const text = zufallsText(30_000);
    const { stand, werte } = teileBauen(text, huelle, 'Ein Teil');
    const alle = lesen(werte);
    expect(textAusTeilen(stand, [...alle, ...alle])).toBe(text);
    expect(textAusTeilen(stand, [...alle, alle[0]])).toBe(text);
  });

  it('wirft, wenn die Hülle die Grenze sprengt – mit dem Namen des Aufrufers in der Meldung', () => {
    const dick = (t: TeilStueck) => ({ ...t, ballast: 'x'.repeat(MAX_ZEICHEN) });
    expect(() => teileBauen('kurz', dick, 'Ein Protokoll-Teil')).toThrow(
      /^Ein Protokoll-Teil hätte \d+ Zeichen \(höchstens 10000\)\.$/,
    );
  });

  it('Teile mit richtigem Stand, aber falschem Inhalt (verfälscht oder vertauscht) lesen sich als null – die Prüfsumme entscheidet', () => {
    const { stand, werte } = teileBauen('Der echte Text', huelle, 'Ein Teil');
    const fremd = lesen(teileBauen('Ein ganz anderer Text', huelle, 'Ein Teil').werte);
    // Gleiche Nummer, gleiche Anzahl, gleicher Stand wie behauptet – nur der Inhalt gehört zu einem anderen Text.
    const verfaelscht = lesen(werte).map((t, i) => ({ ...t, daten: fremd[i].daten }));
    expect(textAusTeilen(stand, verfaelscht)).toBeNull();
  });

  it('eine Teilmenge reicht nie – auch nicht, wenn die fehlenden Teile am Ende liegen', () => {
    const { stand, werte } = teileBauen(zufallsText(40_000), huelle, 'Ein Teil');
    const alle = lesen(werte);
    for (let n = 0; n < alle.length; n++) expect(textAusTeilen(stand, alle.slice(0, n))).toBeNull();
  });

  it('der Stand ist die Prüfsumme des Klartexts (gleicher Text → gleicher Stand, anderer Text → anderer)', () => {
    expect(teileBauen('a', huelle, 'T').stand).toBe(teileBauen('a', huelle, 'T').stand);
    expect(teileBauen('a', huelle, 'T').stand).not.toBe(teileBauen('b', huelle, 'T').stand);
  });
});
