import { describe, expect, it } from 'vitest';
import * as protokolle from '../protokolle/speicher';
import { SPERRE_MINUTEN, sperreLage, sperreVon } from './sperre';

const ICH = { person: 1, name: 'Helene Wiebe', fenster: 'f1' };
const JETZT = new Date('2026-11-20T10:00:00Z');
const vor = (minuten: number) => new Date(JETZT.getTime() - minuten * 60_000).toISOString();

describe('Schreibsperre (gemeinsam für Protokolle und Website)', () => {
  it('keine Sperre: frei', () => {
    expect(sperreLage(null, ICH, JETZT)).toBe('frei');
  });

  it('die eigene Sperre im eigenen Fenster: meine – dieselbe Person im anderen Fenster oder eine andere Person: fremd', () => {
    const s = sperreVon(ICH, JETZT);
    expect(sperreLage(s, ICH, JETZT)).toBe('meine');
    expect(sperreLage(s, { ...ICH, fenster: 'f2' }, JETZT)).toBe('fremd');
    expect(sperreLage(s, { ...ICH, person: 2 }, JETZT)).toBe('fremd');
  });

  it('eine verlassene Sperre (zehn Minuten ohne Lebenszeichen) gilt nicht mehr', () => {
    const fremd = { von: 2, name: 'Jonas', seit: vor(SPERRE_MINUTEN - 1), fenster: 'x' };
    expect(sperreLage(fremd, ICH, JETZT)).toBe('fremd');
    expect(sperreLage({ ...fremd, seit: vor(SPERRE_MINUTEN + 1) }, ICH, JETZT)).toBe('frei');
    expect(sperreLage({ ...fremd, seit: 'kein Datum' }, ICH, JETZT)).toBe('frei');
  });

  it('sperreVon trägt Person, Name, Fenster und die Zeit des Lebenszeichens', () => {
    expect(sperreVon(ICH, JETZT)).toEqual({
      von: 1,
      name: 'Helene Wiebe',
      seit: '2026-11-20T10:00:00.000Z',
      fenster: 'f1',
    });
  });

  it('die Protokolle benutzen DIESELBEN Funktionen (keine zweite Kopie der Regel)', async () => {
    const eigen = await import('./sperre');
    expect(protokolle.sperreLage).toBe(eigen.sperreLage);
    expect(protokolle.sperreVon).toBe(eigen.sperreVon);
    expect(protokolle.SPERRE_MINUTEN).toBe(eigen.SPERRE_MINUTEN);
  });
});
