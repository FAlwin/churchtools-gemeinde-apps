import { afterEach, describe, expect, it } from 'vitest';
import {
  _vergissGemeindeZeitzone,
  gemeindeZeitzone,
  geraeteZeitzone,
  heuteImKalender,
  merkeGemeindeZeitzone,
  ortszeitAus,
  tagAusIso,
  utcAus,
  wannText,
  zeitzoneAusKonfig,
} from './zeit';

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

describe('wannText (E4-3-3)', () => {
  const jetzt = new Date('2026-10-14T20:00:00Z');
  it('heute → „heute HH:MM“ in Ortszeit der Gemeinde', () => {
    expect(wannText('2026-10-14T16:42:00.000Z', 'Europe/Berlin', jetzt)).toBe('heute 18:42');
  });
  it('anderer Tag → „TT.MM. HH:MM“; der Tag zählt in Ortszeit, nicht in UTC', () => {
    expect(wannText('2026-10-12T07:05:00.000Z', 'Europe/Berlin', jetzt)).toBe('12.10. 09:05');
    // 23:30 UTC am 13. ist in Berlin schon der 14. – also „heute“.
    expect(wannText('2026-10-13T22:30:00.000Z', 'Europe/Berlin', jetzt)).toBe('heute 00:30');
  });
});

/**
 * #847: Die Zeitzone der Gemeinde kommt aus ChurchTools (`/api/config`). Geprüft mit einer Zone, die KEIN Gerät der
 * Testläufe hat (UTC+14) – sonst wäre jeder Test auch mit der Gerätezeitzone grün.
 */
describe('Zeitzone der Gemeinde (#847)', () => {
  const WEIT_WEG = 'Pacific/Kiritimati';
  afterEach(() => _vergissGemeindeZeitzone());

  it('aus /api/config gelesen, Leerzeichen weg', () => {
    expect(zeitzoneAusKonfig({ timezone: ' Europe/Berlin ' })).toBe('Europe/Berlin');
  });

  it('fehlend, leer, kein Text oder dem Browser unbekannt → null', () => {
    expect(zeitzoneAusKonfig(null)).toBeNull();
    expect(zeitzoneAusKonfig({})).toBeNull();
    expect(zeitzoneAusKonfig({ timezone: '  ' })).toBeNull();
    expect(zeitzoneAusKonfig({ timezone: 7 })).toBeNull();
    expect(zeitzoneAusKonfig({ timezone: 'Mars/Olympus_Mons' })).toBeNull();
  });

  it('nicht geladen → die des Geräts', () => {
    expect(gemeindeZeitzone()).toBe(geraeteZeitzone());
  });

  it('geladen → die der Gemeinde; eine unbrauchbare Angabe danach ändert nichts', () => {
    merkeGemeindeZeitzone({ timezone: WEIT_WEG });
    expect(gemeindeZeitzone()).toBe(WEIT_WEG);
    merkeGemeindeZeitzone({ timezone: 'Mars/Olympus_Mons' });
    merkeGemeindeZeitzone(null);
    expect(gemeindeZeitzone()).toBe(WEIT_WEG);
  });

  it('„heute“ ist der Tag in der Gemeinde, nicht auf dem Gerät', () => {
    const jetzt = new Date('2026-11-05T11:30:00Z'); // in UTC+14 schon der 6.
    expect(heuteImKalender(jetzt)).toBe(tagAusIso(jetzt.toISOString(), geraeteZeitzone()));
    merkeGemeindeZeitzone({ timezone: WEIT_WEG });
    expect(heuteImKalender(jetzt)).toBe('2026-11-06');
  });
});
