import { describe, expect, it } from 'vitest';
import type { Absence } from '@shared/types/index';
import { deineZeitraeume } from './zeitraeume';

const a = (id: number, startDate: string, endDate: string, zeit?: [string, string]): Absence => ({
  id,
  startDate,
  endDate,
  startTime: zeit ? `${startDate}T${zeit[0]}:00Z` : null,
  endTime: zeit ? `${endDate}T${zeit[1]}:00Z` : null,
  reason: 'Abwesend',
  reasonId: 1,
  comment: '',
  vonApp: false,
});

describe('deineZeitraeume', () => {
  const URLAUB = a(1, '2026-12-24', '2027-01-02');
  const GANZER_TAG = a(2, '2026-11-30', '2026-11-30');
  const HAKEN = a(3, '2026-11-29', '2026-11-29', ['09:00', '10:30']);
  const MEHRTAEGIG_MIT_UHRZEIT = a(4, '2026-12-01', '2026-12-03', ['09:00', '10:30']);

  it('mehrere Tage und ganze Tage sind Zeiträume, ein Haken mit Uhrzeit nicht', () => {
    const r = deineZeitraeume([URLAUB, GANZER_TAG, HAKEN], '2026-11-26', '2027-01-31');
    expect(r.map((x) => x.id)).toEqual([2, 1]);
  });

  it('mehrtägig zählt auch mit Uhrzeit (ein Haken ist immer ein Tag)', () => {
    expect(deineZeitraeume([MEHRTAEGIG_MIT_UHRZEIT], '2026-11-26', '2026-12-23')).toHaveLength(1);
  });

  it('nur was den gezeigten Zeitraum schneidet – auch wenn er mittendrin beginnt oder endet', () => {
    const alle = [URLAUB, GANZER_TAG];
    expect(deineZeitraeume(alle, '2026-11-26', '2026-12-23').map((x) => x.id)).toEqual([2]);
    expect(deineZeitraeume(alle, '2026-12-31', '2027-01-20').map((x) => x.id)).toEqual([1]);
    expect(deineZeitraeume(alle, '2027-01-02', '2027-01-02').map((x) => x.id)).toEqual([1]);
    expect(deineZeitraeume(alle, '2027-01-03', '2027-02-01')).toEqual([]);
    expect(deineZeitraeume(alle, '2026-11-01', '2026-11-29')).toEqual([]);
  });

  it('ohne Einträge: nichts (die Seite zeigt dann keine Karte)', () => {
    expect(deineZeitraeume([], '2026-11-26', '2026-12-23')).toEqual([]);
  });

  it('nach Beginn sortiert, bei gleichem Beginn nach ID – und verändert die Eingabe nicht', () => {
    const eingabe = [a(9, '2026-12-05', '2026-12-06'), a(8, '2026-12-05', '2026-12-05'), URLAUB];
    const kopie = [...eingabe];
    expect(deineZeitraeume(eingabe, '2026-12-01', '2027-01-31').map((x) => x.id)).toEqual([
      8, 9, 1,
    ]);
    expect(eingabe).toEqual(kopie);
  });
});
