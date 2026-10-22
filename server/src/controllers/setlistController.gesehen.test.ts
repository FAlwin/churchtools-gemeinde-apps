import { describe, it, expect } from 'vitest';
import { ablaufZeileAus, punktStand } from '@shared/ct/ablaufZeile';
import { orderSchema, updateItemSchema } from './setlistController.js';

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
