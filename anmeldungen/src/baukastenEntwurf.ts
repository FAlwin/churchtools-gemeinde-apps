import { feldFehler, type Feld, type Formular } from '@shared/anmeldung/formular';

/** Entwurf eines Felds im Baukasten (A5) – getrennt von den Komponenten (React Fast Refresh). */

/** Eine Antwort im Baukasten, mit der ChurchTools-ID, aus der sie hervorgegangen ist (Umbenennen behält die Wahl). */
export interface AntwortEntwurf {
  text: string;
  altId?: string;
  /**
   * Der Text, mit dem die Antwort geladen wurde – über ihn wird die ID zugeordnet, sobald sie aus ChurchTools da
   * ist. So bleibt die Wahl der Personen auch dann, wenn jemand schon umbenennt, bevor die IDs geladen sind.
   */
  von?: string;
}

export interface FeldEntwurf {
  feld: Feld;
  antworten: AntwortEntwurf[];
}

/**
 * Was am Entwurf nicht stimmt – dann wird nicht gespeichert. Dieselbe Regel wie beim Speichern (`feldFehler`),
 * mit den Antworten so, wie sie gerade im Baukasten stehen.
 */
export function entwurfFehler(d: FeldEntwurf): string | null {
  return feldFehler({ ...d.feld, antworten: d.antworten.map((a) => a.text) });
}

export const mitAntworten = (f: Feld) =>
  f.typ === 'radio' || f.typ === 'select' || f.typ === 'multi';

export const ersetzeFeld = (fo: Formular, feld: Feld): Formular => ({
  anmeldung: fo.anmeldung.map((f) => (f.id === feld.id ? feld : f)),
  person: fo.person.map((f) => (f.id === feld.id ? feld : f)),
});

/** Name, E-Mail, Datenschutz, Preisbereich: gehören immer dazu – nicht zu bearbeiten oder zu entfernen. */
export const istFest = (f: Feld) => f.art === 'fest' || f.art === 'preis';
