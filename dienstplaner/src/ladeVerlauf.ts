/**
 * **Der Live-Verlauf im Browser** (L4-3): Lesen und Festhalten über den Anschluss des Dienstplaners (`ladeEntwuerfe`: derselbe
 * Port und dieselbe Modul-ID wie die Entwürfe und Einstellungen). Die Regeln stehen in `shared/dienstplan/liveVerlaufSpeicher.ts`
 * und `shared/ct/liveVerlauf.ts`.
 *
 * **Alle Verläufe für den Schnitt (L4-4):** `ladeAlleVerlaeufe` liest die ganze Kategorie **einmal je Seitenaufruf** und hält
 * das Ergebnis – Rückblick und „Ø beim Ablauf bearbeiten“ rechnen daraus, ohne dass jede Ansicht, jeder Termin-Wechsel oder
 * jeder Takt die wachsende Kategorie noch einmal liest. Neu gelesen wird nur auf Anforderung (`verlaufCacheLeeren`, z. B. nach
 * dem Schließen von „Live“). Ein Fehler wird **nicht** gehalten: Der nächste Aufruf versucht es wieder.
 */
import type { Ausnahme, Wechsel } from '@shared/ct/liveVerlauf';
import type { VerlaufTermin } from '@shared/ct/liveRueckblick';
import {
  verlaufAlleLesen,
  verlaufLesen,
  verlaufSchreiben,
  type VerlaufAlle,
} from '@shared/dienstplan/liveVerlaufSpeicher';
import { modulId, port } from './ladeEntwuerfe';

export const ladeVerlauf = (terminId: number) => verlaufLesen(port, modulId, terminId);

export const schreibeVerlauf = (terminId: number, neue: readonly Wechsel[]) =>
  verlaufSchreiben(port, modulId, terminId, neue);

/** Markierungen „nicht im Schnitt“ festhalten (A9): zusammengeführt, nachgelesen – wie die Wechsel. */
export const schreibeAusnahmen = (terminId: number, neue: readonly Ausnahme[]) =>
  verlaufSchreiben(port, modulId, terminId, [], neue);

let gehalten: Promise<VerlaufAlle> | null = null;

/** Alle Verläufe – beim ersten Aufruf gelesen, danach aus dem Gehaltenen. */
export function ladeAlleVerlaeufe(): Promise<VerlaufAlle> {
  if (gehalten) return gehalten;
  const abfrage = verlaufAlleLesen(port, modulId);
  gehalten = abfrage;
  const vergessen = () => {
    if (gehalten === abfrage) gehalten = null;
  };
  abfrage.then((r) => (r.ok ? undefined : vergessen()), vergessen);
  return abfrage;
}

/** Das Gehaltene verwerfen – der nächste Aufruf liest neu (nach „Live“, in Tests). */
export function verlaufCacheLeeren(): void {
  gehalten = null;
}

/** Der Verlauf eines Termins im Gehaltenen ersetzen (nach dem Festhalten einer Markierung), ohne neu zu lesen. */
export async function verlaufImCacheErsetzen(terminId: number, neu: VerlaufTermin): Promise<void> {
  if (!gehalten) return;
  const alt = await gehalten;
  if (alt.ok)
    gehalten = Promise.resolve({ ok: true, termine: new Map(alt.termine).set(terminId, neu) });
}
