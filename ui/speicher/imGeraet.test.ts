// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leseImGeraet, merkeImGeraet, texte } from './imGeraet';

/**
 * Der gemeinsame Gerätespeicher der Erweiterungen (U2-4: vorher je eine Kopie in Dienstplaner und Organigramm). Die
 * Leser der Apps sind dort getestet (`dienstplaner/src/imGeraet.test.ts`, Organigramm über `auswahl.ts`).
 */
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Im Gerät merken', () => {
  it('merkt und liest zurück; geprüft über `aus`', () => {
    merkeImGeraet('probe', ['a', 1, 'b']);
    expect(leseImGeraet('probe', [], texte)).toEqual(['a', 'b']);
    expect(leseImGeraet('fehlt', ['vorgabe'], texte)).toEqual(['vorgabe']);
  });

  it('Speicher gesperrt (privater Modus) → Vorgabe, und Merken wirft nicht', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    expect(leseImGeraet('x', 'vorgabe', String)).toBe('vorgabe');
    expect(() => merkeImGeraet('x', 1)).not.toThrow();
  });

  it('Unsinn im Speicher → Vorgabe', () => {
    localStorage.setItem('kaputt', '{nicht json');
    expect(leseImGeraet('kaputt', ['v'], texte)).toEqual(['v']);
    expect(texte({ kein: 'feld' })).toEqual([]);
  });
});
