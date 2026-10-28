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
 * - A9-2a (gemessen 26.10.2026): Die **Beschreibung** einer Routine (höchstens 1.000 Zeichen) hält den eigenen Mailtext;
 *   beim Neuschreiben der Schritte ohne `description` bleibt sie stehen.
 * - A9-2b (gemessen 26.10.2026): `qrCodeCheckin` legt beim Einschalten für alle schon Angemeldeten einen Code an. Mit
 *   `qrCodeCheckinAutomaticEmail: true` (Vorgabe von ChurchTools) schickt es dazu eine eigene Mail „Dein Check-in-Code“ –
 *   an alle schon Angemeldeten und danach an jede neue Person. Darum immer beides zusammen: an + eigene Mail aus.
 *   Echte Prüfung 28.10.2026: Wird die Code-Mail bei laufendem Check-in eingeschaltet, geht sie sofort an alle – der
 *   Abgleich kann sie danach nur noch abstellen.
 */
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import {
  OHNE_EIGENEN_TEXT,
  ROUTINEN,
  ablaufMails,
  eigenerTextAlsBeschreibung,
  eigenerTextAus,
  eigenerTextFehler,
  routinenSchritte,
  type EigenerText,
  type RoutinenArt,
} from '@shared/anmeldung/ablaeufe';
import { systemfelderNachziehen, teilnehmerRolle } from './einrichten';
import { platzhalterLaden } from './rundmail';

const json = (body: unknown) => JSON.stringify(body);

interface SchrittRoh {
  id: number;
  actionKey: string;
  isEnabled?: boolean;
  actionData?: {
    subject?: string;
    body?: string;
    addSignOutUrl?: boolean;
    senderId?: number;
    sender?: { title?: string } | null;
  } | null;
}

/** Was die Erweiterung an den Einstellungen der Gruppe liest. */
interface GruppeRoh {
  name: string;
  settings?: {
    sendDefaultSignUpMail?: boolean;
    qrCodeCheckin?: boolean;
    qrCodeCheckinAutomaticEmail?: boolean;
  };
}

/** Ist der Check-in der Gruppe an? Maßgeblich dafür, ob der Code in der Bestätigung steht (A9-2b). */
const checkinAn = (g: GruppeRoh) => g.settings?.qrCodeCheckin === true;

/** Schickt ChurchTools zum Check-in-Code eine eigene Mail? Nur `false` heißt nein (Vorgabe ist `true`). */
const qrMailAn = (g: GruppeRoh) => g.settings?.qrCodeCheckinAutomaticEmail !== false;

interface RoutineRoh {
  id: number;
  name?: string;
  description?: string | null;
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
  /** Dessen Personen-Nummer (A9-2a: im Fenster „Mails“ wählbar). */
  absenderId: number | null;
  /** Der eigene Text je Mail (A9-2a) – aus der Beschreibung der Routine. */
  eigen: Record<RoutinenArt, EigenerText>;
  /** Check-in-Code in der Bestätigung (A9-2b) – `qrCodeCheckin` der Gruppe. */
  qr: boolean;
}

const mailSchritt = (r: RoutineRoh | null | undefined) =>
  r?.steps?.find((s) => s.actionKey === 'send-member-email');

/** Unsere Routine für einen Status – fremde (eigene Routinen aus ChurchTools) zählen nicht. */
function unsereFuer(zuordnungen: ZuordnungRoh[], rolle: number, status: string): RoutineRoh | null {
  const r = zuordnungen.find(
    (z) => z.groupTypeRoleId === rolle && z.groupMemberStatus === status,
  )?.routine;
  return istUnsere(r) ? r! : null;
}

/** **Wie es steht** – für die Karte „Mails“. */
export async function ablaeufeLesen(id: number): Promise<AblaufStand> {
  const [zuordnungen, g, rolle] = await Promise.all([
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
    ctDaten<GruppeRoh>(`/groups/${id}`),
    teilnehmerRolle(id),
  ]);
  const an = (status: string) => {
    const r = unsereFuer(zuordnungen, rolle, status);
    return r?.isEnabled === true ? r : null;
  };
  const platz = an('active');
  const mail = mailSchritt(platz);
  return {
    platz: !!platz,
    warte: !!an('waiting'),
    standardMail: g.settings?.sendDefaultSignUpMail !== false,
    absender: mail?.actionData?.sender?.title ?? null,
    absenderId: mail?.actionData?.senderId ?? null,
    eigen: {
      platz: eigenerTextAus(unsereFuer(zuordnungen, rolle, 'active')?.description),
      warte: eigenerTextAus(unsereFuer(zuordnungen, rolle, 'waiting')?.description),
    },
    qr: checkinAn(g),
  };
}

