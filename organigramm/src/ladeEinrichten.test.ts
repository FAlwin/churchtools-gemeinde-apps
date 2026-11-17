import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { REGELN } from '@shared/organigramm/gruppenwechsel';
import { ladeKalenderNamen, ladeRegelnDerStufen, ladeTypVorhanden } from './ladeEinrichten';

const holenAus =
  (antworten: Record<string, unknown>) =>
  <T>(pfad: string): Promise<T> => {
    if (!(pfad in antworten)) return Promise.reject(new ApiError(404, 'nicht da'));
    const a = antworten[pfad];
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a as T);
  };

describe('ladeKalenderNamen', () => {
  it('die Namen, ohne Doppelte und ohne leere', async () => {
    const r = await ladeKalenderNamen(
      holenAus({
        '/calendars': [
          { name: 'Schulferien NRW' },
          { name: 'Gemeinde' },
          { name: 'Gemeinde' },
          { name: ' ' },
          {},
        ],
      }),
    );
    expect(r).toEqual({ ok: true, wert: ['Schulferien NRW', 'Gemeinde'] });
  });

  it.each([
    ['403', new ApiError(403, 'x')],
    ['401', new ApiError(401, 'x')],
    ['Netz', new TypeError('Failed to fetch')],
    ['503', new ApiError(503, 'x')],
    ['keine Liste', { data: 1 }],
  ])('%s: nicht gelesen – kein Abmelden, kein Wurf', async (_, antwort) => {
    expect(await ladeKalenderNamen(holenAus({ '/calendars': antwort }))).toEqual({ ok: false });
  });
});

describe('ladeTypVorhanden', () => {
  const typen = (...namen: string[]) => ({
    '/group/grouptypes': namen.map((name, i) => ({ id: i + 1, name, nameTranslated: 'egal' })),
  });

  it('es gibt einen Typ dieses Namens (Feld `name`)', async () => {
    expect(await ladeTypVorhanden(holenAus(typen('Dienst', 'Gruppenwechsel')))).toEqual({
      ok: true,
      wert: true,
    });
  });

  it('es gibt keinen – NUR wenn die Liste gelesen wurde', async () => {
    expect(await ladeTypVorhanden(holenAus(typen('Dienst', 'Kleingruppe')))).toEqual({
      ok: true,
      wert: false,
    });
  });

  it('die Übersetzung zählt nicht: „Gruppenwechsel“ als nameTranslated eines anderen Typs ist kein Treffer', async () => {
    const r = await ladeTypVorhanden(
      holenAus({
        '/group/grouptypes': [{ id: 1, name: 'Dienst', nameTranslated: 'Gruppenwechsel' }],
      }),
    );
    expect(r).toEqual({ ok: true, wert: false });
  });

  it.each([
    ['403', new ApiError(403, 'x')],
    ['401', new ApiError(401, 'x')],
    ['Netz', new TypeError('Failed to fetch')],
    ['500', new ApiError(500, 'x')],
    ['keine Liste', {}],
  ])('%s: nicht lesbar – nie „den Typ gibt es nicht“', async (_, antwort) => {
    expect(await ladeTypVorhanden(holenAus({ '/group/grouptypes': antwort }))).toEqual({
      ok: false,
    });
  });
});

describe('ladeRegelnDerStufen', () => {
  it('404 heißt keine Regeln, die Liste kann auch in dynamicGroupRuleSet stecken, alles andere ist nicht gelesen', async () => {
    const r = await ladeRegelnDerStufen(
      [1, 2, 3, 4, 5],
      holenAus({
        '/dynamicgroups/2/ruleset': [{ shorty: REGELN.kinder.shorty }],
        '/dynamicgroups/3/ruleset': { dynamicGroupRuleSet: [{ shorty: 'x' }] },
        '/dynamicgroups/4/ruleset': new ApiError(403, 'x'),
        '/dynamicgroups/5/ruleset': new TypeError('Failed to fetch'),
      }),
    );
    expect(r.get(1)).toEqual({ ok: true, wert: [] });
    expect(r.get(2)).toEqual({ ok: true, wert: [{ shorty: REGELN.kinder.shorty }] });
    expect(r.get(3)).toEqual({ ok: true, wert: [{ shorty: 'x' }] });
    expect(r.get(4)).toEqual({ ok: false });
    expect(r.get(5)).toEqual({ ok: false });
  });

  it('liest je Gruppe einmal und höchstens vier zugleich', async () => {
    let gleichzeitig = 0;
    let hoechstens = 0;
    const gerufen: string[] = [];
    const holen = async <T>(pfad: string): Promise<T> => {
      gerufen.push(pfad);
      gleichzeitig++;
      hoechstens = Math.max(hoechstens, gleichzeitig);
      await new Promise((r) => setTimeout(r, 1));
      gleichzeitig--;
      return [] as unknown as T;
    };
    await ladeRegelnDerStufen([1, 2, 3, 4, 5, 6, 7, 8, 1], holen);
    expect(gerufen).toHaveLength(8);
    expect(hoechstens).toBeLessThanOrEqual(4);
  });
});
