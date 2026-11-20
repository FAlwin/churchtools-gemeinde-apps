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
 * 4. Eine Nachricht löst **nie mehr aus als ein Klick**: ein Fenster öffnen, einen Abschnitt verschieben oder kopieren.
 *    **Löschen fragt immer erst nach** (Bestätigungsfenster) – eine gefälschte „löschen“-Nachricht kann also nichts
 *    wegnehmen, was der Mensch nicht bestätigt. Geschrieben wird erst, wenn der Editor es von sich aus tut.
 */
import { z } from 'zod';
import { abschnittDa, bausteinDa, einfuegeStelleDa, spalteDa } from '@shared/website/bearbeiten';
import type { Seite } from '@shared/website/modell';

const zahl = z.number().int().min(0).max(100_000);
const kopf = { websiteEditor: z.literal(true) };

const schema = z.discriminatedUnion('was', [
  z.object({ ...kopf, was: z.literal('einfuegen'), i: zahl }),
  z.object({ ...kopf, was: z.literal('gestalten'), i: zahl }),
  z.object({ ...kopf, was: z.literal('hoch'), i: zahl }),
  z.object({ ...kopf, was: z.literal('runter'), i: zahl }),
  z.object({ ...kopf, was: z.literal('kopieren'), i: zahl }),
  z.object({ ...kopf, was: z.literal('loeschen'), i: zahl }),
  z.object({ ...kopf, was: z.literal('baustein'), i: zahl, j: zahl, k: zahl }),
  z.object({ ...kopf, was: z.literal('baustein-neu'), i: zahl, j: zahl }),
  z.object({ ...kopf, was: z.literal('scroll'), y: z.number().finite() }),
]);

export type EditorNachricht = z.infer<typeof schema>;
export type EditorAktion = Exclude<EditorNachricht, { was: 'scroll' }>;

/**
 * Eine Nachricht der Vorschau lesen – `null`, wenn sie keine gültige ist (falsche Form, oder die Stelle gibt es auf dieser
 * Seite nicht). Die Quelle (`event.source`) prüft der Aufrufer.
 */
export function nachrichtLesen(daten: unknown, seite: Seite): EditorNachricht | null {
  const r = schema.safeParse(daten);
  if (!r.success) return null;
  const m = r.data;
  switch (m.was) {
    case 'scroll':
      return { ...m, y: Math.min(1_000_000, Math.max(0, Math.round(m.y))) };
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
