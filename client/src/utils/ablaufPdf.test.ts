// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { SetlistSong, SongDocument } from '@shared/types/index';
import {
  ablaufPdfBauen,
  akkordeNichtGeladen,
  teilbareLieder,
  type AblaufEintrag,
} from './ablaufPdf';
import { setLsSong } from './songVersions';

/**
 * Den Ablauf als EIN PDF teilen – jedes Lied so, wie es angezeigt wird (07.10.2026). Anlass: Bei einer
 * Gemeinde ohne ChordPro (nur PDFs) fehlte der Teilen-Knopf ganz.
 */
const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAqADAAQAAAABAAAAAgAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAgACAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A/fyiiigD/9k=';
/** Eine „Leinwand", wie `dokumentSeiten` sie liefert – jsdom zeichnet nicht, also ein echtes Mini-JPEG. */
const leinwand = () =>
  ({ width: 800, height: 1100, toDataURL: () => JPEG }) as unknown as HTMLCanvasElement;

const PDF: SongDocument = { fileId: 32, name: 'lead.pdf', type: 'pdf' };
const song = (over: Partial<SetlistSong> = {}): SetlistSong => ({
  id: 5,
  arrangementId: 1,
  arrangementName: 'Standard',
  arrangementCount: 1,
  title: 'Lied',
  author: '',
  originalKey: 'C',
  targetKey: 'C',
  bpm: null,
  timeSig: null,
  ccli: null,
  chordpro: '{key: C}\n[C]Text',
  versions: [],
  documents: [],
  ...over,
});
const akkorde = (s: SetlistSong): AblaufEintrag => ({
  song: s,
  versionKey: 'original',
  quelle: { art: 'akkorde', opts: {} },
});
const dokument = (s: SetlistSong): AblaufEintrag => ({
  song: s,
  versionKey: 'original',
  quelle: { art: 'dokument', dokument: PDF },
});

beforeEach(() => localStorage.clear());

