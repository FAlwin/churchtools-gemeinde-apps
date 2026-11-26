import type { Absence } from '@shared/types/index';
import { zeitfensterKurz } from './absenceDatum';

/**
 * **„Deine Zeiträume“** (Dienstplaner V-3, Entwurf `verfuegbarkeit-einstellungen-v4.html`): die eigenen Abwesenheiten, die ein
 * ganzer Zeitraum sind – mehrere Tage (Urlaub) oder ein ganzer Tag ohne Uhrzeit –, soweit sie den gezeigten Zeitraum
 * (`von`–`bis`, einschließlich) schneiden. Ein Eintrag mit Uhrzeit an einem Tag ist ein Haken an einem Termin und steht dort
 * (`zeitfensterKurz`: dieselbe Frage „hat der Eintrag ein Zeitfenster?“ wie in den Listen). Nach Beginn sortiert.
 */
export function deineZeitraeume(
  eintraege: readonly Absence[],
  von: string,
  bis: string,
): Absence[] {
  return eintraege
    .filter(
      (a) =>
        (a.startDate !== a.endDate || zeitfensterKurz(a) === null) &&
        a.endDate >= von &&
        a.startDate <= bis,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
}
