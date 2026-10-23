import { describe, it, expect } from 'vitest';
import { ablaufZeileAus, punktStand } from '@shared/ct/ablaufZeile';
import { ablaufBestandLesen, standAus } from '@shared/ct/ablaufNeu';
import type { CtAgenda } from '@shared/ct/typen';
import { ablaufNeuSchema, orderSchema, updateItemSchema } from './setlistController.js';

/**
 * `gesehen` (E6-3c, #659) geht vom Client an den Server – zod würde ein Feld, das das Schema nicht kennt, **still**
 * streichen, und der Konflikt-Schutz liefe auf dem Server-Weg ins Leere. Geprüft gegen den Erzeuger (`punktStand`),
 * nicht gegen einen hingeschriebenen Stand.
 */
describe('Server-Schemas lassen `gesehen` durch', () => {
  it('Punkt ändern: der Stand aus `punktStand` kommt unverändert an – auch ohne Dauer und mit Lied', () => {
    for (const item of [
      { id: 1, title: 'Lied', duration: 270, note: 'leise', responsible: { text: '[Musik]' } },
      { id: 2, title: 'Gebet' },
      { id: 3, title: 'Lied', song: { songId: 1, arrangementId: 2, title: 'Treu' } as never },
    ]) {
      const gesehen = punktStand(ablaufZeileAus(item, 7, 'Europe/Berlin'));
      const body = JSON.parse(JSON.stringify({ title: 'Neu', gesehen })) as unknown;
      expect(updateItemSchema.parse(body)).toEqual({ title: 'Neu', gesehen });
    }
  });

  it('Reihenfolge: `gesehen` kommt an; ohne bleibt es weg', () => {
    expect(orderSchema.parse({ order: [2, 1], gesehen: [1, 2] })).toEqual({
      order: [2, 1],
      gesehen: [1, 2],
    });
    expect(orderSchema.parse({ order: [2, 1] })).toEqual({ order: [2, 1] });
  });
});

describe('Neu aufsetzen (E6-5b, #691): der Stand der Nachfrage kommt unverändert an', () => {
  it('`gesehen` aus `standAus(ablaufBestandLesen(…))` – mit verbundenen Terminen und ohne Stempel', async () => {
    const leser = (meta?: { modifiedDate: string }) => ({
      agenda: () =>
        Promise.resolve<CtAgenda>({
          meta,
          items: [
            { id: 11, title: 'A', startTimes: { '166': null, '171': '2027-01-10T09:00:00Z' } },
            { id: 12, title: 'B', startTimes: { '166': '2027-01-10T09:05:00Z' } },
          ],
        }),
      termin: (id: number) =>
        Promise.resolve({ id, name: 'Termin', startDate: '2027-01-10T11:00:00Z', endDate: '' }),
    });
    for (const meta of [{ modifiedDate: '2026-10-23T10:00:00Z' }, undefined]) {
      const gesehen = standAus(await ablaufBestandLesen(leser(meta), 166, 'Europe/Berlin'));
      for (const quelle of [
        { art: 'vorlage', vorlageId: 28 },
        { art: 'kopie', eventId: 142 },
        { art: 'leer' },
      ] as const) {
        for (const kalenderId of [2, null]) {
          const rumpf = { kalenderId, quelle, gesehen, nurDieser: true };
          expect(ablaufNeuSchema.parse(JSON.parse(JSON.stringify(rumpf)))).toEqual(rumpf);
        }
      }
    }
  });
});
