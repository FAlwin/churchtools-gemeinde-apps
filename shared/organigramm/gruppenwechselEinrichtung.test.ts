import { describe, expect, it } from 'vitest';
import { GRUNDWERTE } from './gruppenwechsel';
import {
  einrichtungAus,
  wechselGruppeAb,
  wechselGruppeNach,
  type Einrichtung,
} from './gruppenwechselEinrichtung';

const STUFEN = [
  { gruppeId: 1, name: 'Schäfchen', abAlter: 4 },
  { gruppeId: 2, name: 'Fische', abAlter: 7 },
  { gruppeId: 3, name: 'Jungschar', abAlter: 10 },
];

const gut = (): Einrichtung => ({
  einstellung: { ...GRUNDWERTE, stufen: STUFEN.map((s) => ({ ...s })) },
  bereichGruppeId: 9,
  wechselGruppen: [
    { vonGruppeId: 1, nachGruppeId: 2, gruppeId: 11 },
    { vonGruppeId: 2, nachGruppeId: 3, gruppeId: 12 },
  ],
});

/** Wie aus dem Speicher: einmal durch JSON. */
const gespeichert = (x: unknown): unknown => JSON.parse(JSON.stringify(x));

describe('einrichtungAus', () => {
  it('liest einen Eintrag, wie er gespeichert wird, unverändert', () => {
    expect(einrichtungAus(gespeichert(gut()))).toEqual(gut());
  });

  it('nimmt auch eine Einrichtung ohne Wechsel-Gruppen (vor „Einrichten“)', () => {
    expect(einrichtungAus(gespeichert({ ...gut(), wechselGruppen: [] }))?.wechselGruppen).toEqual(
      [],
    );
  });

  it.each([
    ['kein Objekt', 'x'],
    ['ohne Einstellung', { ...gut(), einstellung: undefined }],
    ['ohne Bereichsgruppe', { ...gut(), bereichGruppeId: 0 }],
    ['ohne Liste der Wechsel-Gruppen', { ...gut(), wechselGruppen: null }],
    ['Stichtag fehlt', { ...gut(), einstellung: { ...gut().einstellung, stichtag: undefined } }],
    [
      'Alter als Text',
      {
        ...gut(),
        einstellung: { ...gut().einstellung, stufen: [{ ...STUFEN[0], abAlter: '4' }, STUFEN[1]] },
      },
    ],
  ])('lehnt ab: %s', (_, roh) => {
    expect(einrichtungAus(gespeichert(roh))).toBeNull();
  });

  it('lehnt eine Einstellung ab, nach der die Regeln falsch wären (Alter fällt)', () => {
    const e = gut();
    e.einstellung.stufen[2].abAlter = 6;
    expect(einrichtungAus(gespeichert(e))).toBeNull();
  });

  it('lehnt eine Wechsel-Gruppe ab, die eine Stufe überspringt', () => {
    const e = gut();
    e.wechselGruppen = [{ vonGruppeId: 1, nachGruppeId: 3, gruppeId: 13 }];
    expect(einrichtungAus(gespeichert(e))).toBeNull();
  });

  it('lehnt eine Wechsel-Gruppe gegen die Reihenfolge ab', () => {
    const e = gut();
    e.wechselGruppen = [{ vonGruppeId: 2, nachGruppeId: 1, gruppeId: 13 }];
    expect(einrichtungAus(gespeichert(e))).toBeNull();
  });

  it('lehnt zwei Wechsel-Gruppen für denselben Übergang ab', () => {
    const e = gut();
    e.wechselGruppen = [...e.wechselGruppen, { vonGruppeId: 1, nachGruppeId: 2, gruppeId: 14 }];
    expect(einrichtungAus(gespeichert(e))).toBeNull();
  });
});

describe('wechselGruppeAb / wechselGruppeNach', () => {
  it('findet die Wechsel-Gruppe aus einer Stufe heraus und in sie hinein', () => {
    const e = gut();
    expect(wechselGruppeAb(e, 2)?.gruppeId).toBe(12);
    expect(wechselGruppeNach(e, 2)?.gruppeId).toBe(11);
  });

  it('erste Stufe: keine davor, letzte Stufe: keine danach', () => {
    const e = gut();
    expect(wechselGruppeNach(e, 1)).toBeNull();
    expect(wechselGruppeAb(e, 3)).toBeNull();
  });
});
