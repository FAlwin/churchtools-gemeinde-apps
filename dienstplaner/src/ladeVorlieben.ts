/**
 * **Vorlieben (Stift) im Browser** (Bauplan E5-3): der Anschluss an die alte Schnittstelle über `ctAltAnfrage` (mit
 * Sitzung und CSRF-Token, wie Lied-Kategorien und SongSelect). Die Regeln stehen in `shared/dienstplan/vorlieben.ts`.
 */
import { ctAltAnfrage } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  vorliebeLesen,
  vorliebeSpeichern,
  type Vorliebe,
  type VorliebenPort,
} from '@shared/dienstplan/vorlieben';

const port: VorliebenPort = {
  anfrage: (func, felder) =>
    ctAltAnfrage(func, felder, {
      verweigert: 'ChurchTools erlaubt dir nicht, die Vorlieben dieser Dienstgruppe zu ändern.',
    }),
  status: (e) => (e instanceof ApiError ? e.status : null),
};

export const ladeVorliebe = (gruppeId: number, personId: number) =>
  vorliebeLesen(port, gruppeId, personId);

export const speichereVorliebe = (gruppeId: number, personId: number, v: Vorliebe) =>
  vorliebeSpeichern(port, gruppeId, personId, v);
