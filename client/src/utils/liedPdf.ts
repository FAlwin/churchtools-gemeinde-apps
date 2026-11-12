import type { SetlistSong } from '@shared/types/index';
import { pdfOptionsForSong } from './chartPdfOptions';
import { ablaufPdfBauen } from './ablaufPdf';
import { eigeneEbene } from './anmerkungsEbene';
import { dokumentSeiten } from './dokumentSeiten';
import { ladeDokument } from '../services/fileDownload';
import type { SongSettings } from './chartSettings';
import type { GebautesPdf } from '../components/TeilenFenster';

/**
 * „Als PDF teilen" – das aktive Lied als einzelne PDF, über das Teilen-Fenster (Anmerkungen ja/nein,
 * 07.10.2026) und denselben Baustein wie der Ablauf (`ablaufPdfBauen`): Akkorde oder das angezeigte
 * Dokument, auf Wunsch mit den eigenen Anmerkungen.
 *
 * Die Akkord-Optionen kommen aus `pdfOptionsForSong`, derselben Funktion, die auch den Seitenstrom
 * der Anzeige baut. Vorher baute diese Stelle die Optionen selbst und übergab `totalOffset` – also
 * OHNE den Kapo-Abzug. Bei gesetztem Kapo war das geteilte PDF dadurch anders transponiert als der
 * Bildschirm (#239). Es darf hier keine zweite Fassung dieser Rechnung geben.
 */
export async function liedPdfBauen(
  {
    song,
    set,
    logo,
    displayedChordpro,
  }: {
    song: SetlistSong;
    set: SongSettings;
    logo: HTMLImageElement | null;
    displayedChordpro: string;
  },
  mitAnmerkungen: boolean,
): Promise<GebautesPdf> {
  const lied = { ...song, chordpro: displayedChordpro };
  const opts = pdfOptionsForSong(song, set, logo);
  const dokument =
    set.viewSource === 'chords'
      ? null
      : (song.documents.find((d) => d.fileId === set.viewSource) ?? null);
  const { doc, ersetzt, fehlend } = await ablaufPdfBauen(
    [
      {
        song: lied,
        versionKey: set.versionKey,
        quelle: dokument ? { art: 'dokument', dokument } : { art: 'akkorde', opts },
      },
    ],
    {
      ladeSeiten: async (s, d) => dokumentSeiten(await ladeDokument(s.id, d.fileId), d.type),
      akkordOpts: () => opts,
      ebene: mitAnmerkungen ? eigeneEbene : undefined,
    },
  );
  const hinweis =
    ersetzt.length > 0
      ? 'Das Dokument ließ sich nicht laden – im PDF stehen die Akkorde'
      : fehlend.length > 0
        ? 'Das Dokument ließ sich nicht laden'
        : '';
  return { doc, hinweis };
}