/**
 * **Den eigenen Text der Vorlage** (A9-2a) – bei einer Kopie („Wie eine frühere Veranstaltung“) aus den Routinen der
 * Veranstaltung, von der sie stammt. Nur ein Angebot: Ist die Vorlage weg oder nicht lesbar, gilt der Standard.
 */
async function textVonVorlage(
  vorlageId: number | undefined,
): Promise<Record<RoutinenArt, EigenerText>> {
  const ohne = { platz: OHNE_EIGENEN_TEXT, warte: OHNE_EIGENEN_TEXT };
  if (!vorlageId) return ohne;
  try {
    const [zuordnungen, rolle] = await Promise.all([
      ctDaten<ZuordnungRoh[]>(`/groups/${vorlageId}/members/routines`),
      teilnehmerRolle(vorlageId),
    ]);
    return {
      platz: eigenerTextAus(unsereFuer(zuordnungen, rolle, 'active')?.description),
      warte: eigenerTextAus(unsereFuer(zuordnungen, rolle, 'waiting')?.description),
    };
  } catch (x) {
    console.warn('Mailtext der Vorlage nicht gelesen', vorlageId, x);
    return ohne;
  }
}

/**
 * **Abläufe einrichten oder neu schreiben** – beim Freigeben (A9-1), beim Speichern im Fenster „Mails“ und beim
 * Abgleich (A9-2a). Reihenfolge mit Absicht: erst die Routinen, dann die Standard-Mail aus. Scheitert etwas dazwischen,
 * bekommen Angemeldete höchstens zwei Mails, nie keine. `absenderId`: Person, die als Absender erscheint (Antworten
 * gehen an sie). `eigen`: neuer eigener Text je Mail – ohne bleibt der, der in ChurchTools steht (bei einer neuen
 * Routine: der der Vorlage, `kopieVon`). `qr` (A9-2b): Check-in-Code an oder aus – ohne bleibt, was in ChurchTools
 * eingestellt ist (eine Kopie übernimmt ihn von der Vorlage).
 */
