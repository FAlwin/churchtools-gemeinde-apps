/**
 * **Terminvorlagen von ChurchTools** (`GET /eventtemplates`, Dienstplaner „Vorlage übernehmen“). Gemessen an der
 * Live-Instanz (13.11.2026): `{ data: [{ id, templateName, calendarId, eventName, services: [{ serviceId, count }], … }] }`,
 * etwa `id 0` „Standard“ – die ID **0 ist gültig** (`ctId`).
 *
 * Gelesen wird tolerant und **wirft nie bei Einzelfehlern**: Ein kaputter Eintrag fällt weg, die übrigen bleiben – eine
 * halbe Liste ist hier besser als keine, denn die Vorlage ist nur eine Abkürzung.
 */
import { ctId } from './ctId';

/** Ein Dienst einer Vorlage: so viele Plätze soll er am Termin haben. */
export interface VorlagenDienst {
  serviceId: number;
  count: number;
}

export interface TerminVorlage {
  id: number;
  name: string;
  /** Der Kalender, zu dem die Vorlage gehört – nur dort wird sie angeboten. */
  kalenderId: number;
  /** Die Dienste mit ihrer Anzahl (je Dienst einmal, bei Doppelten zählt die größere Zahl). */
  dienste: VorlagenDienst[];
}

/** Die Dienste einer Vorlage – ungültige Einträge (keine ID, keine Zahl über 0) fallen weg, Doppelte werden eins. */
function diensteAus(roh: unknown): VorlagenDienst[] {
  if (!Array.isArray(roh)) return [];
  const je = new Map<number, number>();
  for (const d of roh as { serviceId?: unknown; count?: unknown }[]) {
    if (!d || typeof d !== 'object') continue;
    const serviceId = ctId(d.serviceId);
    const count = typeof d.count === 'number' && Number.isInteger(d.count) ? d.count : null;
    if (serviceId === null || count === null || count < 1) continue;
    je.set(serviceId, Math.max(je.get(serviceId) ?? 0, count));
  }
  return [...je].map(([serviceId, count]) => ({ serviceId, count }));
}

/**
 * Die Vorlagen aus der Antwort, in der Reihenfolge von ChurchTools. Übersprungen wird, was keine ID, keinen Namen,
 * keinen Kalender oder keinen brauchbaren Dienst hat – so eine Vorlage könnte nichts tun. Keine Liste → leer.
 */
export function terminVorlagenAus(roh: unknown): TerminVorlage[] {
  if (!Array.isArray(roh)) return [];
  const out: TerminVorlage[] = [];
  for (const v of roh as Record<string, unknown>[]) {
    if (!v || typeof v !== 'object') continue;
    const id = ctId(v.id);
    const kalenderId = ctId(v.calendarId);
    const name = typeof v.templateName === 'string' ? v.templateName.trim() : '';
    const dienste = diensteAus(v.services);
    if (id === null || kalenderId === null || name === '' || dienste.length === 0) continue;
    out.push({ id, name, kalenderId, dienste });
  }
  return out;
}

/** Nur die Vorlagen eines Kalenders. */
export const vorlagenFuerKalender = (vorlagen: readonly TerminVorlage[], kalenderId: number) =>
  vorlagen.filter((v) => v.kalenderId === kalenderId);
