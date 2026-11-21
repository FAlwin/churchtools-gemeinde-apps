import { describe, expect, it } from 'vitest';
import { schreibbareKalender } from './kalenderRechte';

describe('schreibbareKalender', () => {
  it('liest die Kalender aus „edit category“ (auch als Text)', () => {
    expect([...schreibbareKalender({ churchcal: { 'edit category': [4, '7'] } })]).toEqual([4, 7]);
  });
  it.each([
    ['null', null],
    ['ohne churchcal', {}],
    ['ohne Eintrag', { churchcal: {} }],
    ['kein Feld', { churchcal: { 'edit category': true } }],
    ['Unsinn in der Liste', { churchcal: { 'edit category': ['x', 0, -1, 2.5] } }],
  ])('%s → keine Kalender', (_, rechte) => {
    expect(schreibbareKalender(rechte).size).toBe(0);
  });
});
