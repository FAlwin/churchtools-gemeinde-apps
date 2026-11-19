/**
 * **Nachweise** (Etappe F, N1a) – was die Erweiterung in ChurchTools für Nachweis-Arten (z. B. Führungszeugnis) anlegt:
 * die **Gruppenart „Nachweis“** (je Nachweis-Art später eine Gruppe „Nachweis: …“) und an ihrer **Leiter-Rolle** das
 * gruppeninterne Recht „Follow-ups durchführen“. Gemessen an der Test-Instanz am 19.11.2026: `GET /group/grouptypes/11`,
 * Rollen 53 (Teilnehmer) und 56 (Leiter), an 56 genau das Recht 10110. Das Anlegen selbst macht der gemeinsame Baustein
 * `shared/ct/gruppenart.ts` (auch das Organigramm nutzt ihn).
 */
import type { GruppenartVorgabe, SollRecht } from '../ct/gruppenart';

/** Wie die Gruppenart angelegt wird. */
export const NACHWEIS_ART: GruppenartVorgabe = {
  name: 'Nachweis',
  namePlural: 'Nachweise',
  shorty: 'NW',
  color: 'gray',
  description:
    'Angelegt von der Erweiterung „Anmeldungen“: je Nachweis-Art (z. B. Führungszeugnis) eine Gruppe „Nachweis: …“.',
};

/** Ist das die Gruppenart „Nachweis“? Wie bei „Anmeldung“: ohne Leerzeichen am Rand, Groß/Klein egal. */
export const istNachweisArt = (name: unknown): boolean =>
  typeof name === 'string' &&
  name.trim().toLocaleLowerCase('de') === NACHWEIS_ART.name.toLocaleLowerCase('de');

/** Die gruppeninternen Rechte der Leiter-Rolle: nur „Follow-ups durchführen“ (`dataId` entfällt). */
export const NACHWEIS_LEITER_RECHTE: readonly SollRecht[] = [
  { authId: 10110, name: 'Follow-ups durchführen', dataId: null },
];
