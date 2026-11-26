import { describe, expect, it } from 'vitest';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import { ladeRegeln, nurAbwesendAus } from './useAbfrageRegeln';

/**
 * V-5: Welche Dienstgruppen „Nur abwesend“ fragen – gegen den Erzeuger (`ladeRegeln` mit nachgebautem Lader), nicht gegen
 * handgeschriebene Regeln.
 */
const HEUTE = '2026-11-26';
const stand = (teil: Partial<AbfragenStand>): AbfragenStand => ({
  inhalt: standardInhalt(),
  gespeichert: null,
  unlesbar: false,
  fehler: null,
  ...teil,
});

describe('nurAbwesendAus (V-5)', () => {
  it('nur Gruppen mit „Nur abwesend“; Zusagen, Lesefehler, unlesbar und Wurf zählen nicht', async () => {
    const lader = (id: number): Promise<AbfragenStand> => {
      if (id === 1)
        return Promise.resolve(
          stand({ inhalt: { ...standardInhalt(), verfuegbarkeit: 'abwesend' } }),
        );
      if (id === 2) return Promise.resolve(stand({}));
      if (id === 3)
        return Promise.resolve(
          stand({
            inhalt: { ...standardInhalt(), verfuegbarkeit: 'abwesend' },
            fehler: 'voruebergehend',
          }),
        );
      if (id === 4)
        return Promise.resolve(
          stand({ inhalt: { ...standardInhalt(), verfuegbarkeit: 'abwesend' }, unlesbar: true }),
        );
      return Promise.reject(new Error('Netz'));
    };
    const regeln = await ladeRegeln(lader, [1, 2, 3, 4, 5], HEUTE);
    expect([...nurAbwesendAus(regeln)]).toEqual([1]);
  });

  it('ladeRegeln liest höchstens drei Dokumente gleichzeitig (ChurchTools bremst sonst)', async () => {
    let jetzt = 0;
    let hoechstens = 0;
    const lader = async (): Promise<AbfragenStand> => {
      jetzt++;
      hoechstens = Math.max(hoechstens, jetzt);
      await new Promise((r) => setTimeout(r, 0));
      jetzt--;
      return stand({});
    };
    const regeln = await ladeRegeln(lader, [1, 2, 3, 4, 5, 6, 7], HEUTE);
    expect(regeln.size).toBe(7);
    expect(hoechstens).toBe(3);
  });

  it('ohne Gruppen: leer', () => {
    expect(nurAbwesendAus(new Map()).size).toBe(0);
  });
});
