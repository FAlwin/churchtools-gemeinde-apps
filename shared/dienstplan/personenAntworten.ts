/**
 * **Die Antworten aus „Wann kann ich?“ in der Ansicht „Personen“** (Bauplan E5c-3, Variante D): Was geladen ist, und die
 * Regeln, wie eine Antwort in der Zelle ankommt. Nur Rechnen – geladen wird in `dienstplaner/src/ladeAntworten.ts`, die
 * Fläche malt `PersonenRaster.tsx`.
 *
 * - **Ja = grün, Vielleicht = gelblich, Nein/abwesend = rot schraffiert, keine Antwort = weiß.**
 * - **Abwesenheit (ChurchTools) schlägt die Antwort** am selben Termin (`flaecheAus`).
 * - **„Nur bestimmte Dienste“** (`Antwort.dienste`, fehlt = alle): In einem Dienst, der nicht dabei steht, gilt die Antwort
 *   nicht – die Zelle bleibt weiß, der Tooltip sagt es („Ja – nur für Gesang“). Im Spaltenkopf zählt die Person trotzdem.
 * - **Notiz** (`Antwort.notiz`) steht im Tooltip und im Vorlesetext der Zelle.
 */
import type { Antwort, Antworten, Zusage } from './verfuegbarkeit';

/**
 * Was geladen ist. `sichtbar` = die Dienstgruppen (`Dienst.dienstgruppeId`), deren Antworten gelesen werden konnten. Jede
 * andere Dienstgruppe ist **nicht sichtbar** (Kategorie fehlt, kein Recht, nicht planbar) – dann steht am Block der
 * Hinweis, und die Zellen zeigen keine Antwort (weiß wäre „keine Antwort“ – das wäre gelogen).
 */
export interface PersonenAntworten {
  /** Je Person ihre zusammengeführten Antworten (`antwortenZusammen`), Schlüssel = Termin-ID als Text. */
  jePerson: ReadonlyMap<number, Antworten>;
  sichtbar: ReadonlySet<number>;
}

/** Noch nichts geladen – nichts ist sichtbar. */
export const KEINE_ANTWORTEN: PersonenAntworten = { jePerson: new Map(), sichtbar: new Set() };

/** Die Antwort einer Person auf einen Termin, im Blick auf einen Dienst. */
export interface ZellenAntwort {
  a: Zusage;
  /** Gilt sie für diesen Dienst? Nein, wenn „nur bestimmte Dienste“ ihn nicht nennt. */
  gilt: boolean;
  notiz: string | null;
  /** Die Dienste, auf die sie beschränkt ist (Namen); `null` = alle. */
  nurFuer: string[] | null;
}

/** Was die Fläche einer Zelle zeigt. */
export type ZellenFlaeche = 'ja' | 'vielleicht' | 'nein';

/**
 * Die Antwort einer Person auf einen Termin (Schlüssel = Termin-ID als Text) für einen Dienst. `dienstName` übersetzt die
 * Dienst-IDs der Beschränkung in Namen (unbekannte fallen weg).
 */
export function zellenAntwort(
  antwort: Antwort | undefined,
  dienstId: number,
  dienstName: (id: number) => string | undefined,
): ZellenAntwort | null {
  if (!antwort) return null;
  const namen = antwort.dienste?.flatMap((id) => dienstName(id) ?? []) ?? null;
  return {
    a: antwort.a,
    gilt: !antwort.dienste || antwort.dienste.includes(dienstId),
    notiz: antwort.notiz ?? null,
    nurFuer: namen,
  };
}

/** Die Fläche: Abwesenheit schlägt jede Antwort; sonst zeigt nur eine Antwort, die für den Dienst gilt. */
export function flaecheAus(abwesend: boolean, antwort: ZellenAntwort | null): ZellenFlaeche | null {
  if (abwesend) return 'nein';
  return antwort?.gilt ? antwort.a : null;
}

/** „Ja – nur für Gesang – nur bis 12 Uhr“: Antwort, Beschränkung, Notiz. Für Tooltip und Vorleser. */
export function antwortText(a: ZellenAntwort): string {
  const teile: string[] = [a.a === 'ja' ? 'Ja' : 'Vielleicht'];
  if (a.nurFuer)
    teile.push(
      a.nurFuer.length > 0 ? `nur für ${a.nurFuer.join(', ')}` : 'nur für bestimmte Dienste',
    );
  if (a.notiz) teile.push(a.notiz);
  return teile.join(' – ');
}

/**
 * Der Text der Zelle (Tooltip, Vorleser): `antwortText`, bei einer Abwesenheit mit „– aber abwesend“ – sonst sagte die rot
 * schraffierte Zelle im Tooltip „Ja“ (Abwesenheit schlägt die Antwort, `flaecheAus`).
 */
export function zellenText(a: ZellenAntwort, abwesend: boolean): string {
  return abwesend ? `${antwortText(a)} – aber abwesend` : antwortText(a);
}

/** Die Anzahl **verschiedener Personen** mit Ja bzw. Vielleicht an einem Termin (Spaltenkopf). */
export interface AntwortZahlen {
  ja: number;
  vielleicht: number;
}

/** „5 ja · 1 vielleicht“ – der Text im Spaltenkopf. */
export const zahlenText = (z: AntwortZahlen): string => `${z.ja} ja · ${z.vielleicht} vielleicht`;
