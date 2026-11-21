/**
 * **Was die Vorschau der Erweiterung sagen darf** (Bauplan Website W3a-2).
 *
 * Die Vorschau ist ein abgeschottetes `iframe` – darin läuft aber auch der Baustein „Eigenes HTML“ (E-W12), fremder Code,
 * der **Nachrichten fälschen kann**. Deshalb gilt für alles, was von dort ankommt:
 *
 * 1. **Nur Nachrichten, die aus genau diesem iframe kommen** (`event.source === iframe.contentWindow`, in `Vorschau.tsx`).
 * 2. **Form prüfen** (`schema` unten): bekannte Art, nur ganze Zahlen. Alles Unbekannte wird ignoriert; **nichts** aus der
 *    Nachricht außer diesen Zahlen wird übernommen (kein Text, kein HTML, keine Kennung).
 * 3. **Zahlen gegen die Seite prüfen** (`nachrichtLesen`): ein Abschnitt, den es nicht gibt, ist keine Nachricht.
 * 4. Eine Nachricht löst **nie mehr aus als ein Klick**: ein Fenster öffnen, einen Abschnitt oder Baustein verschieben (`verschieben`,
 *    W3c-2: nur Zahlen, beide Stellen müssen existieren), die Spaltenbreite oder den Abstand eines Abschnitts ändern (`aufteilung`/
 *    `abstand`, W3c-3: eine Zahl und ein Name aus den Listen des Modells – eine Aufteilung nur mit der Spaltenzahl des Abschnitts),
 *    einen Abschnitt kopieren, einen eigenen Schritt rückgängig machen.
 *    **Löschen fragt immer erst nach** (Bestätigungsfenster) – eine gefälschte „löschen“-Nachricht kann also nichts
 *    wegnehmen, was der Mensch nicht bestätigt.
 * 5. **Die eine Ausnahme: der getippte Text** (`text`, W3c-1). Er ist die einzige Nachricht mit Inhalt – und der kommt nur an,
 *    wenn (a) die Stelle ein tippbares Feld ist (`textFeldGueltig`: nie „Eigenes HTML“, nie ein Feld, das es nicht gibt),
 *    (b) die Form stimmt (feste Läufe aus Text, Fett, Kursiv, Link – nichts sonst), (c) **jede Link-Adresse die echte Regel
 *    besteht** (`istLinkAdresse`, dieselbe wie beim Rendern) und (d) dem Rahmen vorher dasselbe Feld als „wird getippt“ gemeldet
 *    wurde (`Vorschau.tsx`, nur einmal gültig). Der Text geht danach durch Schema und Speicherschlange wie jede Änderung. Das ist
 *    kein Schutz gegen den Baustein „Eigenes HTML“ (der könnte beides fälschen) – sein Spielraum ist aber nur: Text in einem
 *    Textfeld ändern, und das kann die Leitung, die ihn gebaut hat, ohnehin.
 */
import { z } from 'zod';
import {
  abschnittDa,
  aufteilungGleicheSpalten,
  bausteinDa,
  bausteinStelleDa,
  einfuegeStelleDa,
  spalteDa,
} from '@shared/website/bearbeiten';
import { istLinkAdresse } from '@shared/website/markdown';
import { aufteilungSchema, gestaltungSchema, type Seite } from '@shared/website/modell';
import { textFeldGueltig, type TextFeld } from './textAenderung';

const zahl = z.number().int().min(0).max(100_000);
const kopf = { websiteEditor: z.literal(true) };

const stelle = { i: zahl, j: zahl, k: zahl };
const feldArt = z.enum(['text', 'markdown', 'knopf']);
const feldStelle = { ...stelle, feld: feldArt, n: z.number().int().min(0).max(3) };
const text = z.string().max(20_000);
/** Ein Stück getippter Text mit gleicher Auszeichnung – nur diese Felder, nichts sonst. */
const lauf = z
  .object({
    t: text.min(1),
    fett: z.literal(true).optional(),
    kursiv: z.literal(true).optional(),
    link: z.string().max(2000).optional(),
  })
  .strict();
