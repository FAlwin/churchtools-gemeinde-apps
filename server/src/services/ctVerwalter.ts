/**
 * Der volle Anschluss des Servers an die geteilten Schreib-Regeln (#335, Phase 3b-2): Lieder,
 * Arrangements, Notenblätter, Versionen, Dateien. Die Regeln selbst stehen in `@shared/ct`
 * (`liedVerwaltung.ts`, `notenblaetter.ts`); hier nur, woher der Server liest und wie er schreibt.
 *
 * Eigene Datei statt in `ctWrite`: Der Anschluss braucht Kategorien und Quellen (`ctSongCategories`,
 * `ctSongSources`), die ihrerseits lesen – in `ctWrite` entstünde ein Ring.
 */
import type { CtVerwalter } from '@shared/ct/liedVerwaltung';
import type { CtNotenSchreiber } from '@shared/ct/notenblaetter';
import { downloadFileText } from './ctFiles.js';
import { getAllSongs } from './ctRead.js';
import { getEditableSongCategories } from './ctSongCategories.js';
import { getSongSources } from './ctSongSources.js';
import { schreiberFuer, uploadFile } from './ctWrite.js';

export function verwalterFuer(cookie: string): CtVerwalter & CtNotenSchreiber {
  return {
    ...schreiberFuer(cookie),
    alleLieder: () => getAllSongs(cookie),
    bearbeitbareKategorien: () => getEditableSongCategories(cookie),
    quellen: () => getSongSources(cookie),
    hochladen: (arrangementId, datei, meldungen) =>
      uploadFile(cookie, arrangementId, datei, meldungen),
    dateiText: (fileUrl) => downloadFileText(cookie, fileUrl),
  };
}
