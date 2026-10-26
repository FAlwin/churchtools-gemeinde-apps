/**
 * **Abläufe in ChurchTools schreiben** (A9-1) – die Routinen „Platz“ und „Warteliste“ einer Veranstaltung. Was darin
 * steht, baut `shared/anmeldung/ablaeufe.ts`; hier wird nur geschrieben und nachgelesen.
 *
 * Gemessen 24.10.2026 (`messung-a9-2026-10-24.md`):
 * - `POST /routines` mit `domainContext {groupId, groupTypeRoleId, groupMemberStatus}` hängt die Routine selbst an die
 *   Gruppe; `GET /groups/{id}/members/routines` liefert sie samt Schritten.
 * - `PATCH /routines/{id}` nimmt die ganze Schrittliste; mitgeschickte Schritt-Nummern bleiben, laufende Abläufe
 *   bleiben an ihrer Stelle.
 * - Eine neue Routine erfasst nur, wer **danach** ankommt – schon Angemeldete bekommen beim Einrichten keine Mail.
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ROUTINEN, ablaufMails, routinenSchritte } from '@shared/anmeldung/ablaeufe';
import { systemfelderNachziehen, teilnehmerRolle } from './einrichten';
import { platzhalterLaden } from './rundmail';

const json = (body: unknown) => JSON.stringify(body);

interface SchrittRoh {
  id: number;
  actionKey: string;
  isEnabled?: boolean;
  actionData?: {
    subject?: string;
    addSignOutUrl?: boolean;
    senderId?: number;
    sender?: { title?: string } | null;
  } | null;
}

interface RoutineRoh {
  id: number;
  name?: string;
  isEnabled?: boolean;
  steps?: SchrittRoh[];
}

/** Ein Eintrag aus `GET /groups/{id}/members/routines` (gemessen: `id` = Nummer der Routine). */
interface ZuordnungRoh {
  id: number;
  groupTypeRoleId: number;
  groupMemberStatus: string;
  routine?: RoutineRoh | null;
}

/** Ist das eine Routine dieser Erweiterung? Eigene Routinen aus ChurchTools fasst sie nicht an. */
const istUnsere = (r: RoutineRoh | null | undefined) =>
  !!r && ROUTINEN.some((x) => x.name === r.name);

/** Was die Karte „Mails“ zeigt. */
export interface AblaufStand {
  /** Bestätigung nach dem Anmelden und beim Nachrücken. */
  platz: boolean;
  /** Mitteilung für die Warteliste. */
  warte: boolean;
  /** Schickt ChurchTools noch seine eigene Mail beim Anmelden? */
  standardMail: boolean;
  /** Wer als Absender erscheint (Name), wenn eingerichtet. */
  absender: string | null;
}

/** **Wie es steht** – für die Karte „Mails“. */
export async function ablaeufeLesen(id: number): Promise<AblaufStand> {
  const [zuordnungen, g, rolle] = await Promise.all([
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
    ctDaten<{ settings?: { sendDefaultSignUpMail?: boolean } }>(`/groups/${id}`),
    teilnehmerRolle(id),
  ]);
  const an = (status: string) => {
    const r = zuordnungen.find(
      (z) => z.groupTypeRoleId === rolle && z.groupMemberStatus === status,
    )?.routine;
    return istUnsere(r) && r?.isEnabled === true ? r : null;
  };
  const platz = an('active');
  const mail = platz?.steps?.find((s) => s.actionKey === 'send-member-email');
  return {
    platz: !!platz,
    warte: !!an('waiting'),
    standardMail: g.settings?.sendDefaultSignUpMail !== false,
    absender: mail?.actionData?.sender?.title ?? null,
  };
}

/**
 * **Abläufe einrichten oder neu schreiben** – beim Freigeben (A9-1). Reihenfolge mit Absicht: erst die Routinen, dann
 * die Standard-Mail aus. Scheitert etwas dazwischen, bekommen Angemeldete höchstens zwei Mails, nie keine.
 * `absenderId`: Person, die als Absender erscheint (Antworten gehen an sie).
 */
