import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetlistSong } from '@shared/types/index';
import { DEFAULT_SETTINGS } from './chartSettings';
import { pdfOptionsForSong } from './chartPdfOptions';
import { eigeneEbene } from './anmerkungsEbene';
import * as A from './ablaufPdf';
import { liedPdfBauen } from './liedPdf';

/**
 * `liedPdfBauen` (#845, 4e) – das aktive Lied als PDF zum Teilen. Gebaut wird mit `ablaufPdfBauen` (dort getestet);
 * hier, WAS hineingeht: die angezeigte Version, Akkorde oder das gezeigte Dokument, die eigenen Anmerkungen nur auf
 * Wunsch – und die Akkord-Optionen aus derselben Funktion wie die Anzeige (#239: sonst fehlte der Kapo-Abzug).
 */
vi.mock('./ablaufPdf', () => ({ ablaufPdfBauen: vi.fn() }));
// Geladen wird hier nichts – pdf.js (Worker) bliebe außen vor.
vi.mock('./dokumentSeiten', () => ({ dokumentSeiten: vi.fn() }));
vi.mock('../services/fileDownload', () => ({ ladeDokument: vi.fn() }));
const bauen = vi.mocked(A.ablaufPdfBauen);

const song = (over: Partial<SetlistSong> = {}): SetlistSong => ({
  id: 5,
  arrangementId: 1,
  arrangementName: 'Standard',
  arrangementCount: 1,
  title: 'Lied',
  author: '',
  originalKey: 'C',
  targetKey: 'D',
  bpm: null,
  timeSig: null,
  ccli: null,
  chordpro: '{key: C}\n[C]Original',
  versions: [],
  documents: [{ fileId: 32, name: 'lead.pdf', type: 'pdf' }],
  ...over,
});

beforeEach(() => {
  bauen.mockReset();
  bauen.mockResolvedValue({ doc: {} as never, ersetzt: [], fehlend: [] });
});

describe('liedPdfBauen', () => {
  it('Akkorde: die angezeigte Version, Optionen wie auf dem Bildschirm, ohne Anmerkungen', async () => {
    const s = song();
    const set = { ...DEFAULT_SETTINGS, capo: 2 };
    const r = await liedPdfBauen(
      { song: s, set, logo: null, displayedChordpro: '[D]Angezeigt' },
      false,
    );
    const [[eintraege, wege]] = bauen.mock.calls;
    expect(eintraege[0].song.chordpro).toBe('[D]Angezeigt');
    expect(eintraege[0].quelle).toEqual({ art: 'akkorde', opts: pdfOptionsForSong(s, set, null) });
    expect(wege.akkordOpts(s)).toEqual(pdfOptionsForSong(s, set, null));
    expect(wege.ebene).toBeUndefined();
    expect(r.hinweis).toBe('');
  });

  it('Dokument gezeigt → das Dokument; mit Anmerkungen → die eigene Ebene', async () => {
    const s = song();
    await liedPdfBauen(
      { song: s, set: { ...DEFAULT_SETTINGS, viewSource: 32 }, logo: null, displayedChordpro: '' },
      true,
    );
    const [[eintraege, wege]] = bauen.mock.calls;
    expect(eintraege[0].quelle).toEqual({ art: 'dokument', dokument: s.documents[0] });
    expect(wege.ebene).toBe(eigeneEbene);
  });

  it('Dokument nicht ladbar: ersetzt durch die Akkorde bzw. fehlt – der Hinweis sagt es', async () => {
    const s = song();
    const set = { ...DEFAULT_SETTINGS, viewSource: 32 };
    bauen.mockResolvedValueOnce({ doc: {} as never, ersetzt: [s.title], fehlend: [] });
    expect(
      (await liedPdfBauen({ song: s, set, logo: null, displayedChordpro: '' }, false)).hinweis,
    ).toBe('Das Dokument ließ sich nicht laden – im PDF stehen die Akkorde');
    bauen.mockResolvedValueOnce({ doc: {} as never, ersetzt: [], fehlend: [s.title] });
    expect(
      (await liedPdfBauen({ song: s, set, logo: null, displayedChordpro: '' }, false)).hinweis,
    ).toBe('Das Dokument ließ sich nicht laden');
  });
});
