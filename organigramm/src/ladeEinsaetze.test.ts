import { describe, expect, it } from 'vitest';
import { ladeEinsaetze } from './ladeEinsaetze';

describe('ladeEinsaetze (O3)', () => {
  it('ein Abruf: 6 Monate zurück bis 3 voraus, mit Diensten', async () => {
    const gefragt: string[] = [];
    const e = await ladeEinsaetze(new Date('2026-10-22T12:00:00Z'), (pfad) => {
      gefragt.push(pfad);
      return Promise.resolve([
        {
          id: 1,
          name: 'GD',
          startDate: '2026-10-11T08:00:00Z',
          eventServices: [{ serviceId: 6, personId: 1, name: 'A' }],
        },
      ]);
    });
    expect(gefragt).toEqual(['/events?from=2026-04-22&to=2027-01-22&include=eventServices']);
    expect(e.jePerson.get(1)?.vergangen).toBe(1);
  });

  it('keine Liste → Fehler 502 (nicht „niemand hat Einsätze“)', async () => {
    await expect(ladeEinsaetze(new Date(), () => Promise.resolve(null))).rejects.toMatchObject({
      status: 502,
    });
  });
});