export async function ablaeufeEinrichten(
  id: number,
  absenderId: number,
  eigen?: Partial<Record<RoutinenArt, EigenerText>>,
  qr?: boolean,
): Promise<void> {
  for (const t of Object.values(eigen ?? {})) {
    const fehler = eigenerTextFehler(t);
    if (fehler) throw new ApiError(422, fehler);
  }
  // Das Feld „Link zur Anmeldung“ muss es geben, bevor eine Mail es als Platzhalter nennt.
  const e = await systemfelderNachziehen(id);
  const [g, platzhalter, rolle, zuordnungen] = await Promise.all([
    ctDaten<GruppeRoh>(`/groups/${id}`),
    platzhalterLaden(id),
    teilnehmerRolle(id),
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
  ]);
  // Je Mail der Text, der gelten soll – und ob er in die Beschreibung geschrieben werden muss.
  const vorlage = await textVonVorlage(e.kopieVon);
  const texte = {} as Record<RoutinenArt, EigenerText>;
  const schreiben = {} as Record<RoutinenArt, boolean>;
  for (const r of ROUTINEN) {
    const da = unsereFuer(zuordnungen, rolle, r.status);
    const neu = eigen?.[r.art];
    texte[r.art] = neu ?? (da ? eigenerTextAus(da.description) : vorlage[r.art]);
    schreiben[r.art] =
      neu !== undefined || (!da && eigenerTextAlsBeschreibung(vorlage[r.art]) !== null);
  }
  const mitQr = qr ?? checkinAn(g);
  const mails = ablaufMails(e, g.name, platzhalter, texte, mitQr);
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
    const beschreibung = eigenerTextAlsBeschreibung(texte[r.art]);
    await ctAnfrage(`/routines/${routineId}`, {
      method: 'PATCH',
      body: json({
        isEnabled: true,
        steps: routinenSchritte(mail, absenderId, vorhanden?.routine?.steps ?? []),
        ...(schreiben[r.art] ? { description: beschreibung } : {}),
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
      s.actionData?.senderId !== absenderId ||
      (schreiben[r.art] && (nachher.description ?? null) !== beschreibung)
    )
      throw new NichtUebernommen('den Ablauf „' + r.name + '“');
  }

  // Check-in in einem Aufruf mit der eigenen Code-Mail aus – sonst bekämen beim Einschalten alle schon Angemeldeten eine
  // Mail (gemessen 26.10.2026). Steht er schon an (auch aus ChurchTools selbst), wird nur die Code-Mail abgeschaltet.
  const check = mitQr
    ? { qrCodeCheckin: true, qrCodeCheckinAutomaticEmail: false }
    : checkinAn(g)
      ? { qrCodeCheckin: false }
      : {};
  await ctAnfrage(`/groups/${id}`, {
    method: 'PATCH',
    body: json({ sendDefaultSignUpMail: false, ...check }),
  });
  const nachher = await ctDaten<GruppeRoh>(`/groups/${id}`);
  if (nachher.settings?.sendDefaultSignUpMail !== false)
    throw new NichtUebernommen('das Abschalten der Standard-Mail von ChurchTools');
  if (checkinAn(nachher) !== mitQr || (mitQr && qrMailAn(nachher)))
    throw new NichtUebernommen('den Check-in-Code');
}

/** Absender der Bestätigungsmails: wer freigibt, wenn er zur gewählten Leitung gehört – sonst die erste gewählte. */
export function absenderAus(gewaehlt: ReadonlySet<number>, ich: number | null): number {
  if (ich !== null && gewaehlt.has(ich)) return ich;
  const erste = [...gewaehlt][0];
  if (erste === undefined)
    throw new ApiError(422, 'Bitte mindestens eine Person als Leitung wählen.');
  return erste;
}

/**
 * **Abgleich beim Öffnen einer Veranstaltung** (A9-2a): Stimmt die Mail in ChurchTools nicht mehr mit dem, was sich aus
 * den Einstellungen ergibt (Termin, Bezahlung, Kontakt, Preise oder Name geändert – auch über „Rückgängig“ oder in
 * ChurchTools selbst), wird sie neu geschrieben: mit dem Absender und dem eigenen Text, die dort stehen. Die eine Stelle
 * dafür, statt eines Aufrufs nach jedem Speichern. Nur, wo beide Abläufe eingerichtet und an sind – ältere
 * Veranstaltungen richtet erst A9-5 ein, und abgeschaltete (archiviert) bleiben aus.
 */
export async function ablaeufeAbgleichen(id: number): Promise<AblaufStand> {
  const stand = await ablaeufeLesen(id);
  if (!stand.platz || !stand.warte || stand.absenderId === null) return stand;
  const [e, g, platzhalter, rolle, zuordnungen] = await Promise.all([
    systemfelderNachziehen(id),
    ctDaten<GruppeRoh>(`/groups/${id}`),
    platzhalterLaden(id),
    teilnehmerRolle(id),
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
  ]);
  // Maßgeblich ist der Check-in der Gruppe – auch, wenn ihn jemand in ChurchTools umgeschaltet hat (A9-2b).
  const mitQr = checkinAn(g);
  const soll = ablaufMails(e, g.name, platzhalter, stand.eigen, mitQr);
  if (soll.unbekannt.length) return stand;
  const passt =
    !(mitQr && qrMailAn(g)) &&
    ROUTINEN.every((r) => {
      const s = mailSchritt(unsereFuer(zuordnungen, rolle, r.status))?.actionData;
      const m = r.art === 'platz' ? soll.platz : soll.warte;
      return s?.subject === m.betreff && s?.body === m.html;
    });
  if (passt) return stand;
  await ablaeufeEinrichten(id, stand.absenderId);
  return ablaeufeLesen(id);
}

/**
 * **Für wen die Vorschau rechnet** (A9-2a): die erste Person, die schon so angemeldet ist (mit Platz bzw. wartend) –
 * dann füllt ChurchTools Betrag, Nr. und Link wie echt. Sonst der Absender: Die Felder bleiben dann leer, und die
 * Absätze, die an ihnen hängen, fehlen in der Vorschau.
 */
export async function vorschauPerson(
  id: number,
  art: RoutinenArt,
  ersatz: number,
): Promise<{ personId: number; echt: boolean }> {
  const [mitglieder, rolle] = await Promise.all([
    ctAlleSeiten<{ personId?: number; groupTypeRoleId?: number; groupMemberStatus?: string }>(
      `/groups/${id}/members`,
    ),
    teilnehmerRolle(id),
  ]);
  const status = ROUTINEN.find((r) => r.art === art)!.status;
  const m = mitglieder.find(
    (x) =>
      typeof x.personId === 'number' &&
      x.groupTypeRoleId === rolle &&
      x.groupMemberStatus === status,
  );
  return m?.personId ? { personId: m.personId, echt: true } : { personId: ersatz, echt: false };
}
