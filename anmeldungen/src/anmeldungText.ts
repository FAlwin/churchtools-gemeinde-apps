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

/**
 * **Der Hinweis nach dem Anmelden** – im Fenster der Anmeldung, nicht in der Zeile mit „Rückgängig“ (der lange Satz
 * drückte dort die Knöpfe zusammen, 22.10.2026). F4c: Kam die Adresse nicht ins Profil, steht die Anmeldung trotzdem.
 */
export function fertigHinweis(
  name: string,
  neu: boolean,
  adresseFehlt: boolean,
): { hinweis?: string } {
  const teile = [
    neu
      ? `${name} wurde in ChurchTools neu angelegt. „Rückgängig“ nimmt die Anmeldung zurück – die Person bleibt in ChurchTools.`
      : '',
    adresseFehlt
      ? `Die Adresse ließ sich nicht in ChurchTools speichern – bitte dort bei ${name} von Hand eintragen.`
      : '',
  ].filter(Boolean);
  return teile.length ? { hinweis: teile.join(' ') } : {};
}
