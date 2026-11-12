/**
 * **Die Mitglieder aller sichtbaren Gruppen** (Bauplan O2). Je Gruppe ein Abruf (alle Seiten), höchstens
 * vier gleichzeitig (`mapLimit`, wie bei der Statistik der Musik-App) – ChurchTools drosselt sonst.
 *
 * Drei Ausgänge je Gruppe, gemessen an der Test-Instanz (19./22.10.2026):
 * - **sichtbar**: die aktiven Mitglieder (auch eine leere Liste – ChurchTools antwortet auch ohne Leserecht
 *   manchmal mit `200 []`; der Baum sagt deshalb „keine Mitglieder sichtbar“, nicht „keine Mitglieder“),
 * - **verborgen**: 403 – man darf die Mitglieder dieser Gruppe nicht sehen; die Gruppe bleibt im Baum,
 * - **fehler**: alles andere (Netz, 5xx, Drosselung) – **vorübergehend, nicht „verborgen“**: Ein Aussetzer
 *   darf nicht aussehen wie ein fehlendes Recht. Dafür gibt es „Erneut versuchen“.
 * Ein **401** (abgemeldet) gilt für alles und wird weitergeworfen.
 */
import { ctAlleSeiten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { mapLimit } from '@shared/ct/mapLimit';
import {
  mitgliederAus,
  type Mitglied,
  type Person,
  type RohMitglied,
} from '@shared/organigramm/mitglieder';

export type MitgliederStand =
  | { art: 'sichtbar'; mitglieder: Mitglied[]; angefragt: Mitglied[] }
  | { art: 'verborgen' }
  | { art: 'fehler' };

export interface MitgliederDaten {
  je: Map<number, MitgliederStand>;
  personen: Map<number, Person>;
}

export const GLEICHZEITIG = 4;

/** Ein Abruf je Gruppe mit den drei Ausgängen oben – geteilt mit dem Reiter „Kinder & Jugend“ (O9-2). */
export type JeGruppe<T> = { art: 'sichtbar'; wert: T } | { art: 'verborgen' } | { art: 'fehler' };

/**
 * **Die Mitglieder-Liste jeder Gruppe holen und lesen** – die EINE Stelle für Drosselung und die Unterscheidung
 * abgemeldet (wirft) / verborgen (403) / vorübergehend. `aus` liest die Zeilen (hier `mitgliederAus`, im Reiter
 * „Kinder & Jugend“ mit Status).
 */
export async function jeGruppeLaden<T>(
  gruppenIds: readonly number[],
  aus: (rows: RohMitglied[]) => T,
  holen: (pfad: string) => Promise<RohMitglied[]> = (pfad) => ctAlleSeiten<RohMitglied>(pfad),
): Promise<Map<number, JeGruppe<T>>> {
  const je = new Map<number, JeGruppe<T>>();
  // Ein Behälter statt `let`: TypeScript verfolgt Zuweisungen in den Abruf-Rückrufen nicht.
  const abgemeldet: { fehler: ApiError | null } = { fehler: null };
  await mapLimit([...gruppenIds], GLEICHZEITIG, async (id) => {
    if (abgemeldet.fehler) return;
    try {
      je.set(id, { art: 'sichtbar', wert: aus(await holen(`/groups/${id}/members`)) });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) abgemeldet.fehler = e;
      else if (e instanceof ApiError && e.status === 403) je.set(id, { art: 'verborgen' });
      else je.set(id, { art: 'fehler' });
    }
  });
  if (abgemeldet.fehler) throw abgemeldet.fehler;
  return je;
}

export async function ladeMitglieder(
  gruppenIds: readonly number[],
  holen?: (pfad: string) => Promise<RohMitglied[]>,
): Promise<MitgliederDaten> {
  const je = new Map<number, MitgliederStand>();
  const personen = new Map<number, Person>();
  for (const [id, s] of await jeGruppeLaden(gruppenIds, mitgliederAus, holen)) {
    if (s.art !== 'sichtbar') {
      je.set(id, s);
      continue;
    }
    const { mitglieder, angefragt, personen: p } = s.wert;
    for (const x of p) personen.set(x.id, x);
    je.set(id, { art: 'sichtbar', mitglieder, angefragt });
  }
  return { je, personen };
}

/**
 * Bestimmte Gruppen (nach)laden und mit dem Bisherigen zusammenführen – EINE Stelle für die Fälle unten und für
 * „diese Gruppe neu“ nach einer Änderung an ihren Mitgliedern (O6).
 */
export async function gruppenNachladen(
  daten: MitgliederDaten,
  ids: readonly number[],
  holen?: (pfad: string) => Promise<RohMitglied[]>,
): Promise<MitgliederDaten> {
  if (ids.length === 0) return daten;
  const neu = await ladeMitglieder(ids, holen);
  return {
    je: new Map([...daten.je, ...neu.je]),
    personen: new Map([...daten.personen, ...neu.personen]),
  };
}

/** Nur die Gruppen erneut laden, die vorübergehend gescheitert sind – der Rest bleibt stehen. */
export function fehlendeNachladen(
  daten: MitgliederDaten,
  holen?: (pfad: string) => Promise<RohMitglied[]>,
): Promise<MitgliederDaten> {
  const offen = [...daten.je].filter(([, s]) => s.art === 'fehler').map(([id]) => id);
  return gruppenNachladen(daten, offen, holen);
}

/** Nach dem Anlegen (O5): die Mitglieder der Gruppen laden, die es vorher nicht gab. */
export function neueGruppenNachladen(
  daten: MitgliederDaten,
  gruppenIds: readonly number[],
  holen?: (pfad: string) => Promise<RohMitglied[]>,
): Promise<MitgliederDaten> {
  return gruppenNachladen(
    daten,
    gruppenIds.filter((id) => !daten.je.has(id)),
    holen,
  );
}
