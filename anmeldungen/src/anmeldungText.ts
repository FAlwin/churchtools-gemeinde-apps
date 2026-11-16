/**
 * **Wie eine Anmeldung in Liste und Fenster heißt** (#845, Scheibe 4c-1: aus `AnmeldungenReiter` herausgelöst, damit
 * Liste und Fenster der Anmeldung dieselben Texte benutzen).
 */
import type { Absage } from '@shared/anmeldung/liste';
import { tagMonat } from '@shared/ct/datum';

/** `TT.MM.` */
export const kurz = (tag: string | null) => (tag ? tagMonat(tag) : '');
export const ganzerName = (p: { vor: string; nach: string }) => `${p.vor} ${p.nach}`.trim();

export const absageText = (b: Absage) =>
  `am ${kurz(b.am)} ${b.selbst ? 'selbst abgesagt (Link in der Mail)' : 'vom Team entfernt'}`;
