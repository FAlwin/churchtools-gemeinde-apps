/**
 * **Der Plan „neue Gliederung“ im Speicher der Erweiterung** (Bauplan O7-1): EIN Wert in der Kategorie „Plan“, mit
 * Versionsnummer, Konflikt und Nachlesen (`@shared/ct/versionierterWert`). Die Regeln des Plans stehen in
 * `@shared/organigramm/plan`.
 *
 * Sehen und ändern dürfen ihn nur Gruppen-Admins (Alwin, 24.10.2026). Die Oberfläche fragt dafür „Gruppen verwalten“
 * ab; ChurchTools selbst schützt die Kategorie über ihre Rechte (setzt Alwin). Ohne Leserecht auf die Kategorie ist sie
 * für ChurchTools „nicht da“ – dann gibt es eben keinen Plan.
 */
import { kategorieSicherstellen, kategorieSuchen } from '@shared/ct/modulDaten';
import {
  dokumentEntfernen,
  dokumentSpeichern,
  type LeseErgebnis,
  type SpeicherErgebnis,
} from '@shared/ct/versionierterWert';
import { PLAN_ART, planAus, type PlanAenderungen } from '@shared/organigramm/plan';
import { dokumentAusKategorie, modulId, port } from './speicher';

export { _vergissModul } from './speicher';

const NUR_ADMIN =
  'Den Plan dürfen nur Gruppen-Admins ändern – und wer in ChurchTools die Kategorie „Plan“ bearbeiten darf.';
const KATEGORIE = {
  kuerzel: 'plan',
  name: 'Plan „neue Gliederung“',
  beschreibung: 'Angelegt von der Erweiterung „Organigramm“ – nur für Gruppen-Admins.',
};

export type PlanStand = LeseErgebnis<PlanAenderungen>;

/** Den Plan frisch lesen. Keine Kategorie (noch nie gespeichert) = kein Plan. */
export function ladePlan(): Promise<PlanStand> {
  return dokumentAusKategorie(KATEGORIE.kuerzel, PLAN_ART, planAus);
}

/** Speichern – `erwartet` ist die gesehene Version (`null` = Plan neu anlegen). */
export async function speicherePlan(
  aenderungen: PlanAenderungen,
  von: { personId: number; name: string },
  erwartet: number | null,
): Promise<SpeicherErgebnis<PlanAenderungen>> {
  const modul = await modulId();
  const kategorie = await kategorieSicherstellen(port, modul, KATEGORIE, NUR_ADMIN);
  return dokumentSpeichern(port, modul, kategorie, PLAN_ART, aenderungen, von, erwartet, NUR_ADMIN);
}

/** Den Plan verwerfen – nur, wenn noch die gesehene Version dasteht. ChurchTools selbst bleibt, wie es ist. */
export async function verwerfePlan(erwartet: number): Promise<SpeicherErgebnis<PlanAenderungen>> {
  const modul = await modulId();
  const kategorie = await kategorieSuchen(port, modul, KATEGORIE.kuerzel);
  if (kategorie === null) return { ok: true, daten: null };
  return dokumentEntfernen(port, modul, kategorie, PLAN_ART, erwartet, NUR_ADMIN);
}
