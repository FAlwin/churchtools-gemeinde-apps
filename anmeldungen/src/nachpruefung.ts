/**
 * **Nachprüfung laden** (A6-5c, #623) – Mitglieder (ohne Leitung), dazu die Geburtstage, wenn Preise nach Alter sie
 * brauchen. Gerechnet wird in `nachpruefen` (`shared/anmeldung/nachpruefung.ts`).
 */
import { ctAlleSeiten, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { wozuGeburtsdatum } from '@shared/anmeldung/preis';
import { nachpruefen, type Nachpruefung, type PruefMitglied } from '@shared/anmeldung/nachpruefung';
import { leitungsRollen } from './einrichten';

interface MitgliedRoh {
  personId?: number;
  person?: { title?: string };
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
  memberStartDate?: string | null;
  fields?: { id?: unknown; value?: unknown }[];
}

const FELDER = ['nr', 'kontakt', 'betrag', 'aufschluesselung', 'auswahl', 'extras'] as const;

/** Geburtstage je Person – in Paketen, eine Anfrage je 50 Personen. */
async function geburtstage(ids: number[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const teil = ids.slice(i, i + 50);
    const personen = await ctDaten<{ id: number; birthday?: string | null }[]>(
      `/persons?${teil.map((x) => `ids[]=${x}`).join('&')}&limit=${teil.length}`,
    );
    for (const p of personen) if (p.birthday) m.set(p.id, p.birthday);
  }
  return m;
}

/**
 * **Die Nachprüfung einer Veranstaltung** – `null`, wenn man die Mitglieder nicht sehen darf (403, dauerhaft; die
 * Karte erscheint dann nicht). Alles andere kann vorübergehend sein und wird geworfen.
 */
export async function ladeNachpruefung(
  id: number,
  e: OeffentlicheEinstellungen,
  maxPlaetze: number | null,
): Promise<Nachpruefung | null> {
  let roh: MitgliedRoh[];
  let leitung: Set<number>;
  try {
    [roh, leitung] = await Promise.all([
      ctAlleSeiten<MitgliedRoh>(`/groups/${id}/members`, 200),
      leitungsRollen(),
    ]);
  } catch (x) {
    if (x instanceof ApiError && x.status === 403) return null;
    throw x;
  }
  // Die Leitung belegt keinen Platz und hat keine Anmeldung (#623).
  const teilnehmer = roh.filter(
    (m) => typeof m.personId === 'number' && !leitung.has(m.groupTypeRoleId ?? -1),
  );
  const geburt = wozuGeburtsdatum(e.preis)
    ? await geburtstage(teilnehmer.map((m) => m.personId!))
    : new Map<number, string>();
  const text = (m: MitgliedRoh, feldId: number | undefined) => {
    const w = (m.fields ?? []).find((f) => Number(f.id) === feldId)?.value;
    return typeof w === 'string' && w.trim() ? w.trim() : undefined;
  };
  const mitglieder: PruefMitglied[] = teilnehmer.map((m) => {
    const felder: PruefMitglied['felder'] = {};
    for (const k of FELDER) {
      const w = text(m, e.ctFelder[k]);
      if (w !== undefined) felder[k] = w;
    }
    return {
      personId: m.personId!,
      name: m.person?.title ?? '',
      status:
        m.groupMemberStatus === 'active'
          ? 'aktiv'
          : m.groupMemberStatus === 'waiting'
            ? 'wartet'
            : 'sonst',
      seit: m.memberStartDate?.slice(0, 10) ?? null,
      geburtstag: geburt.get(m.personId!) ?? null,
      felder,
    };
  });
  return nachpruefen(e, mitglieder, {
    belegt: mitglieder.filter((m) => m.status === 'aktiv').length,
    wartend: mitglieder.filter((m) => m.status === 'wartet').length,
    max: maxPlaetze,
  });
}
