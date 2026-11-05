import { describe, expect, it } from 'vitest';
import type { Service } from '@shared/types/index';
import {
  kalenderFilterAus,
  kalenderImFilter,
  kalenderOhneAblauf,
  kalenderUmschalten,
  ohneAblaufUmschalten,
  startFilter,
  terminSichtbar,
} from './kalenderFilter';

/** Filter der Terminliste (05.11.2026): Kalender ausblenden, je Kalender „auch ohne Ablauf“ – nur mit Recht. */
function termin(id: number, kalenderId?: number): Service {
  return {
    id,
    day: '08',
    month: 'Nov',
    weekday: 'Sonntag',
    name: 'Gottesdienst',
    subtitle: null,
    date: '2026-11-08',
    start: '2026-11-08T09:00:00Z',
    time: '10:00 Uhr',
    location: '',
    songCount: 1,
    setlistChanged: false,
    ...(kalenderId !== undefined ? { kalenderId } : {}),
  };
}

const KALENDER = [
  { id: 2, name: 'Gottesdienste' },
  { id: 5, name: 'Gemeindeleben' },
  { id: 7, name: 'Jugend' },
];
const darfIn = (erlaubt: number[]) => (id: number) => erlaubt.includes(id);

describe('startFilter – solange auf dem Gerät nichts gewählt ist', () => {
  it('übernimmt die Kalender der früheren Verwaltung als „auch ohne Ablauf“, blendet nichts aus', () => {
    expect(startFilter({ kalenderIds: [2, 5], suchwort: 'Gottesdienst' })).toEqual({
      aus: [],
      ohneAblauf: [2, 5],
    });
  });

  it('ohne frühere Einstellung: nur Termine mit Ablauf', () => {
    expect(startFilter(undefined)).toEqual({ aus: [], ohneAblauf: [] });
  });
});

describe('terminSichtbar', () => {
  it('ein ausgeblendeter Kalender verschwindet ganz – auch mit Ablauf', () => {
    const f = { aus: [7], ohneAblauf: [] };
    expect(terminSichtbar(termin(1, 7), f)).toBe(false);
    expect(terminSichtbar(termin(2, 2), f)).toBe(true);
  });

  it('ein Termin ohne bekannten Kalender (älterer Server) steht immer da', () => {
    expect(terminSichtbar(termin(1), { aus: [2, 5, 7], ohneAblauf: [] })).toBe(true);
  });
});

describe('kalenderOhneAblauf – woraus Termine ohne Ablauf geholt werden', () => {
  it('nur gewählte, nicht ausgeblendete Kalender MIT Recht, sortiert', () => {
    const f = { aus: [7], ohneAblauf: [9, 5, 7, 2] };
    expect(kalenderOhneAblauf(f, darfIn([2, 5, 7]))).toEqual([2, 5]);
  });

  it('ein übernommener Kalender ohne eigenes Recht wird nicht abgefragt', () => {
    expect(kalenderOhneAblauf(startFilter({ kalenderIds: [2], suchwort: '' }), darfIn([]))).toEqual(
      [],
    );
  });
});

describe('kalenderImFilter – welche Kalender im Menü stehen', () => {
  it('die der Termine, die mit Ablauf-Recht und die ausgeblendeten – nach Namen sortiert', () => {
    const liste = kalenderImFilter(
      [termin(1, 2)],
      KALENDER,
      { aus: [7], ohneAblauf: [] },
      darfIn([5]),
    );
    expect(liste).toEqual([
      { id: 5, name: 'Gemeindeleben', ohneAblaufMoeglich: true },
      { id: 2, name: 'Gottesdienste', ohneAblaufMoeglich: false },
      { id: 7, name: 'Jugend', ohneAblaufMoeglich: false },
    ]);
  });

  it('jeder Kalender nur einmal; ohne Namen (offline) steht die Nummer da', () => {
    const liste = kalenderImFilter(
      [termin(1, 2), termin(2, 2), termin(3)],
      undefined,
      { aus: [], ohneAblauf: [] },
      darfIn([]),
    );
    expect(liste).toEqual([{ id: 2, name: 'Kalender 2', ohneAblaufMoeglich: false }]);
  });
});

describe('Umschalten', () => {
  it('„auch ohne Ablauf“ an und wieder aus, ohne die Ausblendung anzufassen', () => {
    const an = ohneAblaufUmschalten({ aus: [7], ohneAblauf: [] }, 5);
    expect(an).toEqual({ aus: [7], ohneAblauf: [5] });
    expect(ohneAblaufUmschalten(an, 5)).toEqual({ aus: [7], ohneAblauf: [] });
  });

  it('Ausblenden behält „auch ohne Ablauf“ – beim Wiedereinblenden ist die Wahl noch da', () => {
    const f = kalenderUmschalten({ aus: [], ohneAblauf: [5] }, [5, 5]);
    expect(f).toEqual({ aus: [5], ohneAblauf: [5] });
    expect(kalenderOhneAblauf(f, darfIn([5]))).toEqual([]);
    expect(kalenderOhneAblauf(kalenderUmschalten(f, []), darfIn([5]))).toEqual([5]);
  });
});

describe('kalenderFilterAus – gespeicherter Wert', () => {
  it('nimmt nur ganze positive Zahlen, ohne Doppelte', () => {
    expect(kalenderFilterAus({ aus: [1, '2', 1, -3], ohneAblauf: [4, 4.5] })).toEqual({
      aus: [1],
      ohneAblauf: [4],
    });
  });

  it('falsche Form → null (dann gilt der Startwert)', () => {
    expect(kalenderFilterAus(null)).toBeNull();
    expect(kalenderFilterAus([1, 2])).toBeNull();
    expect(kalenderFilterAus({ aus: [] })).toBeNull();
  });
});
