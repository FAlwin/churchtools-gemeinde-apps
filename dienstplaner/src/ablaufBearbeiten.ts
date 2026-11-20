import type { Plan, PlanSpalte } from '@shared/dienstplan/plan';
import { ablaufBearbeitbar } from './start';
import type { MatrixAblauf } from './useMatrixAblauf';

/** Darf man den Ablauf dieses Termins bearbeiten? Abgesagte Termine stehen nur zum Ansehen da (Entwurf E6-6). */
export const darfBearbeiten = (ma: MatrixAblauf, s: PlanSpalte) =>
  !s.abgesagt && ablaufBearbeitbar(ma.start, s.ablaufTermin);

/** Bearbeiten an bzw. aus – eine Stelle für den Knopf in der Leiste und den Stift am Handy. */
export function umschalten(ma: MatrixAblauf): void {
  if (ma.bearbeiten) {
    ma.setBearbeiten(false);
    return;
  }
  ma.setBearbeiten(true);
  ma.setZu(false); // zugeklappt sähe man nicht, was sich öffnet
}

/**
 * Darf man in mindestens einem der gezeigten Termine den Ablauf bearbeiten? Davon hängt ab, ob „Ablauf bearbeiten“ im
 * „⋯“-Menü von Planen steht (B3, R6) – gilt für alle gezeigten Termine, nur wo man mindestens einen davon bearbeiten darf.
 */
export function ablaufBearbeitenMoeglich(ma: MatrixAblauf, plan: Plan, spalten: number[]): boolean {
  return spalten.some((i) => darfBearbeiten(ma, plan.spalten[i]));
}

/** „Ablauf bearbeiten“ aus dem „⋯“-Menü: schaltet das Bearbeiten ein (dieselbe Funktion wie „Fertig“ und der Stift am Handy). */
export function ablaufBearbeitenStart(ma: MatrixAblauf): void {
  if (!ma.bearbeiten) umschalten(ma);
}
