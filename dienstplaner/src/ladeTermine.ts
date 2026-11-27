/**
 * **Termine für die Liste laden** (Bauplan E3-2): `/events` mit den Plätzen; Namen und Dienstgruppen der
 * Dienste kennt schon der Start (`start.dienste`). Die Regeln (eigene Dienste, freie Plätze, Filter) stehen
 * in `shared/dienstplan/termine.ts`.
 *
 * Gemessen an der Live-Instanz (13.10.2026): 14 Termine in 6 Wochen, 171 KB, 0,5 s. Deshalb wird in
 * Schritten von 8 Wochen geladen, nicht alles auf einmal. `to` zählt bei ChurchTools nicht mit (E0).
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { isoTag } from '@shared/ct/zeit';
import { plusTage } from '@shared/ct/datum';
import { termineAus, type RohTermin, type TerminZeile } from '@shared/dienstplan/termine';
import { planAus, type Plan } from '@shared/dienstplan/plan';
import { ohneLeereTermine } from '@shared/dienstplan/leereTermine';
import { siehtAlleDienstgruppen } from '@shared/ct/dienstRechte';
import { ganzSichtbar, planbar, type Start } from './start';

/** Liste (Start, Termine) und Matrix (Planen) – aus derselben Antwort, eine Abfrage für alle drei Reiter. */
export interface TermineDaten {
  zeilen: TerminZeile[];
  plan: Plan;
}

/** Ein Ladeschritt in Wochen. */
export const WOCHEN_JE_SCHRITT = 8;

/** So weit lädt „ab heute“ höchstens nach (ein Jahr) – weiter blättert man mit einem gewählten Zeitraum. */
export const MAX_WOCHEN = 52;

/**
 * Termine von heute bis `wochen` Wochen voraus. **Wirft**, wenn die Termine nicht als Liste kommen – eine
 * leere Liste hieße „keine Termine“, und das wäre bei einem Aussetzer falsch.
 */
export async function ladeTermine(
  start: Start,
  wochen: number,
  zeitzone: string,
  jetzt = new Date(),
): Promise<TermineDaten> {
  const von = isoTag(jetzt);
  const bis = isoTag(new Date(jetzt.getTime() + wochen * 7 * 86_400_000));
  return ladeVonBis(start, von, bis, zeitzone);
}

/**
 * **Ein gewählter Zeitraum** für die Matrix (Monat oder von–bis, Alwin 14.10.2026), `bis` eingeschlossen –
 * dieselbe Abfrage und dieselben Regeln wie `ladeTermine`. ChurchTools zählt `to` nicht mit (E0), deshalb
 * wird ein Tag dazugerechnet.
 */
export function ladeZeitraum(
  start: Start,
  von: string,
  bis: string,
  zeitzone: string,
): Promise<TermineDaten> {
  return ladeVonBis(start, von, plusTage(bis, 1), zeitzone);
}

/**
 * Die rohen Termine von `von` (eingeschlossen) bis `bisAusschliesslich` (nicht, wie ChurchTools' `to`) mit ihren Plätzen.
 * **Wirft**, wenn sie nicht als Liste kommen – eine Stelle für Liste, Matrix und „Verfügbarkeit → Zusagen“.
 * **Termine ohne sichtbaren Platz fehlen** (`ohneLeereTermine`) – außer für Menschen, die alle Dienstgruppen sehen.
 */
export async function ladeRohTermine(
  start: Pick<Start, 'rechte' | 'dienstgruppen'>,
  von: string,
  bisAusschliesslich: string,
): Promise<RohTermin[]> {
  const termine = await ctDaten<unknown>(
    `/events?from=${von}&to=${bisAusschliesslich}&include=eventServices`,
  );
  if (!Array.isArray(termine)) {
    throw new ApiError(502, 'ChurchTools hat die Termine nicht vollständig geliefert.');
  }
  return ohneLeereTermine(
    termine as RohTermin[],
    siehtAlleDienstgruppen(start.rechte, start.dienstgruppen),
  );
}

/** `von` eingeschlossen, `bisAusschliesslich` nicht (wie ChurchTools' `to`). */
async function ladeVonBis(
  start: Start,
  von: string,
  bisAusschliesslich: string,
  zeitzone: string,
): Promise<TermineDaten> {
  return datenAus(start, await ladeRohTermine(start, von, bisAusschliesslich), zeitzone, true);
}

/**
 * Ein Termin für die Termin-Ansicht. Kalender und Admins für die Bearbeiten-Regel des Ablaufs (E6-3a) stehen seit E6-6a
 * an der Spalte (`PlanSpalte.ablaufTermin`) – dieselbe Stelle wie in der Matrix.
 */
export type TerminDaten = TermineDaten;

/**
 * Wer einen Termin öffnet, den ChurchTools ihm nicht zeigt (z. B. über einen geteilten Link), bekommt das gesagt – nicht
 * die Regel fürs Planen. Das Einteilen hat seinen eigenen Text (`dienstPort`).
 */
export const TERMIN_VERWEIGERT =
  'Diesen Termin zeigt dir ChurchTools nicht. Wenn du ihn sehen musst, frag die Leitung deiner Dienstgruppe.';

/**
 * **Ein Termin** für die Termin-Ansicht (E6-1b) – mit denselben Regeln wie Liste und Matrix (`datenAus`), damit die
 * Dienste dort genauso stehen. Wirft wie `ctDaten` (404 = den Termin gibt es nicht mehr).
 */
export async function ladeTermin(start: Start, id: number, zeitzone: string): Promise<TerminDaten> {
  const termin = await ctDaten<unknown>(`/events/${id}?include=eventServices`, {
    verweigert: TERMIN_VERWEIGERT,
  });
  if (
    !termin ||
    typeof termin !== 'object' ||
    !Array.isArray((termin as RohTermin).eventServices)
  ) {
    throw new ApiError(502, 'ChurchTools hat den Termin nicht vollständig geliefert.');
  }
  return datenAus(start, [termin as RohTermin], zeitzone, false);
}

/**
 * Liste und Matrix aus den rohen Terminen – eine Stelle für den Zeitraum und den einzelnen Termin.
 * `alleDienste`: jeder planbare Dienst bekommt in der Matrix eine Zeile, auch ohne Platz (nur im Zeitraum – die
 * Termin-Ansicht zeigt nur, was es an dem Termin gibt; dort gäbe es sonst eine Liste leerer Dienste).
 */
function datenAus(
  start: Start,
  roh: RohTermin[],
  zeitzone: string,
  alleDienste: boolean,
): TermineDaten {
  return {
    zeilen: termineAus(roh, {
      ichId: start.ichId,
      dienste: start.dienste,
      planbar: (dienst, admin) => planbar(start, dienst, admin),
      zeitzone,
    }),
    plan: planAus(roh, {
      ichId: start.ichId,
      dienste: start.dienste,
      dienstgruppen: start.dienstgruppen,
      zeitzone,
      planbar: (dienst) => planbar(start, dienst),
      ganzSichtbar: (dienst) => ganzSichtbar(start, dienst),
      // Jeder Dienst, den man planen darf, bekommt eine Zeile – auch wenn ihn niemand vorgesehen hat (Fund 20.11.2026).
      immerZeigen: alleDienste
        ? (dienst) => planbar(start, dienst) && ganzSichtbar(start, dienst)
        : undefined,
    }),
  };
}
