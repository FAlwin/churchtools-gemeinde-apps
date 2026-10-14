import { describe, expect, it } from 'vitest';
import { kuerzelAusBasis } from './kuerzel';

describe('kuerzelAusBasis', () => {
  it('liest das Kürzel aus /ccm/<Kürzel>/ – sonst null', () => {
    expect(kuerzelAusBasis('/ccm/dienstplaner/')).toBe('dienstplaner');
    expect(kuerzelAusBasis('/ccm/musik%20app/')).toBe('musik app');
    expect(kuerzelAusBasis('/')).toBeNull();
    expect(kuerzelAusBasis('/ccm/dienstplaner')).toBeNull();
    expect(kuerzelAusBasis('/ccm/a/b/')).toBeNull();
  });
});
