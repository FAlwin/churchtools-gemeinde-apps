import type { MeinDienst } from '@shared/dienstplan/termine';

/**
 * Wie die Plakette eines eigenen Dienstes heißt – eine Regel für Startseite und „Dienste“. Eine eben abgesagte Anfrage
 * (E7-1, `MeinDienst.antwort`) ist „abgesagt“, nicht weiter „angefragt“.
 */
export function plaketteArt(d: MeinDienst): 'zugesagt' | 'angefragt' | 'abgesagt' {
  if (d.antwort?.art === 'abgesagt') return 'abgesagt';
  return d.zugesagt ? 'zugesagt' : 'angefragt';
}
