import { describe, expect, it } from 'vitest';
import { MAX_BILDPUNKTE, wirksamerMassstab } from './leinwand';

/** Größte Leinwand für iOS (#607): Eine sehr lange Rolle bliebe sonst still leer. */
describe('wirksamerMassstab', () => {
  const A4 = { width: 595, height: 842 }; // PDF-Punkte bei Maßstab 1

  it('A4 zeichnet mit dem gewünschten Maßstab', () => {
    expect(wirksamerMassstab(A4, 2)).toBe(2);
  });

  it('eine sehr lange Rolle wird so weit verkleinert, dass sie unter die Grenze passt', () => {
    const rolle = { width: 595, height: 842 * 12 };
    const s = wirksamerMassstab(rolle, 2);
    expect(s).toBeLessThan(2);
    expect(rolle.width * s * rolle.height * s).toBeLessThanOrEqual(MAX_BILDPUNKTE + 1);
  });
});
