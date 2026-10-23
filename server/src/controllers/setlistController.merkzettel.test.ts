import { describe, it, expect, vi } from 'vitest';
import { punktLoeschen, type CtSchreiber } from '@shared/ct/schreibKern';
import type { CtAgendaItem } from '@shared/ct/typen';
import { geloeschterPunktSchema } from './setlistController.js';

/**
 * Der Merkzettel für „Rückgängig“ geht vom Client zurück an den Server und wird dort mit zod geprüft. zod wirft
 * unbekannte Felder **still weg** – ein neues Feld im Merkzettel ginge so auf dem Server-Weg verloren, während die
 * Erweiterung (ohne Server) es behält. Deshalb gegen den **Erzeuger** (`punktLoeschen`) geprüft, nicht gegen einen
 * hingeschriebenen Zettel: Was das Löschen liefert, muss unverändert durch das Schema kommen (E6-3b, #652).
 */
describe('geloeschterPunktSchema – lässt den Merkzettel vollständig durch', () => {
  it('alle Felder des echten Merkzettels bleiben erhalten – auch „weggelassen“ und das Lied', async () => {
    const s: CtSchreiber = {
      agenda: () =>
        Promise.resolve({
          calendarId: 1,
          eventStartPosition: 1,
          items: [
            { id: 1, title: 'Vorspiel', type: 'normal', position: 0, duration: 120 },
            {
              id: 2,
              title: 'Lied',
              type: 'song',
              position: 1,
              duration: 300,
              note: 'mit Chor',
              responsible: { text: '[Musik]' },
              serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 2' }],
              song: { songId: 7, arrangementId: 70, title: 'Treu' } as CtAgendaItem['song'],
              startTimes: { '5': null },
            },
          ],
        }),
      song: () => Promise.reject(new Error('nicht gebraucht')),
      vorlage: () => Promise.reject(new Error('nicht gebraucht')),
      schreibe: vi.fn(() => Promise.resolve(null)),
      fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
    };
    const zettel = (await punktLoeschen(s, 5, 2))!;
    expect(zettel.weggelassen).toBe(true);
    expect(geloeschterPunktSchema.parse(JSON.parse(JSON.stringify(zettel)))).toEqual(zettel);
  });
});