describe('ablaufPdfBauen', () => {
  it('Reihenfolge wie im Ablauf, jedes Lied auf neuer Seite, Dokument mit allen Seiten – ohne leere erste Seite', async () => {
    const { doc } = await ablaufPdfBauen(
      [akkorde(song({ id: 1 })), dokument(song({ id: 2 })), akkorde(song({ id: 3 }))],
      { ladeSeiten: async () => [leinwand(), leinwand()], akkordOpts: () => ({}) },
    );
    expect(doc.getNumberOfPages()).toBe(4);
  });

  it('nur Dokumente (die Gemeinde ohne ChordPro) → trotzdem ein PDF', async () => {
    const { doc } = await ablaufPdfBauen(
      [dokument(song({ id: 1, chordpro: '' })), dokument(song({ id: 2, chordpro: '' }))],
      { ladeSeiten: async () => [leinwand()], akkordOpts: () => ({}) },
    );
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('Dokument lädt nicht: mit Akkorden → ersetzt, ohne → fehlt – beides gemeldet, nichts still', async () => {
    const { doc, fehlend, ersetzt } = await ablaufPdfBauen(
      [
        dokument(song({ id: 1, title: 'Mit Akkorden' })),
        dokument(song({ id: 2, title: 'Nur PDF', chordpro: '' })),
        akkorde(song({ id: 3 })),
      ],
      {
        ladeSeiten: async () => {
          throw new TypeError('Failed to fetch');
        },
        akkordOpts: () => ({}),
      },
    );
    expect(ersetzt).toEqual(['Mit Akkorden']);
    expect(fehlend).toEqual(['Nur PDF']);
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('kommt gar nichts an, gibt es kein leeres PDF, sondern eine Meldung', async () => {
    await expect(
      ablaufPdfBauen([dokument(song({ chordpro: '' }))], {
        ladeSeiten: async () => [],
        akkordOpts: () => ({}),
      }),
    ).rejects.toThrow(/Keines der Lieder/);
  });
});

describe('ablaufPdfBauen – mit Anmerkungen', () => {
  it('fragt jede Seite mit dem Besitzer wie im Liedblatt ab – Akkord-Seiten und Dokument-Seiten', async () => {
    const gefragt: string[] = [];
    await ablaufPdfBauen(
      [akkorde(song({ id: 1, arrangementId: 11 })), dokument(song({ id: 2, arrangementId: 22 }))],
      {
        ladeSeiten: async () => [leinwand(), leinwand()],
        akkordOpts: () => ({}),
        ebene: async (seite, lyricsOnly) => {
          gefragt.push(
            `${seite.kind} lied${seite.songId} a${seite.arrangementId} ${seite.versionKey} s${seite.localPage} datei${seite.fileId ?? '-'} lyr${lyricsOnly}`,
          );
          return null;
        },
      },
    );
    expect(gefragt).toEqual([
      'chord lied1 a11 original s0 datei- lyrfalse',
      'doc lied2 a22 original s0 datei32 lyrfalse',
      'doc lied2 a22 original s1 datei32 lyrfalse',
    ]);
  });

  it('„Nur Text" der Akkord-Seite wird mitgegeben – sonst landeten die Notizen auf der falschen Ebene', async () => {
    const lyr: boolean[] = [];
    await ablaufPdfBauen(
      [
        {
          song: song(),
          versionKey: 'original',
          quelle: { art: 'akkorde', opts: { lyricsOnly: true } },
        },
      ],
      {
        ladeSeiten: async () => [],
        akkordOpts: () => ({}),
        ebene: async (_s, l) => {
          lyr.push(l);
          return null;
        },
      },
    );
    expect(lyr).toEqual([true]);
  });

  it('auch auf Dokument-Seiten kommt die Ebene als Bild', async () => {
    const mittel = { ladeSeiten: async () => [leinwand()], akkordOpts: () => ({}) };
    const ohne = await ablaufPdfBauen([dokument(song())], mittel);
    const mit = await ablaufPdfBauen([dokument(song())], {
      ...mittel,
      ebene: async () => JPEG.replace('image/jpeg', 'image/png'),
    });
    expect(mit.doc.output().length).toBeGreaterThan(ohne.doc.output().length);
  });

  it('eine gefundene Ebene kommt als Bild auf die Seite', async () => {
    const ohne = await ablaufPdfBauen([akkorde(song())], {
      ladeSeiten: async () => [],
      akkordOpts: () => ({}),
    });
    const mit = await ablaufPdfBauen([akkorde(song())], {
      ladeSeiten: async () => [],
      akkordOpts: () => ({}),
      ebene: async () => JPEG.replace('image/jpeg', 'image/png'),
    });
    expect(mit.doc.output().length).toBeGreaterThan(ohne.doc.output().length);
  });
});

describe('teilbareLieder – was das Lied anzeigt', () => {
  it('Lied ohne ChordPro mit PDF → das PDF; mit ChordPro → Akkorde; ohne beides → fällt weg', () => {
    const t = teilbareLieder([
      song({ id: 1, chordpro: '', documents: [PDF] }),
      song({ id: 2, documents: [PDF] }),
      song({ id: 3, chordpro: '' }),
    ]);
    expect(t.map((x) => [x.song.id, x.dokument?.fileId ?? null])).toEqual([
      [1, 32],
      [2, null],
    ]);
  });

  it('eine eigene Wahl am Lied gilt auch beim Teilen', () => {
    setLsSong('view', 2, String(PDF.fileId));
    expect(teilbareLieder([song({ id: 2, documents: [PDF] })])[0].dokument).toEqual(PDF);
  });

  it('Akkorde nicht geladen: gemeldet nur, wenn das Lied Akkorde zeigen würde', () => {
    // Lied 1 zeigt sein PDF, weil es so gewählt ist. (Von selbst stellt ein Ladefehler NICHT aufs PDF
    // um – siehe `standardQuelle`; dann zeigt es Akkorde und gehört in die Meldung.)
    setLsSong('view', 1, String(PDF.fileId));
    const lieder = [
      song({ id: 1, title: 'Zeigt PDF', chordpro: '', chordproFailed: true, documents: [PDF] }),
      song({ id: 2, title: 'Zeigt Akkorde', chordpro: '', chordproFailed: true }),
    ];
    expect(akkordeNichtGeladen(lieder, teilbareLieder(lieder))).toEqual(['Zeigt Akkorde']);
  });
});
