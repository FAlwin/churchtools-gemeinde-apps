/**
 * **Der Live-Verlauf im Browser** (L4-3): Lesen und Festhalten über den Anschluss des Dienstplaners (`ladeEntwuerfe`: derselbe
 * Port und dieselbe Modul-ID wie die Entwürfe und Einstellungen). Die Regeln stehen in `shared/dienstplan/liveVerlaufSpeicher.ts`
 * und `shared/ct/liveVerlauf.ts`.
 */
import type { Wechsel } from '@shared/ct/liveVerlauf';
import { verlaufLesen, verlaufSchreiben } from '@shared/dienstplan/liveVerlaufSpeicher';
import { modulId, port } from './ladeEntwuerfe';

export const ladeVerlauf = (terminId: number) => verlaufLesen(port, modulId, terminId);

export const schreibeVerlauf = (terminId: number, neue: readonly Wechsel[]) =>
  verlaufSchreiben(port, modulId, terminId, neue);
