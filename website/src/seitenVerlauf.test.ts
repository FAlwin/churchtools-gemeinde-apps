import { describe, expect, it } from 'vitest';
import { abschnittVerschiebenNach } from '@shared/website/bearbeiten';
import { abschnitt, baustein, seite } from '@shared/website/website.testdaten';
import {
  LEERER_VERLAUF,
  MAX_SCHRITTE,
  verlaufMerken,
  verlaufVor,
  verlaufZurueck,
} from './seitenVerlauf';

const A = (id: string) => abschnitt([baustein('trenner', { id: `${id}-b` })], { id });
const S0 = seite({ abschnitte: [A('a'), A('b'), A('c')] });
const S1 = abschnittVerschiebenNach(S0, 0, 3);
const S2 = abschnittVerschiebenNach(S1, 0, 3);

describe('Verlauf der Seite', () => {
  it('ein Schritt, der nichts ändert, zählt nicht', () => {
    expect(verlaufMerken(LEERER_VERLAUF, S0, S0)).toBe(LEERER_VERLAUF);
    expect(verlaufMerken(LEERER_VERLAUF, S0, { ...S0 })).toBe(LEERER_VERLAUF);
  });

  it('zurück und vor gehen die Schritte in umgekehrter Reihenfolge durch', () => {
    let v = verlaufMerken(LEERER_VERLAUF, S0, S1);
    v = verlaufMerken(v, S1, S2);
    const z1 = verlaufZurueck(v, S2);
    expect(z1.art === 'ok' && z1.seite).toBe(S1);
    if (z1.art !== 'ok') throw new Error();
    const z2 = verlaufZurueck(z1.verlauf, S1);
    expect(z2.art === 'ok' && z2.seite).toBe(S0);
    if (z2.art !== 'ok') throw new Error();
    expect(verlaufZurueck(z2.verlauf, S0).art).toBe('leer');
    const w1 = verlaufVor(z2.verlauf, S0);
    expect(w1.art === 'ok' && w1.seite).toBe(S1);
    if (w1.art !== 'ok') throw new Error();
    const w2 = verlaufVor(w1.verlauf, S1);
    expect(w2.art === 'ok' && w2.seite).toBe(S2);
    if (w2.art !== 'ok') throw new Error();
    expect(verlaufVor(w2.verlauf, S2).art).toBe('leer');
  });

  it('ein neuer Schritt nach „zurück“ löscht das Wiederholen', () => {
    const v = verlaufMerken(LEERER_VERLAUF, S0, S1);
    const z = verlaufZurueck(v, S1);
    if (z.art !== 'ok') throw new Error();
    expect(z.verlauf.vor).toHaveLength(1);
    const neu = verlaufMerken(z.verlauf, S0, S2);
    expect(neu.vor).toHaveLength(0);
    expect(neu.zurueck).toHaveLength(1);
  });

  it('sieht die Seite anders aus als nach dem Schritt, wird nichts überschrieben: „fremd“, der Verlauf ist weg', () => {
    const v = verlaufMerken(LEERER_VERLAUF, S0, S1);
    const fremd = abschnittVerschiebenNach(S1, 1, 0);
    expect(verlaufZurueck(v, fremd)).toEqual({ art: 'fremd', verlauf: LEERER_VERLAUF });
    const z = verlaufZurueck(v, S1);
    if (z.art !== 'ok') throw new Error();
    expect(verlaufVor(z.verlauf, fremd)).toEqual({ art: 'fremd', verlauf: LEERER_VERLAUF });
  });

  it('die Reihenfolge der Felder zählt nicht (eine gelesene Seite hat die Reihenfolge des Schemas)', () => {
    const v = verlaufMerken(LEERER_VERLAUF, S0, S1);
    const umkehren = (x: unknown): unknown =>
      Array.isArray(x)
        ? x.map(umkehren)
        : x && typeof x === 'object'
          ? Object.fromEntries(
              Object.entries(x)
                .reverse()
                .map(([k, w]) => [k, umkehren(w)]),
            )
          : x;
    const umgestellt = umkehren(S1) as typeof S1;
    expect(Object.keys(umgestellt)).not.toEqual(Object.keys(S1));
    expect(verlaufZurueck(v, umgestellt).art).toBe('ok');
  });

  it(`höchstens ${MAX_SCHRITTE} Schritte – die ältesten fallen weg`, () => {
    let v = LEERER_VERLAUF;
    let s = S0;
    for (let n = 0; n < MAX_SCHRITTE + 5; n++) {
      const neu = abschnittVerschiebenNach(s, 0, 3);
      v = verlaufMerken(v, s, neu);
      s = neu;
    }
    expect(v.zurueck).toHaveLength(MAX_SCHRITTE);
  });
});
