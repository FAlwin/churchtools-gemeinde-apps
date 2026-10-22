/**
 * **Mitglieder einer Veranstaltung laden** (A7-1) – einmal für Liste und Nachprüfung: Mitglieder (ohne Leitung), ihr
 * Verlauf (Anmeldetag, Absagen), die Gruppenfelder (Auswahl als Text) und die Personen (E-Mail, Geburtstag, Name der
 * Abgesagten). Gerechnet wird in `shared/anmeldung/liste.ts`.
 */
import { ctAlleSeiten, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  abgesagteIds,
  mitgliederstandAus,
  type CtGruppenfeld,
  type Mitgliederstand,
  type MitgliedRoh,
  type PersonDaten,
  type VerlaufRoh,
} from '@shared/anmeldung/liste';
import { leitungsRollen } from './einrichten';

/** Mehr gibt ChurchTools beim Verlauf nicht her – und es gibt keine Seiten (gemessen 19.10.2026). */
export const VERLAUF_MAX = 500;

export interface GeladenerStand extends Mitgliederstand {
  /** Der Verlauf war zu lang (die ältesten Einträge fehlen) – Absagen und Anmeldetage können unvollständig sein. */
  verlaufGekuerzt: boolean;
}

const verboten = (x: unknown) => x instanceof ApiError && x.status === 403;

/** Ein dauerhaftes „darf nicht“ (403) heißt: gibt es nicht. Alles andere kann vorübergehend sein und wird geworfen. */
async function ohne403<T>(p: Promise<T>, sonst: T): Promise<T> {
  try {
    return await p;
  } catch (x) {
    if (verboten(x)) return sonst;
    throw x;
  }
}

/** Eine Person, wie `GET /persons?ids[]=…` sie liefert (soweit gebraucht). */
export interface PersonRoh {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  birthday?: string | null;
}

/** **Personen je Nummer** – in Paketen, eine Anfrage je 50 Personen. Für die Liste und die Suche von Hand (A7-4). */
export async function personenRoh(ids: number[]): Promise<PersonRoh[]> {
  const alle: PersonRoh[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const teil = ids.slice(i, i + 50);
    alle.push(
      ...(await ctDaten<PersonRoh[]>(
        `/persons?${teil.map((x) => `ids[]=${x}`).join('&')}&limit=${teil.length}`,
      )),
    );
  }
  return alle;
}

async function personenLaden(ids: number[]): Promise<Map<number, PersonDaten>> {
  const m = new Map<number, PersonDaten>();
  for (const p of await personenRoh(ids))
    m.set(p.id, {
      name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
      email: p.email || null,
      geburtstag: p.birthday || null,
    });
  return m;
}

/** **Die Gruppenfelder einer Veranstaltung** (je Nummer) – für die Liste und die Anmeldung von Hand (A7-4). */
export async function gruppenfelderLaden(id: number): Promise<Map<number, CtGruppenfeld>> {
  const roh = await ctDaten<{ type?: string; field?: CtGruppenfeld }[]>(
    `/groups/${id}/memberfields`,
  );
  const felder = new Map<number, CtGruppenfeld>();
  for (const f of roh) if (f.type === 'group' && f.field) felder.set(f.field.id, f.field);
  return felder;
}

/**
 * **Der Stand einer Veranstaltung** – `null`, wenn man die Mitglieder nicht sehen darf (403, dauerhaft). Verlauf,
 * Gruppenfelder und Personen sind Zugaben: Fehlt dafür das Recht, gibt es keine Absagen bzw. keine E-Mail.
 */
export async function ladeMitglieder(id: number): Promise<GeladenerStand | null> {
  let roh: MitgliedRoh[];
  let leitung: Set<number>;
  try {
    [roh, leitung] = await Promise.all([
      ctAlleSeiten<MitgliedRoh>(`/groups/${id}/members`, 200),
      leitungsRollen(),
    ]);
  } catch (x) {
    if (verboten(x)) return null;
    throw x;
  }
  const [verlauf, felder] = await Promise.all([
    ohne403(ctDaten<VerlaufRoh[]>(`/groups/${id}/members/history?limit=${VERLAUF_MAX}`), []),
    ohne403(gruppenfelderLaden(id), new Map<number, CtGruppenfeld>()),
  ]);
  const ids = [
    ...roh.filter((m) => !leitung.has(m.groupTypeRoleId ?? -1)).map((m) => m.personId!),
    ...abgesagteIds(verlauf, roh),
  ].filter((x) => typeof x === 'number');
  const personen = await ohne403(personenLaden(ids), new Map<number, PersonDaten>());
  return {
    ...mitgliederstandAus(roh, verlauf, felder, leitung, personen),
    verlaufGekuerzt: verlauf.length >= VERLAUF_MAX,
  };
}