export async function ablaeufeEinrichten(id: number, absenderId: number): Promise<void> {
  // Das Feld „Link zur Anmeldung“ muss es geben, bevor eine Mail es als Platzhalter nennt.
  const e = await systemfelderNachziehen(id);
  const [g, platzhalter, rolle, zuordnungen] = await Promise.all([
    ctDaten<{ name: string }>(`/groups/${id}`),
    platzhalterLaden(id),
    teilnehmerRolle(id),
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
  ]);
  const mails = ablaufMails(e, g.name, platzhalter);
  if (mails.unbekannt.length)
    throw new ApiError(
      422,
      `Für die Bestätigungsmail fehlen in ChurchTools: ${mails.unbekannt.join(', ')}.`,
    );

  for (const r of ROUTINEN) {
    const vorhanden = zuordnungen.find(
      (z) => z.groupTypeRoleId === rolle && z.groupMemberStatus === r.status,
    );
    if (vorhanden && !istUnsere(vorhanden.routine))
      throw new ApiError(
        409,
        `In ChurchTools gibt es für diese Veranstaltung schon einen eigenen Ablauf („${vorhanden.routine?.name ?? 'ohne Namen'}“). Die Erweiterung lässt ihn stehen – bitte dort entfernen oder die Mails dort pflegen.`,
      );
    let routineId = vorhanden?.id;
    if (routineId === undefined) {
      const neu = await ctAnfrage<{ data?: { id?: number } }>('/routines', {
        method: 'POST',
        body: json({
          domainType: 'group_membership',
          name: r.name,
          isEnabled: false,
          domainContext: { groupId: id, groupTypeRoleId: rolle, groupMemberStatus: r.status },
        }),
      });
      routineId = neu?.data?.id;
      if (typeof routineId !== 'number') throw new NichtUebernommen('den Ablauf „' + r.name + '“');
    }
    const mail = r.art === 'platz' ? mails.platz : mails.warte;
    await ctAnfrage(`/routines/${routineId}`, {
      method: 'PATCH',
      body: json({
        isEnabled: true,
        steps: routinenSchritte(mail, absenderId, vorhanden?.routine?.steps ?? []),
      }),
    });
    // Nachlesen: Ein 200 allein beweist nicht, dass ChurchTools die Mail auch so verschickt.
    const nachher = await ctDaten<RoutineRoh>(`/routines/${routineId}`);
    const s = nachher.steps?.find((x) => x.actionKey === 'send-member-email');
    if (
      nachher.isEnabled !== true ||
      !s?.isEnabled ||
      s.actionData?.subject !== mail.betreff ||
      s.actionData?.addSignOutUrl !== false ||
      s.actionData?.senderId !== absenderId
    )
      throw new NichtUebernommen('den Ablauf „' + r.name + '“');
  }

  await ctAnfrage(`/groups/${id}`, {
    method: 'PATCH',
    body: json({ sendDefaultSignUpMail: false }),
  });
  const nachher = await ctDaten<{ settings?: { sendDefaultSignUpMail?: boolean } }>(
    `/groups/${id}`,
  );
  if (nachher.settings?.sendDefaultSignUpMail !== false)
    throw new NichtUebernommen('das Abschalten der Standard-Mail von ChurchTools');
}

/** Absender der Bestätigungsmails: wer freigibt, wenn er zur gewählten Leitung gehört – sonst die erste gewählte. */
export function absenderAus(gewaehlt: ReadonlySet<number>, ich: number | null): number {
  if (ich !== null && gewaehlt.has(ich)) return ich;
  const erste = [...gewaehlt][0];
  if (erste === undefined)
    throw new ApiError(422, 'Bitte mindestens eine Person als Leitung wählen.');
  return erste;
}