const block = z
  .object({ art: z.enum(['p', 'h', 'ul', 'ol']), laeufe: z.array(lauf).max(500) })
  .strict();

// Ziehen (W3c-2): nur Zahlen. `nach` ist eine **Stelle** (vor welchem Abschnitt / Baustein), keine Kennung.
const stelleStreng = z.object(stelle).strict();
const verschiebenAbschnitt = z
  .object({
    ...kopf,
    was: z.literal('verschieben'),
    art: z.literal('abschnitt'),
    von: zahl,
    nach: zahl,
  })
  .strict();
const verschiebenBaustein = z
  .object({
    ...kopf,
    was: z.literal('verschieben'),
    art: z.literal('baustein'),
    von: stelleStreng,
    nach: stelleStreng,
  })
  .strict();

// Maße ziehen (W3c-3): eine Zahl und ein Name aus den Listen des Modells (`AUFTEILUNGEN`, die Stufen des Abstands) – sonst nichts.
const abstandSchema = gestaltungSchema.shape.abstand;
const aufteilung = z
  .object({ ...kopf, was: z.literal('aufteilung'), i: zahl, aufteilung: aufteilungSchema })
  .strict();
const abstand = z
  .object({ ...kopf, was: z.literal('abstand'), i: zahl, abstand: abstandSchema })
  .strict();

const einfach = z.discriminatedUnion('was', [
  z.object({ ...kopf, was: z.literal('einfuegen'), i: zahl }),
  z.object({ ...kopf, was: z.literal('gestalten'), i: zahl }),
  z.object({ ...kopf, was: z.literal('kopieren'), i: zahl }),
  z.object({ ...kopf, was: z.literal('loeschen'), i: zahl }),
  z.object({ ...kopf, was: z.literal('baustein'), i: zahl, j: zahl, k: zahl }),
  z.object({ ...kopf, was: z.literal('baustein-neu'), i: zahl, j: zahl }),
  z.object({ ...kopf, was: z.literal('scroll'), y: z.number().finite() }),
  // Text direkt tippen (W3c-1): „es wird getippt“ (Stelle) → der Text (nur einmal gültig) → „fertig“. Links prüft der Rahmen.
  z.object({ ...kopf, was: z.literal('tippen'), ...feldStelle }),
  z.object({ ...kopf, was: z.literal('tippen-ende') }),
  z.object({
    ...kopf,
    was: z.literal('link-pruefen'),
    id: z.number().int().min(0).max(1_000_000_000),
    url: z.string().max(2000),
  }),
  z.object({
    ...kopf,
    was: z.literal('text'),
    ...feldStelle,
    wert: text.optional(),
    bloecke: z.array(block).max(500).optional(),
    weiter: z.object(feldStelle).strict().optional(),
  }),
  // Strg/Cmd+Z in der Vorschau (W3c-2), wenn dort kein Text offen ist – ohne Inhalt.
  z.object({ ...kopf, was: z.literal('rueckgaengig') }),
  z.object({ ...kopf, was: z.literal('wiederholen') }),
  // „Die Ebene läuft“ – ohne Inhalt. Bleibt sie aus, blockiert ChurchTools das Skript (`Vorschau.tsx` zeigt dann einen Hinweis).
  z.object({ ...kopf, was: z.literal('bereit') }),
]);

const schema = z.union([einfach, verschiebenAbschnitt, verschiebenBaustein, aufteilung, abstand]);

export type EditorNachricht = z.infer<typeof schema>;
/** Was die Seitenarbeit zu tun bekommt: die Klicks der Leisten und der getippte Text. */
export type EditorAktion = Exclude<
  EditorNachricht,
  { was: 'scroll' | 'bereit' | 'tippen' | 'tippen-ende' | 'link-pruefen' }
