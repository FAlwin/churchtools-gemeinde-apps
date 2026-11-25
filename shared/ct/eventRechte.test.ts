import { describe, expect, it } from 'vitest';
import { eventKalender } from './eventRechte';

/** Recht „Events anlegen“ (W15-3): `churchservice` → `edit events` = Kalender-IDs, gemessen 23.11.2026. */
describe('eventKalender', () => {
  it('liest die Kalender-IDs – Zahlen und Zahlentexte', () => {
    expect([...eventKalender({ churchservice: { 'edit events': [4, '2'] } })]).toEqual([4, 2]);
  });

  it('gilt je Kalender: ein Kalender in der Liste, der andere nicht', () => {
    const k = eventKalender({ churchservice: { 'edit events': [4] } });
    expect(k.has(4)).toBe(true);
    expect(k.has(2)).toBe(false);
  });

  it('fehlt der Eintrag oder hat er eine andere Form: keine Kalender', () => {
    for (const roh of [
      null,
      undefined,
      {},
      { churchservice: {} },
      { churchservice: { 'edit events': true } },
      { churchservice: { 'edit events': 'alle' } },
      { churchcal: { 'edit events': [4] } },
    ])
      expect(eventKalender(roh).size).toBe(0);
  });
});
