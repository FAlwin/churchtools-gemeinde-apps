/**
 * CCLI SongSelect in der Erweiterung (#335, Phase 3b-5) – der Anschluss des Browsers an die Regeln in
 * `@shared/ct/songselect`, dieselben wie im Server. Gesprochen wird über die alte Schnittstelle
 * (`ctAltAnfrage`: Sitzung der Seite, CSRF-Token, `X-Requested-With`, Bremse, Zeitgrenze).
 *
 * Das Notenblatt-Holen schreibt zusätzlich in ChurchTools – das steht bei den anderen Schreibvorgängen
 * in `ctSchreiben.ts` (`notenblattAusCcli`).
 */
import type {
  SongSelectLiedtext,
  SongSelectSong,
  SongSelectSuchergebnis,
} from '@shared/types/index';
import {
  songSelectLied,
  songSelectLiedtext,
  songSelectSuchen,
  type SongSelectPort,
} from '@shared/ct/songselect';
import { ApiError } from './api';
import { ctAltAnfrage } from './ctRuntime';

export const songSelect: SongSelectPort = {
  anfrage: (func, felder, meldungen) => ctAltAnfrage(func, felder, meldungen),
  fehler: (status, meldung) => new ApiError(status, meldung),
};

/** `GET /api/songselect/search?title=…` */
export function suchen(titel: string): Promise<SongSelectSuchergebnis> {
  return songSelectSuchen(songSelect, titel);
}

/** `GET /api/songselect/songs/:nr` */
export function lied(songNumber: number): Promise<SongSelectSong> {
  return songSelectLied(songSelect, songNumber);
}

/** `GET /api/songselect/songs/:nr/liedtext` */
export function liedtext(songNumber: number): Promise<SongSelectLiedtext> {
  return songSelectLiedtext(songSelect, songNumber);
}
