import { leseImGeraet, merkeImGeraet, texte } from '@ui/bedienung/geraet';

/**
 * **Angeheftete Zeilen** (U2-4) – nur auf diesem Gerät, je Veranstaltung (Entscheidung 4, 29.10.2026: Zeilen anheften
 * „gemerkt nur auf dem eigenen Gerät“). Gemerkt werden die Schlüssel der Zeilen – je Anmeldung ihr Schlüssel, je Person
 * `personSchluessel`. Fehlt der Speicher, geht nur das Anheften nach dem Neuladen verloren.
 */
const schluessel = (id: number) => `anmeldungen.zeilen-oben.${id}`;

export function leseZeilenOben(id: number): Set<string> {
  return new Set(leseImGeraet(schluessel(id), [], texte));
}

/**
 * Eine Zeile an- oder abheften und merken. `da`: alle Zeilen, die es noch gibt – was nicht mehr da ist (abgesagt,
 * gelöscht), fällt dabei aus dem Speicher, damit er nicht wächst.
 */
export function zeileUmschalten(
  id: number,
  oben: ReadonlySet<string>,
  k: string,
  da: ReadonlySet<string>,
): Set<string> {
  const neu = new Set([...oben].filter((x) => da.has(x)));
  if (oben.has(k)) neu.delete(k);
  else neu.add(k);
  merkeImGeraet(schluessel(id), [...neu]);
  return neu;
}
