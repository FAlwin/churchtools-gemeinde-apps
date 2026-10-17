// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => vi.fn());
vi.mock('../services/annotations', () => ({ pushField: push }));

const { entwurfTexte, lueckenTexteHolen, texteZurueck } = await import('./rolleSpeichern');
const { satzplaene } = await import('./chordPdf');
const { streifen, textAufRolle } = await import('./rollenAbbildung');
const { textSchluessel } = await import('./annotationKeys');
import type { SetlistSong } from '@shared/types/index';

/**
 * Malen auf der Rolle speichert auf den A4-Seiten (#608). Gegen einen ECHTEN Satz: sechs Teile à neun
 * Zeilen – der letzte springt auf A4-Seite 2, auf Seite 1 bleibt unten eine Lücke.
 */
const LIED = {
  title: 'T',
  author: '',
  originalKey: 'C',
  targetKey: 'C',
  bpm: null,
  timeSig: null,
  ccli: null,
  chordpro: Array.from(
    { length: 6 },
    (_, n) => `{comment: Vers ${n + 1}}\n${Array.from({ length: 9 }, () => '[C]Zeile').join('\n')}`,
  ).join('\n'),
} as unknown as SetlistSong;
const abb = satzplaene(LIED);
const liste = streifen(abb);
const H = abb.rolle.hoehe;
const KEYS = Array.from(
  { length: abb.a4.seiten },
  (_, i) => `worship_docdraw_song1_voriginal_${i}`,
);
const text = (id: number, fy: number, t = 'x') => ({
  id,
  fx: 0.4,
  fy,
  sizeCqh: 1.5,
  text: t,
  color: '#000',
});

afterEach(() => {
  localStorage.clear();
  push.mockReset();
});

describe('entwurfTexte – was auf der Rolle bearbeitbar ist', () => {
  it('Texte in Teilen kommen in den Entwurf, Texte in der Lücke am Seitenende nicht', () => {
    const imTeil = text(1, (abb.a4.stuecke[0].y0 + 2) / 297, 'im Teil');
    const inLuecke = text(2, 290 / 297, 'in Lücke');
    localStorage.setItem(textSchluessel(KEYS[0]), JSON.stringify([imTeil, inLuecke]));
    const e = entwurfTexte(KEYS, liste, H);
    expect(e.map((t) => t.text)).toEqual(['im Teil']);
  });
});

describe('texteZurueck – Texte der Rolle auf die A4-Seiten', () => {
  it('ein neuer Text im Teil auf Seite 2 landet auf A4-Seite 2 – und wird zum Konto geschickt', () => {
    const s2 = abb.a4.stuecke.find((s) => s.seite === 1)!;
    const aufRolle = textAufRolle(text(5, (s2.y0 + 3) / 297, 'neu'), liste, 1, H)!;
    texteZurueck([aufRolle], H, KEYS, liste);
    const gespeichert = JSON.parse(localStorage.getItem(textSchluessel(KEYS[1]))!);
    expect(gespeichert).toHaveLength(1);
    expect(gespeichert[0].fy).toBeCloseTo((s2.y0 + 3) / 297, 6);
    expect(push).toHaveBeenCalledWith(KEYS[1], 'texts', gespeichert);
  });

  it('was in der Lücke stand, bleibt – auch wenn auf der Rolle alles gelöscht wird', () => {
    const inLuecke = text(2, 290 / 297, 'in Lücke');
    const imTeil = text(1, (abb.a4.stuecke[0].y0 + 2) / 297, 'im Teil');
    localStorage.setItem(textSchluessel(KEYS[0]), JSON.stringify([imTeil, inLuecke]));
    texteZurueck([], H, KEYS, liste);
    const danach = JSON.parse(localStorage.getItem(textSchluessel(KEYS[0]))!);
    expect(danach.map((t: { text: string }) => t.text)).toEqual(['in Lücke']);
  });

  it('nichts geändert → nichts gespeichert, nichts geschickt', () => {
    texteZurueck([], H, KEYS, liste);
    expect(push).not.toHaveBeenCalled();
  });
});

describe('lueckenTexteHolen – das Lasso auf der Rolle greift auch die Lücken (#615)', () => {
  /** Ein Quadrat um einen Punkt der Rolle (Anteile). */
  const um = (x: number, y: number, r = 0.01) => [
    { x: x - r, y: y - r },
    { x: x + r, y: y - r },
    { x: x + r, y: y + r },
    { x: x - r, y: y + r },
  ];
  const inLuecke = text(2, 290 / 297, 'in Lücke');
  const imTeil = text(1, (abb.a4.stuecke[0].y0 + 2) / 297, 'im Teil');
  const gelesen = (k: string) =>
    JSON.parse(localStorage.getItem(textSchluessel(k)) ?? '[]') as {
      text: string;
      fx: number;
      fy: number;
      sizeCqh: number;
    }[];

  it('ein Lücken-Text in der Form kommt von der A4-Seite – an die Stelle, wo die Rolle ihn zeigt', () => {
    localStorage.setItem(textSchluessel(KEYS[0]), JSON.stringify([imTeil, inLuecke]));
    const gezeigt = textAufRolle(inLuecke, liste, 0, H)!;
    expect(gezeigt.art).toBe('luecke');
    const geholt = lueckenTexteHolen(um(gezeigt.fx, gezeigt.fy), H, KEYS, liste);
    expect(geholt.map((t) => t.text)).toEqual(['in Lücke']);
    expect(geholt[0].fy).toBeCloseTo(gezeigt.fy, 9);
    expect(geholt[0].sizeCqh).toBeCloseTo(gezeigt.sizeCqh, 9);
    expect(gelesen(KEYS[0]).map((t) => t.text)).toEqual(['im Teil']);
    expect(push).toHaveBeenCalledWith(KEYS[0], 'texts', [imTeil]);
  });

  it('außerhalb der Form bleibt er in seiner Lücke; Texte im Teil holt es nicht (die stehen schon im Entwurf)', () => {
    localStorage.setItem(textSchluessel(KEYS[0]), JSON.stringify([imTeil, inLuecke]));
    const teil = textAufRolle(imTeil, liste, 0, H)!;
    expect(lueckenTexteHolen(um(teil.fx, teil.fy), H, KEYS, liste)).toEqual([]);
    expect(gelesen(KEYS[0])).toHaveLength(2);
    expect(push).not.toHaveBeenCalled();
  });

  it('danach gespeichert, steht er im Kern an seiner neuen Stelle – und nicht zusätzlich noch in der Lücke', () => {
    localStorage.setItem(textSchluessel(KEYS[0]), JSON.stringify([imTeil, inLuecke]));
    const gezeigt = textAufRolle(inLuecke, liste, 0, H)!;
    const geholt = lueckenTexteHolen(um(gezeigt.fx, gezeigt.fy), H, KEYS, liste);
    texteZurueck([...entwurfTexte(KEYS, liste, H), ...geholt], H, KEYS, liste);
    const alle = KEYS.flatMap((k) => gelesen(k).map((t) => t.text));
    expect(alle.filter((t) => t === 'in Lücke')).toHaveLength(1);
    // Wieder auf die Rolle gerechnet: jetzt im Kern, an derselben Stelle.
    const seite = KEYS.findIndex((k) => gelesen(k).some((t) => t.text === 'in Lücke'));
    const neu = gelesen(KEYS[seite]).find((t) => t.text === 'in Lücke')!;
    const zurueck = textAufRolle(neu, liste, seite, H)!;
    expect(zurueck.art).toBe('kern');
    expect(zurueck.fy).toBeCloseTo(gezeigt.fy, 6);
  });
});
