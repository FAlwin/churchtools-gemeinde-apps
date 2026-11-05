/**
 * **Die Kategorien des Gebetsabends** (Bauplan Gebetsabend G1) und ob die Erweiterung eingerichtet ist.
 *
 * Zwei Kategorien, damit die Rechte getrennt vergeben werden können (gemessen S0: ChurchTools vergibt sie je
 * Kategorie, ohne Kategorie-Recht liefert auch der Direktzugriff per ID 403):
 *  - „Zugang“: StreamID, Passwort, „läuft seit“ – sehen alle, die zuhören dürfen; schreiben nur die Technik.
 *  - „Einstellungen“: Kalender des Gebetsabends – sehen alle, schreiben nur die Technik.
 */
import { kategorieAusListe, type KategorieAngabe } from '../ct/modulDaten';

export const KATEGORIE_ZUGANG: KategorieAngabe = {
  kuerzel: 'zugang',
  name: 'Gebetsabend: Zugang',
  beschreibung:
    'Zugangsdaten der laufenden Übertragung. Sehen: alle, die zuhören dürfen. Bearbeiten: nur die Technik.',
};

export const KATEGORIE_EINSTELLUNGEN: KategorieAngabe = {
  kuerzel: 'einstellungen',
  name: 'Gebetsabend: Einstellungen',
  beschreibung:
    'Kalender des Gebetsabends. Sehen: alle, die zuhören dürfen. Bearbeiten: nur die Technik.',
};

export const KATEGORIEN = [KATEGORIE_ZUGANG, KATEGORIE_EINSTELLUNGEN] as const;

export interface Einrichtung {
  /** ID der Kategorie „Zugang“, `null` = nicht da oder nicht sichtbar. */
  zugang: number | null;
  einstellungen: number | null;
}

/**
 * Welche Kategorien man sieht – aus der Liste von ChurchTools. „Nicht sichtbar“ und „nicht angelegt“ sehen gleich
 * aus (ohne Recht kommt eine leere Liste, gemessen); was davon gilt, entscheidet erst das Recht zum Anlegen.
 */
export function einrichtungAus(liste: readonly { id: number; shorty: string }[]): Einrichtung {
  return {
    zugang: kategorieAusListe(liste, KATEGORIE_ZUGANG.kuerzel),
    einstellungen: kategorieAusListe(liste, KATEGORIE_EINSTELLUNGEN.kuerzel),
  };
}

export type EinrichtungsStand = 'fertig' | 'einrichten' | 'fehlt';

/**
 * Was die Seite zeigt: `fertig` (beide sichtbar), `einrichten` (fehlt etwas und man darf Kategorien anlegen) oder
 * `fehlt` (fehlt etwas, und man darf es nicht ändern – Hinweis an die Verwaltung).
 */
export function einrichtungsStand(e: Einrichtung, darfAnlegen: boolean): EinrichtungsStand {
  if (e.zugang !== null && e.einstellungen !== null) return 'fertig';
  return darfAnlegen ? 'einrichten' : 'fehlt';
}
