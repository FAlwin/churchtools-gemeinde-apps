/**
 * **Anmeldung von Hand schreiben** (A7-4a) – nach der Messung vom 19.10.2026 (`messung-a7`, „Anmeldung von Hand“):
 * - Suchen: `GET /search?query=…&domain_types[]=person` liefert nur Name und Nummer; Geburtstag und E-Mail kommen aus
 *   `GET /persons?ids[]=…`.
 * - Neu anlegen: `POST /persons` mit den Vorgaben der Veranstaltung (Status, Standort, Bereich) und der Zustimmung zum
 *   Datenschutz („außerhalb ChurchTools“, von der Person selbst oder einem Elternteil). Gleicher Name → 400 mit
 *   `args.duplicatePersonId`, nichts angelegt; `force=true` legt trotzdem an – nur auf ausdrücklichen Wunsch.
 * - Eintragen: `PUT /groups/{id}/members/{personId}` mit Rolle, Status, Warteplatz und Feldern.
 * - ChurchTools selbst schickt dabei keine Mail; sind die Abläufe eingerichtet (A9-1), schickt die Routine die
 *   Bestätigung bzw. die Wartelisten-Mitteilung. Jeder Schritt wird nachgelesen.
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import type { HandPlatz } from '@shared/anmeldung/vonHand';
import {
  NichtUebernommen,
  anmeldungVon,
  neuePersonVorgaben,
  speichereAnmeldung,
  teilnehmerRolle,
  type AnmeldeEinstellungen,
} from './einrichten';
import { angemeldeteId } from '@ui/ct/ich';
import { personenRoh } from './mitglieder';
import { personenSuchen, type Gefunden } from '@ui/ct/personen';

/** Vor- und Nachname der angemeldeten Person – für den Vermerk „Unterschrift auf Papier“. */
export async function meinName(): Promise<string> {
  const ich = await ctDaten<{ firstName?: unknown; lastName?: unknown } | null>('/whoami');
  angemeldeteId(ich);
  return [ich?.firstName, ich?.lastName]
    .filter((x): x is string => typeof x === 'string')
    .join(' ')
    .trim();
}

// Die Suche liegt seit O6 (23.10.2026) in `ui/ct/personen` – das Organigramm nimmt Personen genauso auf.
export { personenSuchen, TREFFER_MAX, type Gefunden } from '@ui/ct/personen';

const gleich = (x: string, y: string) => x.trim().toLowerCase() === y.trim().toLowerCase();

/** **Gibt es schon jemanden mit diesem Namen?** – wie ChurchTools Doppelte erkennt (gemessen: am Namen). */
export async function gleichNamige(vor: string, nach: string): Promise<Gefunden[]> {
  return (await personenSuchen(`${vor} ${nach}`)).filter(
    (p) => gleich(p.vor, vor) && gleich(p.nach, nach),
  );
}

/** ChurchTools kennt schon eine Person mit diesem Namen (vielleicht eine, die man nicht sehen darf). */
export class GibtEsSchon extends ApiError {
  constructor(readonly personId: number | null) {
    super(400, 'In ChurchTools gibt es schon eine Person mit diesem Namen.');
    this.name = 'GibtEsSchon';
  }
}

/** Eine neue Person, wie das Team sie aufnimmt. */
export interface NeuePerson {
  vor: string;
  nach: string;
  geburtstag: string | null;
  email: string | null;
  /** Wer dem Datenschutz zugestimmt hat (außerhalb ChurchTools). */
  zugestimmt: 'selbst' | 'eltern';
}

/** `whoId` der Zustimmung (gemessen 19.10.2026): 1 die Person selbst, 2 ein Elternteil. */
const WER_STIMMT_ZU = { selbst: 1, eltern: 2 } as const;
/** `typeId` 3: außerhalb von ChurchTools (Telefon, Papier). */
const AUSSERHALB = 3;

async function personAnlegen(
  gruppeId: number,
  p: NeuePerson,
  heute: string,
  trotzdem: boolean,
): Promise<number> {
  const v = await neuePersonVorgaben(gruppeId);
  if (!v)
    throw new ApiError(
      422,
      'Für neue Personen fehlen Status, Standort oder Bereich. Das legt ein Gruppen-Admin beim Freigeben der Veranstaltung fest.',
    );
  let id: unknown;
  try {
    const r = await ctAnfrage<{ data?: { id?: number } }>(
      `/persons${trotzdem ? '?force=true' : ''}`,
      {
        method: 'POST',
        body: JSON.stringify({
          firstName: p.vor.trim(),
          lastName: p.nach.trim(),
          ...(p.geburtstag ? { birthday: p.geburtstag } : {}),
          ...(p.email?.trim() ? { email: p.email.trim() } : {}),
          statusId: v.statusId,
          campusId: v.campusId,
          departmentIds: [v.departmentId],
          privacyPolicyAgreement: {
            date: heute,
            typeId: AUSSERHALB,
            whoId: WER_STIMMT_ZU[p.zugestimmt],
          },
        }),
      },
    );
    id = r?.data?.id;
  } catch (x) {
    const doppelt =
      x instanceof ApiError && x.status === 400
        ? (x.daten as { args?: { duplicatePersonId?: unknown } } | undefined)?.args
            ?.duplicatePersonId
        : undefined;
    if (doppelt !== undefined && doppelt !== null) throw new GibtEsSchon(Number(doppelt) || null);
    throw x;
  }
  if (typeof id !== 'number') throw new NichtUebernommen('die neue Person');
  const [neu] = await personenRoh([id]);
  if (!neu || !gleich(neu.firstName ?? '', p.vor) || !gleich(neu.lastName ?? '', p.nach))
    throw new NichtUebernommen('die neue Person');
  return id;
}

