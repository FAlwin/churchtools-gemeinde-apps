/**
 * **Die Einstellungen „für alle“ im Browser** (L4-2): Lesen und Speichern über den Anschluss des Dienstplaners
 * (`ladeEntwuerfe`: derselbe Port und dieselbe Modul-ID wie die Entwürfe). Die Regeln stehen in
 * `shared/dienstplan/liveEinstellungen.ts`.
 */
import {
  einstellungenLesen,
  einstellungenSpeichern,
  type DienstplanerEinstellungen,
} from '@shared/dienstplan/liveEinstellungen';
import { modulId, port } from './ladeEntwuerfe';

export const ladeEinstellungen = () => einstellungenLesen(port, modulId);

export const speichereEinstellungen = (
  neu: DienstplanerEinstellungen,
  von: { personId: number; name: string },
  erwartet: number | null,
) => einstellungenSpeichern(port, modulId, neu, von, erwartet);
