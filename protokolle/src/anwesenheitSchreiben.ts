import {
  ctStatus,
  treffenStandAus,
  vorbelegung,
  type AnwesenheitsStatus,
  type TreffenStand,
} from '@shared/protokolle/anwesenheit';
import type { Anfrage } from '@shared/protokolle/sitzungen';
import { NichtUebernommen } from '@ui/ct/fehler';
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';

/**
 * **Anwesenheit lesen und schreiben** (Bauplan S5-3) – im ChurchTools-Gruppentreffen. Gemessen 05.11.2026
 * (`messung-s5-3-2026-11-05.md`):
 * - anwesend: `POST /groups/{g}/checkin/{person} {groupMeetingId}`;
 * - abwesend / wieder offen: `DELETE /groups/{g}/meetings/{m}/members/{person}` **mit** `{status: 'absent' | 'unsure'}`
 *   (so macht es die ChurchTools-Oberfläche; ohne Rumpf heißt es abwesend).
 * Jeder Schritt wird nachgelesen – erst was ChurchTools danach sagt, gilt.
 */

const json = (body: unknown) => JSON.stringify(body);
const VERWEIGERT =
  'Dir fehlt in ChurchTools das Recht, Gruppentreffen zu pflegen – ein Admin richtet die Gruppe ein.';

/** Was ein Gruppentreffen beim Zurückschreiben braucht. */
export interface TreffenRumpf {
  startDate: string;
  isCompleted: boolean;
  isCanceled: boolean;
  comment: unknown;
  numGuests: unknown;
  pollResult: unknown;
}

/**
 * **Ein Gruppentreffen ändern** – ganz lesen, ändern, ganz zurückschreiben, nachlesen. ChurchTools leert, was im `PUT`
 * fehlt (Kommentar, Gäste, Rückmeldung – K2b 29.10., S6-0 11.11.2026), und `startDate` ist Pflicht. Die eine Stelle für
 * Verschieben (K2b) und Abschließen (S6-1). `aendern` gibt `null` zurück, wenn nichts zu tun ist. Liefert das
 * nachgelesene Treffen.
 */
export async function treffenAendern(
  gruppe: number,
  id: number,
  aendern: (r: TreffenRumpf) => TreffenRumpf | null,
  verweigert?: string,
): Promise<Partial<TreffenRumpf> | null> {
  const pfad = `/groups/${gruppe}/meetings/${id}`;
  const d = await ctDaten<Record<string, unknown>>(pfad);
  const rumpf = aendern({
    startDate: typeof d?.startDate === 'string' ? d.startDate : '',
    isCompleted: d?.isCompleted === true,
    isCanceled: d?.isCanceled === true,
    comment: d?.comment ?? null,
    numGuests: d?.numGuests ?? null,
    pollResult: d?.pollResult ?? null,
  });
  if (!rumpf) return d;
  await ctAnfrage(pfad, {
    method: 'PUT',
    body: json(rumpf),
    ...(verweigert ? { verweigert } : {}),
  });
  return ctDaten<Partial<TreffenRumpf>>(pfad);
}

/**
 * **Gruppentreffen abschließen** (S6-1, bei der Freigabe): danach sperrt ChurchTools die Anwesenheit (gemessen S6-0).
 * Schon abgeschlossen → nichts zu tun. Nachgelesen.
 */
export async function treffenAbschliessen(gruppe: number, id: number): Promise<void> {
  const nach = await treffenAendern(
    gruppe,
    id,
    (r) => (r.isCompleted ? null : { ...r, isCompleted: true }),
    VERWEIGERT,
  );
  if (nach?.isCompleted !== true) throw new NichtUebernommen('das Abschließen des Gruppentreffens');
}

/** Das Treffen und seine Personen. Die Liste der Personen blättert (ChurchTools liefert manche Listen seitenweise). */
export async function anwesenheitLesen(gruppe: number, treffen: number): Promise<TreffenStand> {
  const [t, personen] = await Promise.all([
    ctDaten<unknown>(`/groups/${gruppe}/meetings/${treffen}`),
    ctAlleSeiten<unknown>(`/groups/${gruppe}/meetings/${treffen}/members`),
  ]);
  return treffenStandAus(t, personen);
}

async function schreiben(
  gruppe: number,
  treffen: number,
  person: number,
  status: AnwesenheitsStatus,
): Promise<void> {
  if (status === 'da')
    await ctAnfrage(`/groups/${gruppe}/checkin/${person}`, {
      method: 'POST',
      body: json({ groupMeetingId: treffen }),
      verweigert: VERWEIGERT,
    });
  else
    await ctAnfrage(`/groups/${gruppe}/meetings/${treffen}/members/${person}`, {
      method: 'DELETE',
      body: json({ status: ctStatus(status) }),
      verweigert: VERWEIGERT,
    });
}

/** Nachlesen: Steht bei allen, was geschrieben wurde? Sonst wirft es – erst was ChurchTools sagt, gilt. */
async function nachlesen(
  gruppe: number,
  treffen: number,
  soll: readonly { person: number; status: AnwesenheitsStatus }[],
): Promise<TreffenStand> {
  const neu = await anwesenheitLesen(gruppe, treffen);
  const ist = new Map(neu.personen.map((p) => [p.person, p.status]));
  if (soll.some((s) => ist.get(s.person) !== s.status))
    throw new NichtUebernommen('die Anwesenheit');
  return neu;
}

/** Eine Person auf `status` setzen und nachlesen. Wirft, wenn ChurchTools danach etwas anderes sagt. */
export async function statusSetzen(
  gruppe: number,
  treffen: number,
  person: number,
  status: AnwesenheitsStatus,
): Promise<TreffenStand> {
  await schreiben(gruppe, treffen, person, status);
  return nachlesen(gruppe, treffen, [{ person, status }]);
}

/**
 * **Von selbst vorbelegen** (`vorbelegung`): Zusagen anwesend, Absagen abwesend – nur, solange am Treffen noch niemand
 * etwas eingetragen hat. Gibt den Stand nach dem Schreiben zurück (unverändert, wenn nichts zu tun war).
 */
export async function vorbelegen(
  gruppe: number,
  treffen: number,
  stand: TreffenStand,
  anfragen: readonly Anfrage[],
): Promise<TreffenStand> {
  const soll = vorbelegung(stand, anfragen);
  if (!soll.length) return stand;
  // Erst alle schreiben, dann EINMAL nachlesen – nicht je Person (eine ganze Gruppe wären sonst doppelt so viele Abrufe).
  for (const v of soll) await schreiben(gruppe, treffen, v.person, v.status);
  return nachlesen(gruppe, treffen, soll);
}
