import { describe, expect, it } from 'vitest';
import { eventInfosKalender, eventKalender } from './eventRechte';

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

/** Infos eines Events ändern (Reihe → In Events übertragen): dasselbe Recht, aber `null` = alle Kalender. */
describe('eventInfosKalender', () => {
  it('liest die Kalender-IDs – Zahlen und Zahlentexte, ohne Erfundenes', () => {
    expect(eventInfosKalender({ churchservice: { 'edit events': [4, '2', null] } })).toEqual([
      4, 2,
    ]);
  });

  it('ein Recht ohne Aufzählung gilt für alle Kalender (null) – kein „darfst du nicht“', () => {
    expect(eventInfosKalender({ churchservice: { 'edit events': true } })).toBeNull();
  });

  it('fehlt das Recht: keine Kalender', () => {
    for (const roh of [
      null,
      undefined,
      {},
      { churchservice: {} },
      { churchservice: { 'edit events': false } },
    ])
      expect(eventInfosKalender(roh)).toEqual([]);
  });
});
