import type { AblaufZeile } from '@shared/ct/ablaufZeile';

/** „G · 120 bpm · Autor“ – was die Karte unter dem Liedname zeigt; leer, wenn nichts davon bekannt ist. */
export function liedMeta(song: NonNullable<AblaufZeile['song']>): string {
  return [song.originalKey, song.bpm ? `${song.bpm} bpm` : null, song.author]
    .filter((t): t is string => !!t && t.trim() !== '')
    .join(' · ');
}

/** Zeigt die Lied-Karte überhaupt etwas? Nicht, wenn der Liedname schon im Titel steht und es keine Angaben gibt. */
export function liedKarteLeer(song: NonNullable<AblaufZeile['song']>, ohneTitel: boolean): boolean {
  return ohneTitel && !liedMeta(song);
}
