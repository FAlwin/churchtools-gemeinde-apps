import type { PlaetzeZeile } from './PlaetzeFach';
import { sperreText } from './plaetzeTexte';

/**
 * **Wie weit lassen sich die Plätze eines Dienstes ändern?** – EINE Stelle für den Regler (`PlatzRegler`), den Hinweis
 * im Fenster (`PlatzFenster`) und die Liste im Fach (`PlaetzeFach`). Alwin, 19.11.2026: „Alles bleibt in der Planung
 * anpassbar“.
 *
 * - **Plus geht immer** – auch mit Entwürfen: Der Dienstplaner trägt sie nach der Änderung selbst auf die neuen
 *   Nummern um (`anzahlMitEntwuerfen` in `ladeEntwuerfe.ts`).
 * - **Minus stoppt bei den Plätzen mit Inhalt:** unter die belegten Plätze und die Entwürfe auf **freien** Plätzen geht
 *   es nicht (ein Entwurf auf einem belegten Platz – Ersetzen, Zurückziehen – zählt nicht extra, der Platz ist schon
 *   belegt). Sonst müsste ChurchTools einen Platz mit Entwurf wegnehmen.
 * - **Gesperrt** (beides) nur, wo die Entwürfe nicht umgetragen werden dürfen: Die Schublade der Dienstgruppe ist
 *   nicht „bereit“ (`PlaetzeZeile.mitnehmbar`).
 */
export type PlatzGrenze =
  | { art: 'gesperrt'; hinweis: string }
  | {
      art: 'frei';
      kleinste: number;
      /** Warum „−“ gerade nicht geht – `null`, wenn es geht. */
      grund: 'belegt' | 'entwuerfe' | null;
      hinweis: string | null;
    };

export function plaetzeGrenze(z: PlaetzeZeile, n: number): PlatzGrenze {
  if (z.entwuerfe > 0 && !z.mitnehmbar)
    return { art: 'gesperrt', hinweis: sperreText(z.entwuerfe) };
  const kleinste = z.belegt + z.entwuerfeAufFreien;
  if (n > kleinste) return { art: 'frei', kleinste, grund: null, hinweis: null };
  if (n <= z.belegt) {
    // Bei 0 Belegten ist 0 Plätze einfach „aus“ – dazu gibt es nichts zu sagen.
    return z.belegt === 0
      ? { art: 'frei', kleinste, grund: null, hinweis: null }
      : {
          art: 'frei',
          kleinste,
          grund: 'belegt',
          hinweis: 'Erst jemanden herausnehmen – unter die Zahl der Belegten geht es nicht.',
        };
  }
  return {
    art: 'frei',
    kleinste,
    grund: 'entwuerfe',
    hinweis: 'Auf den freien Plätzen liegen Entwürfe – zum Verkleinern erst einen entfernen.',
  };
}

/** Darf „−“ jetzt gedrückt werden? (Von außen kommt `beschaeftigt` dazu.) */
export const minusErlaubt = (g: PlatzGrenze, n: number): boolean =>
  g.art === 'frei' && n > g.kleinste;

/** Darf „+“ jetzt gedrückt werden? */
export const plusErlaubt = (g: PlatzGrenze): boolean => g.art === 'frei';
