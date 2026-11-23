import { describe, expect, it } from 'vitest';
import { utcAus } from '@shared/ct/zeit';
import { liveKnopfOffen } from './liveFenster';

/**
 * **Wann der Knopf „Live-Ansicht“ steht** – die Tagesgrenze in der Ortszeit der Gemeinde, nicht des Browsers. Die Zeitpunkte
 * entstehen aus der Ortszeit (`utcAus`), nicht als eingetippte UTC-Zahlen; der Test läuft in UTC (CI) und bleibt gleich.
 */
const ZONE = 'Europe/Berlin';
const um = (lokal: string) => new Date(utcAus(lokal, ZONE));
const gottesdienst = {
  tag: '2026-11-29',
  beginn: utcAus('2026-11-29T10:00', ZONE),
  ende: utcAus('2026-11-29T11:30', ZONE),
};

describe('liveKnopfOffen', () => {
  it('am Vortag um 23:59 noch nicht, am Tag um 00:00 ja (Ortszeit der Gemeinde)', () => {
    expect(liveKnopfOffen(gottesdienst, um('2026-11-28T23:59'), ZONE)).toBe(false);
    expect(liveKnopfOffen(gottesdienst, um('2026-11-29T00:00'), ZONE)).toBe(true);
  });

  it('vor Beginn, mittendrin und genau zum Ende ja – nach dem Ende nicht mehr', () => {
    expect(liveKnopfOffen(gottesdienst, um('2026-11-29T07:00'), ZONE)).toBe(true);
    expect(liveKnopfOffen(gottesdienst, um('2026-11-29T10:45'), ZONE)).toBe(true);
    expect(liveKnopfOffen(gottesdienst, um('2026-11-29T11:30'), ZONE)).toBe(true);
    expect(liveKnopfOffen(gottesdienst, um('2026-11-29T11:31'), ZONE)).toBe(false);
  });

  it('Termin über Mitternacht: bleibt bis zu seinem Ende offen, danach nicht', () => {
    const nacht = {
      tag: '2026-11-28',
      beginn: utcAus('2026-11-28T23:00', ZONE),
      ende: utcAus('2026-11-29T01:00', ZONE),
    };
    expect(liveKnopfOffen(nacht, um('2026-11-28T00:00'), ZONE)).toBe(true);
    expect(liveKnopfOffen(nacht, um('2026-11-29T00:30'), ZONE)).toBe(true);
    expect(liveKnopfOffen(nacht, um('2026-11-29T01:01'), ZONE)).toBe(false);
  });

  it('ohne eigenes Ende (Ende = Beginn): der Tag bis 24 Uhr', () => {
    const ohne = {
      tag: '2026-11-29',
      beginn: utcAus('2026-11-29T10:00', ZONE),
      ende: utcAus('2026-11-29T10:00', ZONE),
    };
    expect(liveKnopfOffen(ohne, um('2026-11-29T23:59'), ZONE)).toBe(true);
    expect(liveKnopfOffen(ohne, um('2026-11-30T00:00'), ZONE)).toBe(false);
    expect(liveKnopfOffen(ohne, um('2026-11-28T23:59'), ZONE)).toBe(false);
  });

  it('die Tagesgrenze folgt der Zeitzone der Gemeinde: dieselbe Uhrzeit ist in New York noch Vortag', () => {
    const zeit = new Date(utcAus('2026-11-29T00:00', ZONE)); // 23:00 UTC am Vortag
    expect(liveKnopfOffen(gottesdienst, zeit, ZONE)).toBe(true);
    const ny = { ...gottesdienst, beginn: utcAus('2026-11-29T10:00', 'America/New_York') };
    expect(
      liveKnopfOffen(
        { ...ny, ende: utcAus('2026-11-29T11:30', 'America/New_York') },
        zeit,
        'America/New_York',
      ),
    ).toBe(false);
  });
});
