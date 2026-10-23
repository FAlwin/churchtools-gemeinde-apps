/**
 * **Personen in ChurchTools finden** – aus den Anmeldungen (A7-4, Messung 19.10.2026) hierher gezogen, als das
 * Organigramm (O6) dieselbe Suche brauchte. EINE Suche für alle Erweiterungen:
 * - `GET /search?query=…&domain_types[]=person` liefert nur Name und Nummer;
 * - Geburtstag und E-Mail kommen aus `GET /persons?ids[]=…` (in Paketen zu 50).
 */
import { ctDaten } from './verbindung';

/** Eine Person, wie `GET /persons?ids[]=…` sie liefert (soweit gebraucht). */
export interface PersonRoh {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  birthday?: string | null;
}

/** **Personen je Nummer** – in Paketen, eine Anfrage je 50 Personen. */
export async function personenRoh(ids: number[]): Promise<PersonRoh[]> {
  const alle: PersonRoh[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const teil = ids.slice(i, i + 50);
    alle.push(
      ...(await ctDaten<PersonRoh[]>(
        `/persons?${teil.map((x) => `ids[]=${x}`).join('&')}&limit=${teil.length}`,
      )),
    );
  }
  return alle;
}

/** Eine Person aus ChurchTools – Treffer der Suche. */
export interface Gefunden {
  personId: number;
  vor: string;
  nach: string;
  geburtstag: string | null;
  email: string | null;
}

interface TrefferRoh {
  domainType?: string;
  domainIdentifier?: string | number;
  domainAttributes?: { isArchived?: boolean };
}

/** Mehr Treffer zeigt die Suche nicht – wer mehr findet, sucht genauer. */
export const TREFFER_MAX = 20;

const gefunden = (p: PersonRoh): Gefunden => ({
  personId: p.id,
  vor: p.firstName ?? '',
  nach: p.lastName ?? '',
  geburtstag: p.birthday || null,
  email: p.email || null,
});

/** **Personen suchen** – ohne Archivierte, in der Reihenfolge von ChurchTools. */
export async function personenSuchen(text: string): Promise<Gefunden[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const treffer = await ctDaten<TrefferRoh[]>(
    `/search?query=${encodeURIComponent(q)}&domain_types[]=person`,
  );
  const ids = treffer
    .filter((t) => (t.domainType ?? 'person') === 'person' && !t.domainAttributes?.isArchived)
    .map((t) => Number(t.domainIdentifier))
    .filter((x) => Number.isInteger(x) && x > 0)
    .slice(0, TREFFER_MAX);
  if (ids.length === 0) return [];
  const personen = new Map((await personenRoh(ids)).map((p) => [p.id, p]));
  return ids.flatMap((id) => (personen.has(id) ? [gefunden(personen.get(id)!)] : []));
}
