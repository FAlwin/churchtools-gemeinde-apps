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
 *
 * **Eine Regel für drei Stellen (E5c-4):** Raster, „Wer kann?“ und Zauberstab benutzen dieselben Funktionen – `antwortFuer`
 * (gilt die Antwort für diesen Dienst, ist die Gruppe sichtbar?) und `antwortStufe` (Ja / Vielleicht / keine Antwort / kann
 * nicht). Nirgends sonst wird entschieden, was eine Antwort bedeutet.
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

/**
 * Die Antwort einer Person auf einen Termin im Blick auf einen Dienst – **mit der Sichtbarkeit**: Ist die Dienstgruppe nicht
 * sichtbar (`PersonenAntworten.sichtbar`), gibt es keine Antwort (`null`) – und „keine Antwort“ darf dann nicht
 * wie eine echte aussehen; wer das unterscheiden muss, fragt `antwortenSichtbar`.
 */
export function antwortFuer(
  antworten: PersonenAntworten | null | undefined,
  o: {
    gruppeId: number | null;
    personId: number;
    terminId: number;
    dienstId: number;
    dienstName: (id: number) => string | undefined;
  },
): ZellenAntwort | null {
  if (!antwortenSichtbar(antworten, o.gruppeId)) return null;
  return zellenAntwort(
    antworten?.jePerson.get(o.personId)?.[String(o.terminId)],
    o.dienstId,
    o.dienstName,
  );
}

/** Hat man die Antworten dieser Dienstgruppe lesen können? Nein = nichts davon zeigen (und nichts als „keine Antwort“ werten). */
export function antwortenSichtbar(
  antworten: PersonenAntworten | null | undefined,
  gruppeId: number | null,
): boolean {
  return gruppeId !== null && antworten?.sichtbar.has(gruppeId) === true;
}

/**
 * Die Antworten **aller Personen** auf einen Termin für einen Dienst (nur, wer geantwortet hat). `null`, wenn die
 * Dienstgruppe nicht sichtbar ist – dann zeigen „Wer kann?“ und der Zauberstab keine Antworten, wie vor E5c.
 */
export function antwortenFuerPlatz(
  antworten: PersonenAntworten | null | undefined,
  o: {
    gruppeId: number | null;
    terminId: number;
    dienstId: number;
    dienstName: (id: number) => string | undefined;
  },
): Map<number, ZellenAntwort> | null {
  if (!antwortenSichtbar(antworten, o.gruppeId)) return null;
  const out = new Map<number, ZellenAntwort>();
  for (const personId of antworten?.jePerson.keys() ?? []) {
    const a = antwortFuer(antworten, { ...o, personId });
    if (a) out.set(personId, a);
  }
  return out;
}

/**
 * Wo eine Person bei „Wer kann?“ und im Zauberstab einsortiert wird:
 * - **`ja` / `vielleicht`**: hat für diesen Termin und Dienst geantwortet,
 * - **`keine`**: keine (für diesen Dienst geltende) Antwort – und nicht abwesend,
 * - **`kannNicht`**: in ChurchTools abwesend (das ist das „Nein“, auch trotz Ja) **oder** hat „nur bestimmte Dienste“
 *   gesagt, ohne diesen Dienst (Alwin, 19.11.2026).
 */
export type AntwortStufe = 'ja' | 'vielleicht' | 'keine' | 'kannNicht';

/** Die Reihenfolge der Stufen: Ja vor Vielleicht vor keiner Antwort, „kann nicht“ zuletzt. */
export const STUFEN: readonly AntwortStufe[] = ['ja', 'vielleicht', 'keine', 'kannNicht'];

export function antwortStufe(abwesend: boolean, antwort: ZellenAntwort | null): AntwortStufe {
  if (abwesend) return 'kannNicht';
  if (!antwort) return 'keine';
  return antwort.gilt ? antwort.a : 'kannNicht';
}

/**
 * Die zweite Zeile unter dem Namen in „Wer kann?“ – `null`, wenn der Abschnitt schon alles sagt:
 * - Antwort gilt hier, ohne Notiz und Beschränkung: keine Zeile (die Überschrift „Hat Ja gesagt“ genügt);
 * - mit Notiz: `Vielleicht: „nur bis 12 Uhr“`;
 * - mit Beschränkung auf andere Dienste, oder bei Abwesenheit: derselbe Text wie im Raster (`antwortText`/`zellenText`).
 */
export function antwortZeile(a: ZellenAntwort | null, abwesend: boolean): string | null {
  if (!a) return null;
  if (abwesend || !a.gilt) return zellenText(a, abwesend);
  if (a.nurFuer) return antwortText(a);
  return a.notiz ? `${a.a === 'ja' ? 'Ja' : 'Vielleicht'}: „${a.notiz}“` : null;
}
