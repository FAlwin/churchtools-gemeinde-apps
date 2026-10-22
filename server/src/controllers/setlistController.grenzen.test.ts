import { describe, it, expect } from 'vitest';
import { ABLAUFPUNKT_GRENZEN as G } from '@shared/types/index';
import { createItemSchema, geloeschterPunktSchema, updateItemSchema } from './setlistController.js';

/**
 * Die Feldgrenzen eines Ablaufpunkts (#671) – **gegen `ABLAUFPUNKT_GRENZEN` geprüft, nicht gegen hingeschriebene
 * Zahlen.** Sonst bliebe der Test genau bei dem Fehler grün, den er verhindern soll: Bis #671 stand die Bemerkung im
 * Server auf 2000 (ChurchTools kann 4000) und der Titel auf 255 (ChurchTools nimmt nur 100).
 */
const text = (n: number) => 'ä'.repeat(n);

describe('Punkt ändern und anlegen: Grenzen wie ChurchTools', () => {
  for (const [name, schema, rumpf] of [
    ['ändern', updateItemSchema, {}],
    ['anlegen', createItemSchema, { type: 'text' }],
  ] as const) {
    it(`${name}: Titel, Zuständig, Bemerkung bis zur Grenze ja, eins mehr nein`, () => {
      for (const [feld, grenze] of [
        ['title', G.titel],
        ['responsible', G.zustaendig],
        ['note', G.bemerkung],
      ] as const) {
        expect(
          schema.safeParse({ ...rumpf, [feld]: text(grenze) }).success,
          `${feld} = ${grenze}`,
        ).toBe(true);
        expect(
          schema.safeParse({ ...rumpf, [feld]: text(grenze + 1) }).success,
          `${feld} > ${grenze}`,
        ).toBe(false);
      }
    });
  }
});

describe('Merkzettel für „Rückgängig“: dieselben Grenzen', () => {
  const zettel = (felder: Record<string, unknown>, info = 'x') => ({
    felder: {
      type: 'text',
      title: 'T',
      note: '',
      duration: 0,
      responsible: '',
      serviceGroupNotes: [{ serviceGroupId: 3, note: info }],
      ...felder,
    },
    nachId: null,
    vorBeginn: false,
  });

  it('Titel, Zuständig, Bemerkung, Gruppen-Info bis zur Grenze ja, eins mehr nein', () => {
    for (const [feld, grenze] of [
      ['title', G.titel],
      ['responsible', G.zustaendig],
      ['note', G.bemerkung],
    ] as const) {
      expect(geloeschterPunktSchema.safeParse(zettel({ [feld]: text(grenze) })).success).toBe(true);
      expect(geloeschterPunktSchema.safeParse(zettel({ [feld]: text(grenze + 1) })).success).toBe(
        false,
      );
    }
    expect(geloeschterPunktSchema.safeParse(zettel({}, text(G.gruppenInfo))).success).toBe(true);
    expect(geloeschterPunktSchema.safeParse(zettel({}, text(G.gruppenInfo + 1))).success).toBe(
      false,
    );
  });
});
