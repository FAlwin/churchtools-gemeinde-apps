import { describe, expect, it } from 'vitest';
import { ApiError } from './fehler';
import { KeinSpeicherRecht } from './verbindung';
import { entwurfPortFuer } from './modulPort';

describe('entwurfPortFuer', () => {
  const p = entwurfPortFuer(() => 'dienstplaner');

  it('fehlendes Recht ist nie „abgemeldet“ – ChurchTools meldet es als 401 „Session abgelaufen“ (gemessen)', () => {
    const recht = new KeinSpeicherRecht('kein Recht');
    expect(p.istKeinRecht(recht)).toBe(true);
    expect(p.istAbgemeldet(recht)).toBe(false);
  });

  it('nur ein echter 401 ist abgemeldet; 404 = nicht gefunden; alles andere weder noch', () => {
    expect(p.istAbgemeldet(new ApiError(401, 'weg'))).toBe(true);
    expect(p.istKeinRecht(new ApiError(401, 'weg'))).toBe(false);
    expect(p.istNichtGefunden(new ApiError(404, 'weg'))).toBe(true);
    for (const e of [new ApiError(503, 'x'), new Error('Netz'), null]) {
      expect([p.istAbgemeldet(e), p.istKeinRecht(e), p.istNichtGefunden(e)]).toEqual([
        false,
        false,
        false,
      ]);
    }
    expect(p.kuerzel()).toBe('dienstplaner');
    const t = p.jetzt();
    expect(new Date(t).toISOString()).toBe(t);
  });
});
