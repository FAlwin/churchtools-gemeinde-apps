/**
 * Lieder **anlegen, ändern und löschen** (#322, Schritte 10 und 11) – die Anbindung des Servers.
 *
 * Die Regeln (Recht an der Kategorie, Sperre gegen eine doppelte CCLI-Nummer, „nachsehen statt
 * glauben", der benannte Zwischenzustand bei einem Lied ohne Arrangement) stehen seit #335 (Phase
 * 3b-2) in `@shared/ct/liedVerwaltung` – die ChurchTools-Extension schreibt mit denselben Regeln aus dem
 * Browser. Hier ist der Server nur der Anschluss (`verwalterFuer`).
 */
import type { LiedAngelegt, LiedAnlegenAuftrag } from '@shared/types/index';
import * as kern from '@shared/ct/liedVerwaltung';
import type { SongOverrides } from '@shared/ct/songPayload';
import type { CtSong } from './ctTypes.js';
import { verwalterFuer } from './ctVerwalter.js';

/** Auftrag und Ergebnis stehen in `@shared/types` – die Oberfläche schickt das eine und liest das andere. */
export type { LiedAngelegt, LiedAnlegenAuftrag };

export function liedAnlegen(cookie: string, auftrag: LiedAnlegenAuftrag): Promise<LiedAngelegt> {
  return kern.liedAnlegen(verwalterFuer(cookie), auftrag);
}

export function liedAendern(
  cookie: string,
  songId: number,
  aenderung: SongOverrides,
): Promise<CtSong> {
  return kern.liedAendern(verwalterFuer(cookie), songId, aenderung);
}

export function liedLoeschen(cookie: string, songId: number): Promise<{ name: string }> {
  return kern.liedLoeschen(verwalterFuer(cookie), songId);
}
