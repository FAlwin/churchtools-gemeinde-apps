import { describe, expect, it } from 'vitest';
import type { ArrangementAnsicht, LiedStammdatenAnsicht } from '@shared/types/index';
import {
  liedinfoAenderung,
  liedinfoAusStand,
  liedinfoSpeichern,
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

describe('liedinfoSpeichern – erst das Ergebnis in der Hand, dann aufräumen', () => {
  it('schreibt die Änderung und entfernt nur, was ChurchTools danach wirklich hat', async () => {
    const { formular } = liedinfoStart(QUELLE, DATEI);
    const gesendet: unknown[] = [];
    const text = await liedinfoSpeichern(
      formular,
      {
        ...QUELLE,
        // ChurchTools übernimmt den Autor NICHT (meldet ihn leer zurück) – die Zeile muss bleiben.
        speichern: (a) => {
          gesendet.push(a);
          return Promise.resolve({ lied: LIED, arrangement: { ...ARR, tempo: 72 } });
        },
      },
      DATEI,
    );
    expect(gesendet).toHaveLength(1);
    expect(text).toBe('{artist: Tobias Gerster}\n{key: E}\nText');
  });

  it('scheitert das Schreiben, wirft es – und nichts wird entfernt', async () => {
    const { formular } = liedinfoStart(QUELLE, DATEI);
    await expect(
      liedinfoSpeichern(
        formular,
        { ...QUELLE, speichern: () => Promise.reject(new Error('504')) },
        DATEI,
      ),
    ).rejects.toThrow('504');
  });

  it('ohne Recht: der Text bleibt, wie er ist, und nichts wird geschrieben', async () => {
    const { formular } = liedinfoStart({ ...QUELLE, darf: false }, DATEI);
    let geschrieben = false;
    const text = await liedinfoSpeichern(
      formular,
      {
        ...QUELLE,
        darf: false,
        speichern: () => {
          geschrieben = true;
          return Promise.resolve({ lied: LIED, arrangement: ARR });
        },
      },
      DATEI,
    );
    expect(text).toBe(DATEI);
    expect(geschrieben).toBe(false);
  });

  it('nichts geändert: kein Schreiben, aber Zeilen mit gleichem Wert in ChurchTools gehen', async () => {
    const quelle = {
      ...QUELLE,
      lied: { ...LIED, author: 'Tobias Gerster' },
      arrangement: { ...ARR, tempo: 72 },
    };
    const { formular } = liedinfoStart(quelle, DATEI);
    let geschrieben = false;
    const text = await liedinfoSpeichern(
      formular,
      {
        ...quelle,
        speichern: () => {
          geschrieben = true;
          return Promise.resolve({ lied: LIED, arrangement: ARR });
        },
      },
      DATEI,
    );
    expect(geschrieben).toBe(false);
    expect(text).toBe('{key: E}\nText');
  });
});