>;
export type TextNachricht = Extract<EditorNachricht, { was: 'text' }>;
export type TippStelle = { i: number; j: number; k: number; feld: TextFeld; n: number };

/** Ist es dieselbe Stelle? (Der Text kommt nur an, wenn sie vorher als „wird getippt“ gemeldet wurde.) */
export function gleicheTippStelle(a: TippStelle, b: TippStelle): boolean {
  return a.i === b.i && a.j === b.j && a.k === b.k && a.feld === b.feld && a.n === b.n;
}

/** Gibt es dieses tippbare Feld auf dieser Seite? */
function feldDa(seite: Seite, m: TippStelle): boolean {
  return (
    bausteinDa(seite, m.i, m.j, m.k) &&
    textFeldGueltig(seite.abschnitte[m.i].spalten[m.j].bausteine[m.k], m.feld, m.n)
  );
}

/**
 * Eine Nachricht der Vorschau lesen – `null`, wenn sie keine gültige ist (falsche Form, oder die Stelle gibt es auf dieser
 * Seite nicht). Die Quelle (`event.source`) prüft der Aufrufer.
 */
export function nachrichtLesen(daten: unknown, seite: Seite): EditorNachricht | null {
  const r = schema.safeParse(daten);
  if (!r.success) return null;
  const m = r.data;
  switch (m.was) {
    case 'bereit':
    case 'tippen-ende':
      return m;
    case 'link-pruefen':
      return m;
    case 'tippen':
      return feldDa(seite, m) ? m : null;
    case 'text': {
      if (!feldDa(seite, m) || (m.weiter && !feldDa(seite, m.weiter))) return null;
      // Je Feld genau die eine Form: Text mit Auszeichnung (`bloecke`) oder reiner Text (`wert`).
      if (
        m.feld === 'markdown'
          ? !m.bloecke || m.wert !== undefined
          : m.wert === undefined || m.bloecke !== undefined
      )
        return null;
      // Jede Link-Adresse muss die echte Regel bestehen – sonst ist es keine Nachricht (abgelehnt, nichts wird übernommen).
      const links = (m.bloecke ?? []).flatMap((bl) =>
        bl.laeufe.flatMap((l) => (l.link === undefined ? [] : [l.link])),
      );
      return links.every(istLinkAdresse) ? m : null;
    }
    case 'scroll':
      return { ...m, y: Math.min(1_000_000, Math.max(0, Math.round(m.y))) };
    case 'rueckgaengig':
    case 'wiederholen':
      return m;
    case 'verschieben':
      // Nur Zahlen, und beide Stellen müssen es auf dieser Seite geben (`bearbeiten.ts`, dieselben Prüfungen wie beim Verschieben).
      if (m.art === 'abschnitt')
        return abschnittDa(seite, m.von) && einfuegeStelleDa(seite, m.nach) ? m : null;
      return bausteinDa(seite, m.von.i, m.von.j, m.von.k) &&
        bausteinStelleDa(seite, m.nach.i, m.nach.j, m.nach.k)
        ? m
        : null;
    case 'aufteilung':
      // Nur eine Aufteilung mit der Spaltenzahl des Abschnitts (`aufteilungGleicheSpalten`, dieselbe Regel wie bei der Übernahme).
      return abschnittDa(seite, m.i) &&
        aufteilungGleicheSpalten(seite.abschnitte[m.i], m.aufteilung)
        ? m
        : null;
    case 'abstand':
      return abschnittDa(seite, m.i) ? m : null;
    case 'einfuegen':
      return einfuegeStelleDa(seite, m.i) ? m : null;
    case 'baustein':
      return bausteinDa(seite, m.i, m.j, m.k) ? m : null;
    case 'baustein-neu':
      return spalteDa(seite, m.i, m.j) ? m : null;
    default:
      return abschnittDa(seite, m.i) ? m : null;
  }
}
