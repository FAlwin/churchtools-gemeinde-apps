// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leseAnsicht, leseAusgeblendet, merkeAnsicht, merkeAusgeblendet } from './auswahl';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Ansicht merken (O7b-2)', () => {
  it('ohne Wahl → null (dann entscheidet die Bildschirmbreite); gemerkt → zurück', () => {
    expect(leseAnsicht()).toBeNull();
    merkeAnsicht('liste');
    expect(leseAnsicht()).toBe('liste');
    merkeAnsicht('karten');
    expect(leseAnsicht()).toBe('karten');
  });

  it('auch die Diagramme (O7b-3) kommen gemerkt zurück', () => {
    for (const a of ['oben', 'links', 'mindmap'] as const) {
      merkeAnsicht(a);
      expect(leseAnsicht()).toBe(a);
    }
  });

  it('Unbekanntes oder Kaputtes im Speicher → null, nicht kaputt', () => {
    localStorage.setItem('organigramm-ansicht', '"ringe"');
    expect(leseAnsicht()).toBeNull();
    localStorage.setItem('organigramm-ansicht', '{kaputt');
    expect(leseAnsicht()).toBeNull();
  });

  it('Speicher gesperrt (privates Fenster) → Lesen null, Schreiben wirft nicht', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    expect(leseAnsicht()).toBeNull();
    expect(() => merkeAnsicht('liste')).not.toThrow();
    expect(leseAusgeblendet()).toEqual(new Set());
    expect(() => merkeAusgeblendet(new Set([9]))).not.toThrow();
  });
});

describe('Typen merken (O2) – über dieselbe Mechanik', () => {
  it('Zahlen zurück, alles andere fällt weg', () => {
    merkeAusgeblendet(new Set([9, 4]));
    expect(leseAusgeblendet()).toEqual(new Set([9, 4]));
    localStorage.setItem('organigramm-ausgeblendete-typen', '[1, "2", 3.5, null]');
    expect(leseAusgeblendet()).toEqual(new Set([1]));
    localStorage.setItem('organigramm-ausgeblendete-typen', '{"a":1}');
    expect(leseAusgeblendet()).toEqual(new Set());
  });
});
