// Test-Hilfe für die Personenliste (PL-1): ein Wert für die Schublade und die Liste, **wie die Leser sie bauen** – eine
// Stelle für alle Tests, damit kein Test eine handgeschriebene Endstruktur prüft, die der Leser nie liefern würde.
import type { Wert } from '../ct/modulDaten';
import {
  PERSONENLISTE_ART,
  PERSONENLISTE_FASSUNG,
  personenlisteAus,
  type Personenliste,
} from './personenliste';

/** Die Felder einer Personenliste – alles ruhig vorbelegt, `x` überschreibt. */
export const listeRoh = (x: Partial<Personenliste> = {}): Personenliste => ({
  version: 1,
  zeit: '2026-11-20T10:00:00.000Z',
  reihe: [],
  tags: [],
  tagsVon: {},
  pause: {},
  ...x,
});

/** Ein Wert der Schublade, wie ChurchTools ihn liefert: Text mit `art` und `fassung`. */
export const listeWert = (x: Partial<Personenliste> = {}, id = 900): Wert => ({
  id,
  dataCategoryId: 30,
  value: JSON.stringify({
    art: PERSONENLISTE_ART,
    fassung: PERSONENLISTE_FASSUNG,
    ...listeRoh(x),
  }),
});

/** Die Liste, die `personenlisteAus` aus einem solchen Wert liest – so kommt sie auch in die Anzeige. */
export function liste(x: Partial<Personenliste> = {}): Personenliste {
  const l = personenlisteAus(listeWert(x));
  if (!l) throw new Error('Testliste wird vom Leser nicht angenommen');
  return l;
}

export const BEGLEITUNG = { id: 'b', name: 'Begleitung', kuerzel: 'B' };
export const LEITUNG = { id: 'l', name: 'Leitung', kuerzel: 'L' };
export const EINWEISUNG = { id: 'e', name: 'Einweisung', kuerzel: 'E' };
