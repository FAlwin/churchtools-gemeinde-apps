import { describe, expect, it } from 'vitest';
import { istLeer, rohWert, wertGleich } from './feldwert';

/** F5c – Rohwerte aus ChurchTools (gemessen 17.11.2026, `messung-f5c-2026-11-17.md`). */
describe('Rohwerte aus ChurchTools (F5c)', () => {
  it('Text bleibt Text, Zahl wird Text, Mehrfachauswahl eine Liste, anderes leer', () => {
    expect(rohWert(' Kids ')).toBe(' Kids ');
    expect(rohWert(3)).toBe('3');
    expect(rohWert(['235', 241])).toEqual(['235', '241']);
    expect(rohWert([])).toEqual([]);
    expect(rohWert(null)).toBeNull();
    expect(rohWert({ a: 1 })).toBeNull();
  });

  it('leer: nichts, nur Leerzeichen oder eine leere Liste', () => {
    expect([istLeer(null), istLeer('  '), istLeer([]), istLeer('x'), istLeer(['1'])]).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('Nachprüfen: leer gleicht []; Listen ohne Rücksicht auf die Reihenfolge; Kästchen als 1', () => {
    expect(wertGleich(null, [])).toBe(true);
    expect(wertGleich([], null)).toBe(true);
    expect(wertGleich(['235', '241'], ['241', '235'])).toBe(true);
    expect(wertGleich(['235'], ['235', '241'])).toBe(false);
    expect(wertGleich(['235'], '235')).toBe(false);
    expect(wertGleich('Kids', 'Kids')).toBe(true);
    expect(wertGleich('3', 3)).toBe(true);
    expect(wertGleich(true, '1')).toBe(true);
    expect(wertGleich(false, '0')).toBe(true);
    expect(wertGleich(null, 'x')).toBe(false);
  });
});
