import { vi } from 'vitest';
import type * as Echt from './useToDoEinstellungen';

/**
 * **Die To-Do-Einstellungen ohne Netz** – für Tests, die die To-Do-Seite zeigen (`ToDos.test.tsx`,
 * `ToDos.board.test.tsx`). Ohne das gleicht `useToDoEinstellungen` über die echte Personen-Ablage mit ChurchTools ab:
 * Die Abfrage scheitert („fetch failed“) erst nach dem Test, das `console.warn` kommt, während Vitest die Umgebung
 * schon schließt – „EnvironmentTeardownError: Closing rpc while onUserConsoleLog was pending“ ließ die CI rot werden,
 * obwohl alle Tests grün waren (PR #836, 04.11.2026).
 *
 * Alles andere bleibt echt (Gerät, Mischen); nur der Abgleich gibt zurück, was er bekommt. Einbinden mit
 * `vi.mock('./useToDoEinstellungen', async (orig) => (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig))`.
 */
export const abgleich = vi.fn<Echt.Abgleich>((lokal) => Promise.resolve(lokal));

export async function ohneAbgleich(orig: () => Promise<typeof Echt>): Promise<typeof Echt> {
  const echt = await orig();
  return {
    ...echt,
    useToDoEinstellungen: (person, q = {}) => echt.useToDoEinstellungen(person, { abgleich, ...q }),
  };
}
