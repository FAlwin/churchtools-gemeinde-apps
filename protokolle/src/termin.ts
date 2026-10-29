/**
 * **Einen Kalendertermin lesen** – den Termin selbst und seine Besprechungsanfragen. Die eine Stelle dafür: Liste der
 * Sitzungen (`lesen.ts`), Festlegen (`planen.ts`) und Bearbeiten (`bearbeiten.ts`). Bis 29.10.2026 las jede der drei
 * die Anfragen selbst, mit eigener Umrechnung von Person und Antwort.
 */
import type { TerminRoh } from '@shared/protokolle/bearbeiten';
import { antwortAus, type Antwort } from '@shared/protokolle/sitzungen';
import { NichtUebernommen } from '@ui/ct/fehler';
import { ctDaten } from '@ui/ct/verbindung';

export type TerminRef = { kalender: number; id: number };

export const terminPfad = (t: TerminRef) => `/calendars/${t.kalender}/appointments/${t.id}`;

/** Der Termin samt den berechneten Terminen einer Serie (`calculatedDates`, Beginn je Termin). */
export async function terminDaten(
  termin: TerminRef,
): Promise<{ roh: TerminRoh; termine: string[] }> {
  const d = await ctDaten<{ appointment?: TerminRoh; calculatedDates?: unknown }>(
    terminPfad(termin),
  );
  if (!d?.appointment) throw new NichtUebernommen('den Termin');
  const c = d.calculatedDates;
  const termine =
    c && typeof c === 'object'
      ? Object.values(c as Record<string, { startDate?: unknown } | null>)
          .map((x) => x?.startDate)
          .filter((x): x is string => typeof x === 'string')
      : [];
  return { roh: d.appointment, termine };
}

/** Der Termin, wie ChurchTools ihn hat (`data.appointment`). */
export async function terminLaden(termin: TerminRef): Promise<TerminRoh> {
  return (await terminDaten(termin)).roh;
}

/** Eine Besprechungsanfrage, wie ChurchTools sie liefert (gemessen S3-3: `person.domainIdentifier`, `state`). */
interface AnfrageRoh {
  id?: number;
  person?: { domainIdentifier?: string };
  inviteeId?: number;
  state?: string;
}

/** **Die Besprechungsanfragen eines Termins** – bei einer Serie gelten sie für alle ihre Termine. */
export async function anfragenLesen(
  termin: TerminRef,
): Promise<{ id?: number; person: number; antwort: Antwort }[]> {
  const liste = (await ctDaten<AnfrageRoh[]>(`${terminPfad(termin)}/meetingrequests`)) ?? [];
  return (Array.isArray(liste) ? liste : []).map((a) => ({
    ...(a.id !== undefined ? { id: a.id } : {}),
    person: Number(a.person?.domainIdentifier ?? a.inviteeId),
    antwort: antwortAus(a.state),
  }));
}
