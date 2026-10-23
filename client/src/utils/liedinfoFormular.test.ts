import { describe, expect, it } from 'vitest';
import type { ArrangementAnsicht, LiedStammdatenAnsicht } from '@shared/types/index';
import {
  liedinfoAenderung,
  liedinfoAusStand,
  liedinfoStart,
  liedinfoUebernehmen,
  type LiedinfoQuelle,
} from './liedinfoFormular';

/** Lied-Editor L4 (23.10.2026): Formular der Liedinfo – Start, Vorbelegen, Übernehmen, Änderung. */
const LIED: LiedStammdatenAnsicht = {
  songId: 7,
  name: 'Treu',
  author: null,
  ccli: '4328979',
  copyright: null,
  categoryId: 2,
};
const ARR: ArrangementAnsicht = {
  id: 11,
  name: 'Standard',
  isDefault: true,
  key: 'E',
  tempo: null,
  beat: '4/4',
  duration: null,
  description: null,
  source: null,
  sourceReference: null,
  dateien: 1,
};
const QUELLE: LiedinfoQuelle = { lied: LIED, arrangement: ARR, darf: true };
const DATEI =
  '{title: Treu (Akustik)}\n{artist: Tobias Gerster}\n{key: E}\n{tempo: 72}\n{time: 4/4}\nText';

describe('liedinfoStart', () => {
  it('ChurchTools zuerst; leere Felder aus der Datei vorbelegt; Abweichung bleibt beim ChurchTools-Wert', () => {
    const { formular, vergleich } = liedinfoStart(QUELLE, DATEI);
    expect(formular.lied).toMatchObject({
      name: 'Treu',
      author: 'Tobias Gerster',
      ccli: '4328979',
    });
    expect(formular.arrangement).toMatchObject({ key: 'E', tempo: '72', beat: '4/4' });
    expect(Object.fromEntries(vergleich.map((v) => [v.feld, v.art]))).toEqual({
      name: 'abweichung',
      author: 'vorbelegen',
      ccli: 'leer',
      copyright: 'leer',
      tempo: 'vorbelegen',
      beat: 'gleich',
    });
  });
  it('ohne Recht wird nichts vorbelegt', () => {
    const { formular } = liedinfoStart({ ...QUELLE, darf: false }, DATEI);
    expect(formular.lied.author).toBe('');
    expect(formular.arrangement.tempo).toBe('');
  });
  it('„übernehmen“ legt den Datei-Wert ins Feld', () => {
    const { formular, vergleich } = liedinfoStart(QUELLE, DATEI);
    const neu = liedinfoUebernehmen(formular, vergleich.find((v) => v.feld === 'name')!);
    expect(neu.lied.name).toBe('Treu (Akustik)');
  });
});

describe('liedinfoAenderung – über die Funktionen des Stammdaten-Blatts', () => {
  it('ohne Eingriff: nur das Vorbelegte geht an ChurchTools', () => {
    const { formular } = liedinfoStart(QUELLE, DATEI);
    const a = liedinfoAenderung(formular, QUELLE);
    expect(a.lied).toEqual({ author: 'Tobias Gerster' });
    expect(a.arrangement).toMatchObject({ tempo: 72 });
  });
  it('nichts geändert → nichts zu speichern', () => {
    const { formular } = liedinfoStart(QUELLE, 'nur Text');
    expect(liedinfoAenderung(formular, QUELLE)).toEqual({ lied: null, arrangement: null });
  });
});

describe('liedinfoAusStand', () => {
  it('Tempo als Text, leere Felder als null', () => {
    expect(liedinfoAusStand(LIED, { ...ARR, tempo: 80 })).toEqual({
      name: 'Treu',
      author: null,
      ccli: '4328979',
      copyright: null,
      tempo: '80',
      beat: '4/4',
    });
  });
});
