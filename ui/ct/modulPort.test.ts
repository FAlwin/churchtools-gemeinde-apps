import { describe, expect, it } from 'vitest';
import { kuerzelAus } from './modulPort';

describe('kuerzelAus', () => {
  it('liest das Kürzel aus /ccm/<kürzel>/ – sonst null', () => {
    expect(kuerzelAus('/ccm/anmeldungen/')).toBe('anmeldungen');
    expect(kuerzelAus('/ccm/musik%20app/')).toBe('musik app');
    expect(kuerzelAus('/')).toBeNull();
    expect(kuerzelAus('/ccm/a/b/')).toBeNull();
  });
});