interface MitgliedRoh {
  groupMemberStatus?: string;
  waitinglistPosition?: number | null;
  fields?: { id?: unknown; value?: unknown }[];
}

const mitglied = (id: number, personId: number) =>
  ctDaten<MitgliedRoh>(`/groups/${id}/members/${personId}`);

/** Das Mitglied – oder `null`, wenn die Person (noch) nicht in der Gruppe ist (404, gemessen). */
async function mitgliedOderNichts(id: number, personId: number): Promise<MitgliedRoh | null> {
  try {
    return await mitglied(id, personId);
  } catch (x) {
    if (x instanceof ApiError && x.status === 404) return null;
    throw x;
  }
}

/** Was von Hand angemeldet wird. */
export interface VonHandPlan {
  /** Die Person aus ChurchTools – oder eine neue (`neu`). */
  person:
    | { art: 'da'; personId: number; geburtstagNachtragen: string | null }
    | { art: 'neu'; neu: NeuePerson; trotzdem: boolean };
  /** Gruppenfelder (`handFelder`). */
  felder: Record<number, string>;
  /** Feldnummer der Anmelde-Nr. – damit wird nachgelesen. */
  nrFeld: number | undefined;
  platz: HandPlatz;
}

export interface VonHandErgebnis {
  personId: number;
  /** Warteplatz laut ChurchTools; `null` = hat einen Platz. */
  warteplatz: number | null;
  /** Nimmt die Person wieder aus der Gruppe (eine neu angelegte Person bleibt in ChurchTools). */
  rueckgaengig: () => Promise<void>;
}

/**
 * **Von Hand anmelden** – Person anlegen (falls neu), bei voller Gruppe die Plätze erhöhen, eintragen. Scheitert das
 * Eintragen, werden die Plätze zurückgesetzt; eine eben angelegte Person bleibt (sie ist dann beim nächsten Versuch
 * zu finden).
 */
export async function vonHandAnmelden(
  id: number,
  plan: VonHandPlan,
  heute: string,
): Promise<VonHandErgebnis> {
  let personId: number;
  if (plan.person.art === 'neu') {
    personId = await personAnlegen(id, plan.person.neu, heute, plan.person.trotzdem);
  } else {
    personId = plan.person.personId;
    // Schon dabei (auch wartend)? Dann nichts überschreiben – das wäre eine andere Anmeldung.
    if (await mitgliedOderNichts(id, personId))
      throw new ApiError(409, 'Diese Person ist schon bei dieser Veranstaltung angemeldet.');
    if (plan.person.geburtstagNachtragen) {
      await ctAnfrage(`/persons/${personId}`, {
        method: 'PATCH',
        body: JSON.stringify({ birthday: plan.person.geburtstagNachtragen }),
      });
      const [p] = await personenRoh([personId]);
      if (p?.birthday?.slice(0, 10) !== plan.person.geburtstagNachtragen)
        throw new NichtUebernommen('das Geburtsdatum');
    }
  }
  const rolle = await teilnehmerRolle(id);

  let vorher: AnmeldeEinstellungen | null = null;
  if (plan.platz.neuesMax !== null) {
    const a = await anmeldungVon(id);
    if (a.maxPlaetze !== null && a.maxPlaetze < plan.platz.neuesMax) {
      vorher = a;
      await speichereAnmeldung(id, { ...a, maxPlaetze: plan.platz.neuesMax });
    }
  }
  const plaetzeZurueck = async () => {
    if (!vorher) return;
    const jetzt = await anmeldungVon(id);
    if (jetzt.maxPlaetze === plan.platz.neuesMax)
      await speichereAnmeldung(id, { ...jetzt, maxPlaetze: vorher.maxPlaetze });
  };

  const wartet = plan.platz.status === 'waiting';
  let warteplatz: number | null = null;
  try {
    await ctAnfrage(`/groups/${id}/members/${personId}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupTypeRoleId: rolle,
        groupMemberStatus: plan.platz.status,
        ...(wartet && plan.platz.warteplatz ? { waitinglistPosition: plan.platz.warteplatz } : {}),
        fields: plan.felder,
      }),
    });
    const m = await mitgliedOderNichts(id, personId);
    const nr = plan.nrFeld === undefined ? undefined : plan.felder[plan.nrFeld];
    const nrDa =
      nr === undefined ||
      (m?.fields ?? []).some((f) => Number(f.id) === plan.nrFeld && f.value === nr);
    if (!m || m.groupMemberStatus !== plan.platz.status || !nrDa) {
      // Halb übernommen (falscher Status, Nr. fehlt): wieder heraus – ein Fehler lässt nichts halb stehen.
      if (m) await ctAnfrage(`/groups/${id}/members/${personId}`, { method: 'DELETE' });
      throw new NichtUebernommen('die Anmeldung');
    }
    if (wartet) warteplatz = m.waitinglistPosition ?? plan.platz.warteplatz;
  } catch (x) {
    await plaetzeZurueck().catch((y: unknown) =>
      console.warn('Plätze nach Fehler nicht zurückgesetzt', y),
    );
    throw x;
  }

  return {
    personId,
    warteplatz,
    rueckgaengig: async () => {
      await ctAnfrage(`/groups/${id}/members/${personId}`, { method: 'DELETE' });
      if (await mitgliedOderNichts(id, personId)) throw new NichtUebernommen('das Zurücknehmen');
      await plaetzeZurueck();
    },
  };
}
