/**
 * **Alle Personen, die man in ChurchTools sehen darf** – für „Mit KI füllen“ (S8-2): Aus ihren Namen findet
 * `namenFinden` (`shared/protokolle/platzhalter.ts`), was die KI nicht sehen soll. Gelesen wird seitenweise
 * (`ctAlleSeiten`, höchstens 200 je Seite); eine Gemeinde mit mehr als 500 Personen bekommt einfach mehr Seiten.
 */
import { ctAlleSeiten } from '@ui/ct/verbindung';
import type { Person } from '@shared/protokolle/platzhalter';

interface RohPerson {
  id?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}

const SEITE = 200;

/** Eine Zeile aus `/persons` → `Person`; ohne Nummer unbrauchbar, fehlende Namen werden leer. */
export function personAus(roh: RohPerson): Person | null {
  if (typeof roh.id !== 'number') return null;
  return {
    id: roh.id,
    vorname: typeof roh.firstName === 'string' ? roh.firstName : '',
    nachname: typeof roh.lastName === 'string' ? roh.lastName : '',
  };
}

/** Alle sichtbaren Personen. Wirft bei einem Lesefehler – der Aufrufer entscheidet, wie das Fenster damit umgeht. */
export async function ladePersonen(
  holen: (pfad: string, limit: number) => Promise<RohPerson[]> = (pfad, limit) =>
    ctAlleSeiten<RohPerson>(pfad, limit),
): Promise<Person[]> {
  const liste = await holen('/persons', SEITE);
  return liste.flatMap((r) => {
    const p = personAus(r);
    return p ? [p] : [];
  });
}
