import { describe, expect, it } from 'vitest';
import { MIN_AUSFUELLZEIT_MS, spamGrund } from './spamschutz';

describe('Spam-Schutz (A6-3)', () => {
  it('Honigtopf gefüllt → Bot, egal wie lange es gedauert hat', () => {
    expect(spamGrund({ honigtopf: 'https://spam.example', seitDemLadenMs: 60_000 })).toBe(
      'honigtopf',
    );
  });
  it('schneller als die Mindestzeit → zu schnell; genau ab der Mindestzeit → in Ordnung', () => {
    expect(spamGrund({ honigtopf: '', seitDemLadenMs: MIN_AUSFUELLZEIT_MS - 1 })).toBe('zuSchnell');
    expect(spamGrund({ honigtopf: '', seitDemLadenMs: MIN_AUSFUELLZEIT_MS })).toBeNull();
  });
  it('nur Leerzeichen im Honigtopf zählen nicht', () => {
    expect(spamGrund({ honigtopf: '  ', seitDemLadenMs: 10_000 })).toBeNull();
  });
});
