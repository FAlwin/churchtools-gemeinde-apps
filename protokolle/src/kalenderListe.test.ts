import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ladeSchreibKalender } from './kalenderListe';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';

let ct: Nachbau;
beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

describe('ladeSchreibKalender', () => {
  it('nur Kalender, in denen man Termine anlegen darf – die Liste von ChurchTools wird nach dem Recht gefiltert', async () => {
    // Der Nachbau kennt einen Kalender (4, „Gemeindeleitung“).
    expect(await ladeSchreibKalender([4, 9])).toEqual([
      { id: 4, name: 'Gemeindeleitung', gruppe: true },
    ]);
    expect(await ladeSchreibKalender([9])).toEqual([]);
    expect(await ladeSchreibKalender([])).toEqual([]);
  });

  it('nur ein Gruppenkalender (`type: group`) hat `gruppe` – die Kirche und der Rest nicht (Reiter „Besprechungsanfragen“, W15-4)', async () => {
    ct.kalender = [
      { id: 2, name: 'Gottesdienst', type: 'church' },
      { id: 4, name: 'Gemeindeleitung', type: 'group' },
      { id: 5, name: 'Person', type: 'person' },
    ];
    expect(await ladeSchreibKalender([2, 4, 5])).toEqual([
      { id: 4, name: 'Gemeindeleitung', gruppe: true },
      { id: 2, name: 'Gottesdienst', gruppe: false },
      { id: 5, name: 'Person', gruppe: false },
    ]);
  });

  it('ein Fehler wird geworfen – „keine Kalender“ ist nicht „ChurchTools antwortet nicht“', async () => {
    ct.fehlerBei = { methode: 'GET', status: 503 };
    await expect(ladeSchreibKalender([4])).rejects.toThrow();
  });
});
