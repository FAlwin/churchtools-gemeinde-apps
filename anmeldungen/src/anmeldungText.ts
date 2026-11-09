/**
 * **Wie eine Anmeldung in Liste und Fenster heißt** (#845, Scheibe 4c-1: aus `AnmeldungenReiter` herausgelöst, damit
 * Liste und Fenster der Anmeldung dieselben Texte benutzen).
 */
import type { Absage } from '@shared/anmeldung/liste';

/** `TT.MM.` */
export const kurz = (tag: string | null) => (tag ? `${tag.slice(8, 10)}.${tag.slice(5, 7)}.` : '');
export const ganzerName = (p: { vor: string; nach: string }) => `${p.vor} ${p.nach}`.trim();

export const absageText = (b: Absage) =>
  `am ${kurz(b.am)} ${b.selbst ? 'selbst abgesagt (Link in der Mail)' : 'vom Team entfernt'}`;
