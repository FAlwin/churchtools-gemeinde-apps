/**
 * Arrangements **lesen, anlegen, ändern, zum Standard machen, löschen** (#396) – die Anbindung des
 * Servers. Die Regeln (Recht an der Kategorie des Liedes, Quelle vor Liednummer, „nie als Standard
 * anlegen", die Geländer beim Löschen, nachsehen statt glauben) stehen seit #335 (Phase 3b-2) in
 * `@shared/ct/liedVerwaltung`.
 */
import type { ArrangementAnsicht, ArrangementAuftrag } from '@shared/types/index';
import * as kern from '@shared/ct/liedVerwaltung';
import { verwalterFuer } from './ctVerwalter.js';

export function arrangementsLesen(cookie: string, songId: number): Promise<ArrangementAnsicht[]> {
  return kern.arrangementsLesen(verwalterFuer(cookie), songId);
}

export function arrangementAnlegen(
  cookie: string,
  songId: number,
  auftrag: ArrangementAuftrag & { name: string },
): Promise<ArrangementAnsicht> {
  return kern.arrangementAnlegen(verwalterFuer(cookie), songId, auftrag);
}

export function arrangementAendern(
  cookie: string,
  songId: number,
  arrangementId: number,
  auftrag: ArrangementAuftrag,
): Promise<ArrangementAnsicht> {
  return kern.arrangementBearbeiten(verwalterFuer(cookie), songId, arrangementId, auftrag);
}

export function arrangementZumStandard(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<ArrangementAnsicht[]> {
  return kern.arrangementZumStandard(verwalterFuer(cookie), songId, arrangementId);
}

export function arrangementLoeschen(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<{ name: string }> {
  return kern.arrangementLoeschen(verwalterFuer(cookie), songId, arrangementId);
}
