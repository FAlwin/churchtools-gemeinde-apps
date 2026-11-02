/**
 * **Live-Agenda im Browser** (Bauplan E6b-2): Lesen und Schreiben des Live-Stands von ChurchTools über die alte
 * Schnittstelle. Die Regeln stehen in `shared/ct/liveAgenda.ts`.
 */
import { liveLesen, liveSchreiben, type LiveZiel } from '@shared/ct/liveAgenda';
import { altPort } from './altPort';

const port = altPort(
  'ChurchTools erlaubt dir nicht, die Live-Agenda dieses Termins zu lesen oder zu steuern.',
);

export const ladeLive = (eventId: number, agendaId: number) => liveLesen(port, eventId, agendaId);

export const schreibeLive = (eventId: number, agendaId: number, ziel: LiveZiel) =>
  liveSchreiben(port, eventId, agendaId, ziel);
