/**
 * **Vorlieben (Stift) im Browser** (Bauplan E5-3): der Anschluss an die alte Schnittstelle über `altPort` (`ctAltAnfrage` mit
 * Sitzung und CSRF-Token, wie Lied-Kategorien und SongSelect). Die Regeln stehen in `shared/dienstplan/vorlieben.ts`.
 */
import { vorliebeLesen, vorliebeSpeichern, type Vorliebe } from '@shared/dienstplan/vorlieben';
import { altPort } from './altPort';

const port = altPort('ChurchTools erlaubt dir nicht, die Vorlieben dieser Dienstgruppe zu ändern.');

export const ladeVorliebe = (gruppeId: number, personId: number) =>
  vorliebeLesen(port, gruppeId, personId);

export const speichereVorliebe = (gruppeId: number, personId: number, v: Vorliebe) =>
  vorliebeSpeichern(port, gruppeId, personId, v);
