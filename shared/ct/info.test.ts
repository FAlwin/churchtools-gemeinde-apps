import { describe, expect, it } from 'vitest';
import { gemeindeNameAus } from './info';

describe('gemeindeNameAus', () => {
  it('nimmt siteName, ohne Leerraum am Rand', () => {
    expect(gemeindeNameAus({ siteName: ' Evangeliumschristen- Gemeinde e.V. ' })).toBe(
      'Evangeliumschristen- Gemeinde e.V.',
    );
  });
  it('kein, leerer oder falscher Name → null', () => {
    expect(gemeindeNameAus({ siteName: '  ' })).toBeNull();
    expect(gemeindeNameAus({ siteName: 3 })).toBeNull();
    expect(gemeindeNameAus({})).toBeNull();
    expect(gemeindeNameAus(null)).toBeNull();
  });
});
