import { afterEach, describe, expect, it, vi } from 'vitest';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';

/**
 * Der eine Baustein für „Versprechen merken, bei Fehlschlag vergessen" (#463) – vorher fünfmal von
 * Hand, mit Abweichungen zwischen den Kopien.
 */
afterEach(() => vi.useRealTimers());

/** Ein Versprechen, das der Test selbst erfüllt oder scheitern lässt. */
function offen<T>() {
  let erfuellen!: (v: T) => void;
  let scheitern!: (e: unknown) => void;
  const p = new Promise<T>((a, b) => {
    erfuellen = a;
    scheitern = b;
  });
  return { p, erfuellen, scheitern };
}

describe('merkeVersprechen', () => {
  it('drei gleichzeitige Fragen → EIN Abruf', async () => {
    const m = merkeVersprechen<number>();
    const laden = vi.fn(() => Promise.resolve(7));
    const r = await Promise.all([m.hole('a', laden), m.hole('a', laden), m.hole('a', laden)]);
    expect(r).toEqual([7, 7, 7]);
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('ein Fehlschlag wird NICHT gemerkt – der nächste Aufruf fragt neu', async () => {
    const m = merkeVersprechen<number>();
    await expect(m.hole('a', () => Promise.reject(new Error('weg')))).rejects.toThrow('weg');
    await expect(m.hole('a', () => Promise.resolve(2))).resolves.toBe(2);
  });

  it('Wächter: ein spät scheiterndes ALTES Versprechen löscht den neueren Eintrag nicht', async () => {
    // Genau die Abweichung, die `ctTeilen` hatte: Dort löschte das alte Versprechen blind.
    vi.useFakeTimers({ toFake: ['Date'] });
    const m = merkeVersprechen<number>({ ttlMs: 1_000 });
    const alt = offen<number>();
    const altP = m.hole('a', () => alt.p);
    vi.setSystemTime(Date.now() + 2_000); // abgelaufen → neuer Abruf
    await expect(m.hole('a', () => Promise.resolve(5))).resolves.toBe(5);
    alt.scheitern(new Error('spät'));
    await expect(altP).rejects.toThrow('spät');
    const laden = vi.fn(() => Promise.resolve(9));
    await expect(m.hole('a', laden)).resolves.toBe(5); // der neuere steht noch
    expect(laden).not.toHaveBeenCalled();
  });

  it('`behalten: false` → das Ergebnis kommt an, wird aber nicht gemerkt', async () => {
    const m = merkeVersprechen<string | null>({ behalten: (t) => t !== null });
    await expect(m.hole('csrf', () => Promise.resolve(null))).resolves.toBeNull();
    await expect(m.hole('csrf', () => Promise.resolve('tok'))).resolves.toBe('tok');
    const laden = vi.fn(() => Promise.resolve('anders'));
    await expect(m.hole('csrf', laden)).resolves.toBe('tok');
    expect(laden).not.toHaveBeenCalled();
  });

  it('Verfallszeit: danach wird neu gefragt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const m = merkeVersprechen<number>({ ttlMs: 60_000 });
    await m.hole('a', () => Promise.resolve(1));
    vi.setSystemTime(Date.now() + 59_000);
    await expect(m.hole('a', () => Promise.resolve(2))).resolves.toBe(1);
    vi.setSystemTime(Date.now() + 2_000);
    await expect(m.hole('a', () => Promise.resolve(3))).resolves.toBe(3);
  });

  it('je Schlüssel getrennt; vergiss(schlüssel) und vergiss()', async () => {
    const m = merkeVersprechen<number>();
    await m.hole(1, () => Promise.resolve(10));
    await m.hole(2, () => Promise.resolve(20));
    m.vergiss(1);
    await expect(m.hole(1, () => Promise.resolve(11))).resolves.toBe(11);
    await expect(m.hole(2, () => Promise.resolve(21))).resolves.toBe(20);
    m.vergiss();
    await expect(m.hole(2, () => Promise.resolve(22))).resolves.toBe(22);
  });
});
