import { describe, expect, it } from 'vitest';
import { QR_RAND, qrGroesse, qrMuster, qrPfad } from './qr';

/** QR-Code (A8-4): Ob er sich lesen lässt, prüft die Gegenprobe mit einem echten Leser (siehe PR); hier der Aufbau. */
describe('QR-Code', () => {
  const LINK = 'https://anmeldung.ecg-donrath.de/#test-ecg-donrath.church.tools/165';

  it('quadratisch, Größe nach Norm (21 + 4 je Version), Suchmuster in drei Ecken', () => {
    const m = qrMuster(LINK);
    const n = m.length;
    expect(m.every((z) => z.length === n)).toBe(true);
    expect((n - 21) % 4).toBe(0);
    // Ein Suchmuster: 7×7 Rand dunkel, innen 3×3 dunkel, dazwischen hell.
    const such = (r: number, c: number) =>
      [0, 6].every((i) => [0, 1, 2, 3, 4, 5, 6].every((j) => m[r + i][c + j] && m[r + j][c + i])) &&
      !m[r + 1][c + 1] &&
      m[r + 3][c + 3];
    expect([such(0, 0), such(0, n - 7), such(n - 7, 0)]).toEqual([true, true, true]);
    // Die vierte Ecke hat keins.
    expect(such(n - 7, n - 7)).toBe(false);
  });

  it('der SVG-Pfad hat ein Quadrat je dunklem Modul, mit Ruhezone versetzt', () => {
    const m = qrMuster('A');
    const dunkel = m.flat().filter(Boolean).length;
    const pfad = qrPfad(m);
    expect(pfad.split('M').length - 1).toBe(dunkel);
    expect(pfad.startsWith(`M${QR_RAND} ${QR_RAND}h1v1h-1z`)).toBe(true);
    expect(qrGroesse(m)).toBe(m.length + 2 * QR_RAND);
  });

  it('anderer Link → anderes Muster', () => {
    expect(qrMuster(`${LINK}0`)).not.toEqual(qrMuster(LINK));
  });
});
