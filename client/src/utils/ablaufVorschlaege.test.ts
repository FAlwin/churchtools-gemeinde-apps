import { describe, expect, it } from 'vitest';
import type { AblaufVorlage, Service } from '@shared/types/index';
import { kopieVorschlaege, startQuelle, vorlagenFuer } from './ablaufVorschlaege';

function termin(id: number, start: string, kalenderId?: number): Service {
  return {
    id,
    day: '',
    month: '',
    weekday: '',
    name: `T${id}`,
    subtitle: null,
    date: start.slice(0, 10),
    start,
    time: '',
    location: '',
    songCount: 0,
    setlistChanged: false,
    ...(kalenderId !== undefined ? { kalenderId } : {}),
  };
}

const V = (id: number, kalenderId: number | null): AblaufVorlage => ({
  id,
  name: `V${id}`,
  kalenderId,
  punkte: 3,
});

describe('vorlagenFuer', () => {
  it('die Vorlagen des eigenen Kalenders zuerst, sonst Reihenfolge behalten', () => {
    expect(vorlagenFuer([V(1, 3), V(2, 2), V(3, null), V(4, 2)], 2).map((v) => v.id)).toEqual([
      2, 4, 1, 3,
    ]);
  });

  it('ohne bekannten Kalender: unverändert', () => {
    expect(vorlagenFuer([V(1, 3), V(2, 2)]).map((v) => v.id)).toEqual([1, 2]);
  });
});

describe('kopieVorschlaege', () => {
  const ziel = termin(10, '2026-10-25T09:00:00Z', 2);

  it('frühere aus demselben Kalender, die jüngste zuerst („letzter Sonntag")', () => {
    const liste = [
      termin(1, '2026-10-11T09:00:00Z', 2),
      termin(2, '2026-10-18T09:00:00Z', 2),
      termin(3, '2026-10-21T17:00:00Z', 3),
      termin(4, '2026-11-01T09:00:00Z', 2),
    ];
    expect(kopieVorschlaege(ziel, liste).map((s) => s.id)).toEqual([2, 1]);
  });

  it('nie der Termin selbst', () => {
    expect(kopieVorschlaege(ziel, [termin(10, '2026-10-18T09:00:00Z', 2)])).toEqual([]);
  });

  it('kennt der Termin seinen Kalender nicht: alle früheren', () => {
    const ohne = termin(10, '2026-10-25T09:00:00Z');
    expect(
      kopieVorschlaege(ohne, [
        termin(1, '2026-10-18T09:00:00Z', 2),
        termin(2, '2026-10-21T09:00:00Z', 3),
      ]).map((s) => s.id),
    ).toEqual([2, 1]);
  });
});

describe('startQuelle – „Vorlage zuerst" (Alwin, 13.10.2026)', () => {
  const frueher = [termin(2, '2026-10-18T09:00:00Z', 2)];

  it('gibt es Vorlagen: die erste', () => {
    expect(startQuelle([V(7, 2), V(8, 2)], frueher)).toEqual({ art: 'vorlage', vorlageId: 7 });
  });

  it('keine Vorlage: die jüngste frühere Veranstaltung', () => {
    expect(startQuelle([], frueher)).toEqual({ art: 'kopie', eventId: 2 });
  });

  it('weder noch: leer', () => {
    expect(startQuelle([], [])).toEqual({ art: 'leer' });
  });
});
