import { describe, expect, it } from 'vitest';
import { ortszeitAus, tagAusIso, utcAus } from './zeit';

const BERLIN = 'Europe/Berlin';

describe('ortszeitAus – die eine Umrechnung UTC → Ortszeit', () => {
  it('Sommer- und Winterzeit (ChurchTools liefert UTC mit Z)', () => {
    expect(ortszeitAus('2026-10-18T08:00:00Z', BERLIN)).toBe('2026-10-18T10:00');
    expect(ortszeitAus('2026-11-15T09:00:00Z', BERLIN)).toBe('2026-11-15T10:00');
  });

  it('kurz nach Mitternacht Ortszeit liegt auf dem neuen Tag, nicht auf dem UTC-Tag', () => {
    expect(ortszeitAus('2026-10-03T22:30:00Z', BERLIN)).toBe('2026-10-04T00:30');
    expect(tagAusIso('2026-10-03T22:30:00Z', BERLIN)).toBe('2026-10-04');
  });

  it('ohne Zeitzonen-Angabe bleibt die Zeit, wie sie im Text steht – egal, wo das Gerät steht', () => {
    expect(ortszeitAus('2026-10-04T08:00:00', BERLIN)).toBe('2026-10-04T08:00');
    expect(ortszeitAus('2026-10-04', BERLIN)).toBe('2026-10-04T00:00');
    expect(tagAusIso('2026-10-04', BERLIN)).toBe('2026-10-04');
  });

  it('tagAusIso ist genau der Tag von ortszeitAus (eine Rechnung, nicht zwei)', () => {
    for (const z of ['2026-03-29T00:30:00Z', '2026-10-25T00:30:00Z', '2026-12-31T23:30:00Z']) {
      expect(tagAusIso(z, BERLIN)).toBe(ortszeitAus(z, BERLIN).slice(0, 10));
    }
  });

  it('hin und zurück über utcAus, auch am Tag der Zeitumstellung', () => {
    for (const lokal of ['2026-03-29T10:00', '2026-10-25T10:00', '2026-07-01T23:59']) {
      expect(ortszeitAus(utcAus(lokal, BERLIN), BERLIN)).toBe(lokal);
    }
  });
});
