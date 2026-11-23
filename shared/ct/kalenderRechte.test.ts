import { describe, expect, it } from 'vitest';
import { darfTagsVerwalten, schreibbareKalender, vorlagenKalender } from './kalenderRechte';

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

describe('vorlagenKalender und darfTagsVerwalten (W15-1)', () => {
  it('liest die Kalender aus „edit calendar entry template“', () => {
    expect([
      ...vorlagenKalender({ churchcal: { 'edit calendar entry template': [4, '2'] } }),
    ]).toEqual([4, 2]);
    expect(vorlagenKalender({ churchcal: { 'edit category': [4] } }).size).toBe(0);
    expect(vorlagenKalender(null).size).toBe(0);
  });
  it('Tags anlegen nur bei einem eindeutigen Ja (true oder nicht leere Liste)', () => {
    expect(darfTagsVerwalten({ churchcal: { 'admin appointment tags': true } })).toBe(true);
    expect(darfTagsVerwalten({ churchcal: { 'admin appointment tags': [1] } })).toBe(true);
    expect(darfTagsVerwalten({ churchcal: { 'admin appointment tags': [] } })).toBe(false);
    expect(darfTagsVerwalten({ churchcal: {} })).toBe(false);
    expect(darfTagsVerwalten(null)).toBe(false);
  });
});
