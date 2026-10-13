import type { AblaufQuelle, AblaufVorlage, Service } from '@shared/types/index';

/**
 * Was das Fenster „Ablauf anlegen" vorschlägt (13.10.2026). Reine Funktionen, damit die Auswahl ohne
 * Oberfläche prüfbar ist.
 */

/**
 * Vorlagen für einen Termin: die seines Kalenders zuerst, danach alle übrigen – jeweils in der
 * Reihenfolge, in der sie kommen (nach Namen sortiert, `vorlagenAus`).
 */
export function vorlagenFuer(vorlagen: AblaufVorlage[], kalenderId?: number): AblaufVorlage[] {
  if (kalenderId === undefined) return vorlagen;
  return [
    ...vorlagen.filter((v) => v.kalenderId === kalenderId),
    ...vorlagen.filter((v) => v.kalenderId !== kalenderId),
  ];
}

/**
 * Frühere Veranstaltungen, deren Ablauf sich kopieren lässt: aus demselben Kalender (wenn bekannt),
 * VOR dem Termin, die jüngste zuerst – meist also „letzter Sonntag".
 */
export function kopieVorschlaege(ziel: Service, mitAblauf: Service[]): Service[] {
  return mitAblauf
    .filter((s) => s.id !== ziel.id && s.start < ziel.start)
    .filter((s) => ziel.kalenderId === undefined || s.kalenderId === ziel.kalenderId)
    .sort((a, b) => b.start.localeCompare(a.start));
}

/**
 * Was vorausgewählt ist (Alwin: „Vorlage zuerst"): die erste Vorlage, sonst die jüngste frühere
 * Veranstaltung, sonst leer.
 */
export function startQuelle(vorlagen: AblaufVorlage[], vorschlaege: Service[]): AblaufQuelle {
  if (vorlagen.length > 0) return { art: 'vorlage', vorlageId: vorlagen[0].id };
  if (vorschlaege.length > 0) return { art: 'kopie', eventId: vorschlaege[0].id };
  return { art: 'leer' };
}
