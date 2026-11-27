import type { Vorschau } from '@shared/protokolle/themenreihe';

/**
 * **Der neue Text mit Hervorhebung:** die Zeilen des Reihe-Abschnitts, die vorher nicht im Event standen. Bei „neu“ der
 * ganze Abschnitt, bei „geändert“ nur, was sich unterscheidet. Reine Anzeige – geschrieben wird `neuerText`.
 */
export function hervorgehoben(v: Pick<Vorschau, 'neuerText' | 'alterText' | 'abschnitt'>): {
  text: string;
  neu: boolean;
}[] {
  const text = v.neuerText ?? '';
  const start = v.abschnitt ? text.indexOf(v.abschnitt) : -1;
  if (!v.abschnitt || start < 0) return [{ text, neu: false }];
  const alt = new Set((v.alterText ?? '').split('\n').map((l) => l.replace(/\r$/, '')));
  const vor = text.slice(0, start);
  const nach = text.slice(start + v.abschnitt.length);
  const teile = [{ text: vor, neu: false }];
  const zeilen = v.abschnitt.split('\n');
  zeilen.forEach((z, i) => {
    teile.push({ text: z + (i < zeilen.length - 1 ? '\n' : ''), neu: !alt.has(z) });
  });
  teile.push({ text: nach, neu: false });
  return teile.filter((t) => t.text !== '');
}
