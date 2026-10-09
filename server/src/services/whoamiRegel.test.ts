import { describe, it, expect } from 'vitest';
import { whoamiId } from '@shared/ct/whoami';

/**
 * Die whoami-Regel (#381), seit #463 an EINER Stelle für Server und Erweiterung. Drei Ausgänge:
 * angemeldet (ID), ausdrücklich niemand (0), unlesbar (null) – „unlesbar" ist nicht „niemand".
 */
describe('whoamiId', () => {
  it('eine echte Person – auch wenn ChurchTools die ID als Zeichenkette schickt', () => {
    expect(whoamiId({ id: 42 })).toBe(42);
    expect(whoamiId({ id: '42' })).toBe(42);
  });

  it('der Phantom-Nutzer ohne Sitzung (id -1, HTTP 200) heißt: niemand', () => {
    expect(whoamiId({ id: -1, lastName: 'Anonymous' })).toBe(0);
    expect(whoamiId({ id: '-1' })).toBe(0);
    expect(whoamiId({ id: 0 })).toBe(0);
  });

  it('ohne lesbare ID: unklar – NICHT niemand', () => {
    expect(whoamiId(null)).toBeNull();
    expect(whoamiId({})).toBeNull();
    expect(whoamiId({ id: 'x' })).toBeNull();
  });
});
