/**
 * **Die Abfragen einer Dienstgruppe im Browser** (R-2): Lesen und Speichern über den Anschluss des Dienstplaners
 * (`ladeEntwuerfe`: derselbe Port und dieselbe Modul-ID wie Entwürfe und Einstellungen). Die Regeln stehen in
 * `shared/dienstplan/abfragenSpeicher.ts`.
 */
import type { AbfragenInhalt } from '@shared/dienstplan/abfragen';
import { abfragenLesen, abfragenSpeichern } from '@shared/dienstplan/abfragenSpeicher';
import { modulId, port } from './ladeEntwuerfe';

export const ladeAbfragen = (dienstgruppeId: number) =>
  abfragenLesen(port, modulId, dienstgruppeId);

export const speichereAbfragen = (
  dienstgruppeId: number,
  neu: AbfragenInhalt,
  von: { personId: number; name: string },
  erwartet: number | null,
) => abfragenSpeichern(port, modulId, dienstgruppeId, neu, von, erwartet);
