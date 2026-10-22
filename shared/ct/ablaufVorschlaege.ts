import type { AblaufQuelle, AblaufVorlage } from '../types/index';

/**
 * Was das Fenster „Ablauf anlegen" vorschlägt (13.10.2026). Reine Funktionen, damit die Auswahl ohne
 * Oberfläche prüfbar ist. Seit E6-5a in `shared/ct` (vorher `client/src/utils/`): Musik-App und Dienstplaner wählen
 * mit denselben Regeln – Termine nur mit den Feldern, die die Regeln brauchen.
 */

/** Was die Regeln von einem Termin brauchen – `Service` der Musik-App passt hinein. */
export interface VorschlagsTermin {
  id: number;
  /** Beginn (ISO), zum Vergleichen und Sortieren. */
  start: string;
  kalenderId?: number | null;
}

/**
 * Vorlagen für einen Termin: die seines Kalenders zuerst, danach alle übrigen – jeweils in der
 * Reihenfolge, in der sie kommen (nach Namen sortiert, `vorlagenAus`).
 */
export function vorlagenFuer(
  vorlagen: AblaufVorlage[],
  kalenderId?: number | null,
): AblaufVorlage[] {
  if (kalenderId === undefined || kalenderId === null) return vorlagen;
  return [
    ...vorlagen.filter((v) => v.kalenderId === kalenderId),
    ...vorlagen.filter((v) => v.kalenderId !== kalenderId),
  ];
}

/**
 * Frühere Veranstaltungen, deren Ablauf sich kopieren lässt: aus demselben Kalender (wenn bekannt),
 * VOR dem Termin, die jüngste zuerst – meist also „letzter Sonntag".
 */
export function kopieVorschlaege<T extends VorschlagsTermin>(
  ziel: VorschlagsTermin,
  mitAblauf: T[],
): T[] {
  return mitAblauf
    .filter((s) => s.id !== ziel.id && s.start < ziel.start)
    .filter(
      (s) =>
        ziel.kalenderId === undefined ||
        ziel.kalenderId === null ||
        s.kalenderId === ziel.kalenderId,
    )
    .sort((a, b) => b.start.localeCompare(a.start));
}

/**
 * Was vorausgewählt ist (Alwin: „Vorlage zuerst"): die erste Vorlage, sonst die jüngste frühere
 * Veranstaltung, sonst leer.
 */
export function startQuelle(
  vorlagen: AblaufVorlage[],
  vorschlaege: readonly { id: number }[],
): AblaufQuelle {
  if (vorlagen.length > 0) return { art: 'vorlage', vorlageId: vorlagen[0].id };
  if (vorschlaege.length > 0) return { art: 'kopie', eventId: vorschlaege[0].id };
  return { art: 'leer' };
}
