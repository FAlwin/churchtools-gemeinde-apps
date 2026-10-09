// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lokalSchreiben,
  setSpeicherVollMelder,
  SPEICHER_VOLL_MELDUNG,
  __resetLokalSpeicherForTests,
} from './lokalSpeicher';

/** Die EINE Stelle, die in den Gerätespeicher schreibt (#457). */
function speicherVoll() {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('voll', 'QuotaExceededError');
  });
}

beforeEach(() => {
  localStorage.clear();
  __resetLokalSpeicherForTests();
});
afterEach(() => vi.restoreAllMocks());

describe('lokalSchreiben', () => {
  it('schreibt und löscht (null)', () => {
    expect(lokalSchreiben('a', '1')).toBe(true);
    expect(localStorage.getItem('a')).toBe('1');
    expect(lokalSchreiben('a', null)).toBe(true);
    expect(localStorage.getItem('a')).toBeNull();
  });

  it('voller Speicher: wirft NICHT, sagt false – und meldet nur EINMAL je Sitzung', () => {
    const melder = vi.fn();
    setSpeicherVollMelder(melder);
    speicherVoll();
    expect(lokalSchreiben('a', '1')).toBe(false);
    expect(lokalSchreiben('b', '2')).toBe(false);
    expect(melder).toHaveBeenCalledTimes(1);
    expect(melder).toHaveBeenCalledWith(SPEICHER_VOLL_MELDUNG);
  });
});
