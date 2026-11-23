/**
 * **Live-Agenda im Browser** (Bauplan E6b-2): Lesen und Schreiben des Live-Stands von ChurchTools über die alte
 * Schnittstelle. Die Regeln stehen in `shared/ct/liveAgenda.ts`.
 */
import { liveLesen, liveListe, liveSchreiben, type LiveZiel } from '@shared/ct/liveAgenda';
import type { CtAgendaItem } from '@shared/ct/typen';
import { altPort } from './altPort';

const port = altPort(
  'ChurchTools erlaubt dir nicht, die Live-Agenda dieses Termins zu lesen oder zu steuern.',
);

export const ladeLive = (eventId: number, agendaId: number) => liveLesen(port, eventId, agendaId);

export const schreibeLive = (eventId: number, agendaId: number, ziel: LiveZiel) =>
  liveSchreiben(port, eventId, agendaId, ziel);

/**
 * **Läuft die Live-Agenda dieses Termins gerade in ChurchTools?** (roter Punkt am Knopf „Live“ im Termin und „Live-Ansicht“ auf der
 * Startseite) – eine Regel für beide: gestartet (Stelle > 0) und noch nicht über das Ende. Einmal nachsehen, kein Takt; scheitert das
 * Lesen, ist es `false` (dann fehlt nur der Punkt).
 */
export function ladeLiveLaeuft(
  terminId: number,
  agendaId: number,
  items: readonly CtAgendaItem[],
  lesen: typeof ladeLive = ladeLive,
): Promise<boolean> {
  const punkte = liveListe(items, terminId).length;
  return lesen(terminId, agendaId).then((r) => {
    const s = r.ok ? r.stand.stelle : null;
    return s !== null && s > 0 && s <= punkte;
  });
}
