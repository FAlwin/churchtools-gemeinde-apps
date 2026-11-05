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
 * - A9-3a (gemessen 28.10.2026): Löschen = „warten bis“ (`untilDate`, nur `JJJJ-MM-TT`) + „entfernen“. Ein Datum heute
 *   oder früher läuft sofort durch – ChurchTools entfernt dann beim Speichern alle, die dort warten. Schon abgeschlossene
 *   Läufe erreichen neue Schritte nicht; mit ausgeschalteter Mail und `restart: ['finished']` kommen sie ohne Mail ins
 *   Warten. `reposition` auf den Warte-Schritt gilt als „schon gewartet“ und entfernt sofort – nie benutzen. Einen
 *   Schritt, an dem Läufe warten, nimmt ChurchTools nur mit `finish` (oder `reposition`) weg, sonst 422.
 * - A9-3b (gemessen 04.11.2026, Siebte Runde): Mehrere Erinnerungen = je „warten bis“ + Mail vor dem Löschen. Ist ein
 *   Tag erreicht, geht die Mail raus und der Lauf wartet auf die nächste. Eine abgeschaltete Mail wird übersprungen.
 *   `restart: [Schritt]` startet die Läufe, die dort warten, von vorn. Eine `emailId` gehört zu genau einem Schritt.
 * - A9-5 (gemessen 05.11.2026, Neunte Runde): Wer schon vor den Routinen angemeldet war, hat **keinen** Lauf – nur mit
 *   `?with_potential_domain_objects=true` steht er als `not-started` da. `restart: ['not-started']` holt ihn nach; mit
 *   ausgeschalteter Bestätigung und fälligen Erinnerungen ohne Mail bis zum nächsten Warten.
 */
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { gemeindeZeitzone, heuteImKalender } from '@shared/ct/zeit';
import { tagPunkt } from '@shared/ct/datum';
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import {
  OHNE_EIGENEN_TEXT,
  ROUTINEN,
  ablaufMails,
  eigenerTextAlsBeschreibung,
  eigenerTextAus,
  eigenerTextFehler,
  erinnerungen,
  erinnerungsTextAus,
  anmeldeschlussVorLoeschen,
  routinenSchritte,
  schrittFolge,
  type AblaufMail,
  type EigenerText,
  type Erinnerung,
  type MailArt,
  type RoutinenArt,
} from '@shared/anmeldung/ablaeufe';
import { loeschDatum } from '@shared/anmeldung/termin';
import {
  anmeldungenIn,
  leitungsKandidaten,
  meineId,
  systemfelderNachziehen,
  teilnehmerRolle,
} from './einrichten';
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
    untilDate?: string;
  } | null;
}

/** Was die Erweiterung an den Einstellungen der Gruppe liest. */
interface GruppeRoh {
  name: string;
  settings?: {
    sendDefaultSignUpMail?: boolean;
    qrCodeCheckin?: boolean;
    qrCodeCheckinAutomaticEmail?: boolean;
    signUpClosingDate?: string | null;
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
  /** Der eigene Text je Mail (A9-2a) – aus der Beschreibung der Routine; die Erinnerung aus der von „Platz“ (A9-3b). */
  eigen: Record<MailArt, EigenerText>;
  /** Check-in-Code in der Bestätigung (A9-2b) – `qrCodeCheckin` der Gruppe. */
  qr: boolean;
  /** Löschdatum, wie es in ChurchTools steht (A9-3a) – `null`: es wird nicht gelöscht. */
  loeschDatum: string | null;
  /**
   * Nur vom Abgleich (A9-3a, E3): Das Löschdatum aus den Einstellungen liegt heute oder früher und steht so noch nicht in
   * ChurchTools – geschrieben wird es erst nach der Rückfrage im Fenster „Datenschutz“.
   */
  loeschenOffen?: string;
  /** Anmeldeschluss, wie er in ChurchTools steht – das Löschen kann ihn vorziehen (`anmeldeschlussVorLoeschen`). */
  anmeldeschluss: string | null;
  /** Die Erinnerungen, wie sie in ChurchTools stehen (A9-3b) – früheste zuerst; `an`: Ihre Mail geht raus. */
  erinnerungen: { datum: string; an: boolean }[];
}

/**
 * **Das Löschdatum ist schon da** (A9-3a): Geschrieben entfernte ChurchTools sofort alle Anmeldungen – darum erst nach
 * ausdrücklicher Rückfrage (`loeschenBestaetigt`).
 */
export class LoeschdatumVorbei extends Error {
  /** `anzahl`: so viele Anmeldungen entfernte ChurchTools – gezählt, wenn abgeschaltete Abläufe wieder angehen (D5). */
  constructor(
    readonly datum: string,
    readonly anzahl?: number,
  ) {
    super(
      `Das Löschdatum (${tagPunkt(datum)}) ist schon erreicht – ChurchTools würde sofort ${anzahl === undefined ? 'alle Anmeldungen' : anzahl === 1 ? 'die eine Anmeldung' : `alle ${anzahl} Anmeldungen`} entfernen. Bitte unter „Datenschutz“ die Frist oder den Termin prüfen.`,
    );
    this.name = 'LoeschdatumVorbei';
  }
}

/** Ein Schritt nach seiner Nummer. */
const schritt = (r: RoutineRoh | null | undefined, id: number | undefined) =>
  id === undefined ? undefined : r?.steps?.find((s) => s.id === id);

/** Die Bestätigung – der erste Schritt (`schrittFolge`; mit Erinnerungen gibt es mehrere Mails). */
const mailSchritt = (r: RoutineRoh | null | undefined) =>
  schritt(r, schrittFolge(r?.steps ?? []).bestaetigung);

/** Bis wann der Lösch-Schritt einer Routine wartet – `undefined`: Sie löscht nicht. Nicht der erste Warte-Schritt: Vor
 * ihm können Erinnerungen warten (A9-3b). */
const wartetBis = (r: RoutineRoh | null | undefined) =>
  schritt(r, schrittFolge(r?.steps ?? []).loeschWarte)?.actionData?.untilDate;

/** Die Erinnerungen einer Routine, wie sie in ChurchTools stehen (A9-3b). */
function erinnerungenIn(r: RoutineRoh | null | undefined) {
  return schrittFolge(r?.steps ?? []).erinnerungen.map((x) => ({
    datum: schritt(r, x.warte)?.actionData?.untilDate ?? '',
    an: schritt(r, x.mail)?.isEnabled === true,
    mail: schritt(r, x.mail)?.actionData,
  }));
}

/** Unsere Routine für einen Status – fremde (eigene Routinen aus ChurchTools) zählen nicht. */
function unsereFuer(zuordnungen: ZuordnungRoh[], rolle: number, status: string): RoutineRoh | null {
  const r = zuordnungen.find(
    (z) => z.groupTypeRoleId === rolle && z.groupMemberStatus === status,
  )?.routine;
  return istUnsere(r) ? r! : null;
}

/** Unsere Routine für diesen Status, wenn sie an ist – sonst `null`. */
function unsereAn(zuordnungen: ZuordnungRoh[], rolle: number, status: string): RoutineRoh | null {
  const r = unsereFuer(zuordnungen, rolle, status);
  return r?.isEnabled === true ? r : null;
}

/**
 * **Fehlen die Abläufe?** (A9-5) – für den Hinweis auf der Startseite, ohne alles zu lesen. Dieselbe Regel wie die Karte
 * „Mails“ (`ablaeufeLesen`): eingerichtet heißt, „Platz“ und „Warteliste“ sind da und an.
 */
export async function ablaeufeFehlen(id: number): Promise<boolean> {
  const [zuordnungen, rolle] = await Promise.all([
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
    teilnehmerRolle(id),
  ]);
  return !unsereAn(zuordnungen, rolle, 'active') || !unsereAn(zuordnungen, rolle, 'waiting');
}

/**
 * **Mails und Löschen nachträglich einrichten** (A9-5, F1/F2) – für Veranstaltungen, die vor A9-1 freigegeben wurden
 * (oder deren Abläufe aus sind). Wie beim Freigeben, nur ohne Leitung zu wählen: Absender ist, wer einrichtet, wenn er
 * zur Leitung gehört, sonst die erste. Schon Angemeldete bekommen keine Mail (`nachstarten`); liegt das Löschdatum
 * zurück und sind noch welche da, kommt erst `LoeschdatumVorbei`.
 */
export async function ablaeufeNachholen(
  id: number,
  { loeschenBestaetigt = false } = {},
): Promise<void> {
  const [kandidaten, ich] = await Promise.all([leitungsKandidaten(id), meineId()]);
  const leitung = new Set(kandidaten.filter((k) => k.leitung).map((k) => k.personId));
  if (leitung.size === 0)
    throw new ApiError(
      422,
      'Diese Veranstaltung hat keine Leitung – die Mails brauchen sie als Absender. Bitte in ChurchTools jemanden als Leitung eintragen.',
    );
  await ablaeufeEinrichten(id, absenderAus(leitung, ich), undefined, undefined, {
    loeschenBestaetigt,
  });
}

/** **Wie es steht** – für die Karte „Mails“. */
export async function ablaeufeLesen(id: number): Promise<AblaufStand> {
  const [zuordnungen, g, rolle] = await Promise.all([
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
    ctDaten<GruppeRoh>(`/groups/${id}`),
    teilnehmerRolle(id),
  ]);
  const platz = unsereAn(zuordnungen, rolle, 'active');
  const mail = mailSchritt(platz);
  return {
    platz: !!platz,
    warte: !!unsereAn(zuordnungen, rolle, 'waiting'),
    standardMail: g.settings?.sendDefaultSignUpMail !== false,
    absender: mail?.actionData?.sender?.title ?? null,
    absenderId: mail?.actionData?.senderId ?? null,
    eigen: texteVon(zuordnungen, rolle),
    qr: checkinAn(g),
    loeschDatum: wartetBis(platz) ?? null,
    anmeldeschluss: g.settings?.signUpClosingDate ?? null,
    erinnerungen: erinnerungenIn(platz).map(({ datum, an }) => ({ datum, an })),
  };
}

/** Der eigene Text aller Mails aus den Beschreibungen der Routinen – die Erinnerung steht in der von „Platz“. */
function texteVon(zuordnungen: ZuordnungRoh[], rolle: number): Record<MailArt, EigenerText> {
  const platz = unsereFuer(zuordnungen, rolle, 'active')?.description;
  return {
    platz: eigenerTextAus(platz),
    warte: eigenerTextAus(unsereFuer(zuordnungen, rolle, 'waiting')?.description),
    erinnerung: erinnerungsTextAus(platz),
  };
}

/**
 * **Den eigenen Text der Vorlage** (A9-2a) – bei einer Kopie („Wie eine frühere Veranstaltung“) aus den Routinen der
 * Veranstaltung, von der sie stammt. Nur ein Angebot: Ist die Vorlage weg oder nicht lesbar, gilt der Standard.
 */
async function textVonVorlage(
  vorlageId: number | undefined,
): Promise<Record<MailArt, EigenerText>> {
  const ohne = {
    platz: OHNE_EIGENEN_TEXT,
    warte: OHNE_EIGENEN_TEXT,
    erinnerung: OHNE_EIGENEN_TEXT,
  };
  if (!vorlageId) return ohne;
  try {
    const [zuordnungen, rolle] = await Promise.all([
      ctDaten<ZuordnungRoh[]>(`/groups/${vorlageId}/members/routines`),
      teilnehmerRolle(vorlageId),
    ]);
    return texteVon(zuordnungen, rolle);
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
 *
 * Löschen (A9-3a): Das Datum kommt aus Termin und Frist (`loeschDatum`). Ein **neues** Datum heute oder früher wird nur
 * mit `loeschenBestaetigt` geschrieben – sonst `LoeschdatumVorbei`, bevor irgendetwas geschrieben ist. Schon Angemeldete
 * kommen ohne Mail ins Warten (`nachstarten`). Die Anmeldung schließt spätestens am Tag vor dem Löschdatum
 * (`anmeldeschlussBegrenzen`) – geschrieben vor den Routinen, damit nie ein Löschdatum bei offener Anmeldung steht.
 */
export async function ablaeufeEinrichten(
  id: number,
  absenderId: number,
  eigen?: Partial<Record<MailArt, EigenerText>>,
  qr?: boolean,
  { loeschenBestaetigt = false, heute = heuteImKalender(), zeitzone = gemeindeZeitzone() } = {},
): Promise<void> {
  // Die Erinnerung zählt mit der Bestätigung zusammen (E4) – geprüft wird darum je Beschreibung, unten.
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
  const da = texteVon(zuordnungen, rolle);
  const texte = {} as Record<MailArt, EigenerText>;
  for (const art of ['platz', 'warte', 'erinnerung'] as const) {
    const routine = unsereFuer(zuordnungen, rolle, art === 'warte' ? 'waiting' : 'active');
    texte[art] = eigen?.[art] ?? (routine ? da[art] : vorlage[art]);
  }
  const beschreibung = (art: RoutinenArt) =>
    art === 'platz'
      ? eigenerTextAlsBeschreibung(texte.platz, texte.erinnerung)
      : eigenerTextAlsBeschreibung(texte.warte);
  const schreiben = {} as Record<RoutinenArt, boolean>;
  for (const r of ROUTINEN) {
    const geaendert =
      eigen?.[r.art] !== undefined || (r.art === 'platz' && eigen?.erinnerung !== undefined);
    const neuAnzulegen = !unsereFuer(zuordnungen, rolle, r.status);
    schreiben[r.art] = geaendert || (neuAnzulegen && beschreibung(r.art) !== null);
  }
  const zuLang = eigenerTextFehler(texte.platz, texte.erinnerung);
  if (zuLang) throw new ApiError(422, zuLang);
  const mitQr = qr ?? checkinAn(g);
  const mails = ablaufMails(e, g.name, platzhalter, texte, mitQr);
  if (mails.unbekannt.length)
    throw new ApiError(
      422,
      `Für die Bestätigungsmail fehlen in ChurchTools: ${mails.unbekannt.join(', ')}.`,
    );
  const datum = loeschDatum(e);
  const liste = erinnerungen(e, heute);
  if (datum !== null && datum <= heute && !loeschenBestaetigt) {
    const unsere = ROUTINEN.map((r) => unsereFuer(zuordnungen, rolle, r.status));
    // Gefragt wird, wenn ChurchTools beim Schreiben sofort entfernte: bei einem neuen Datum (A9-3a) und, wenn es schon so
    // drinsteht, die Abläufe aber aus sind (A9-4, D5: archiviert, dann wiederhergestellt – gehen sie wieder an, entfernt
    // ChurchTools sofort alle, gemessen 24.10.2026). Beides nur, wenn noch jemand da ist: Ohne Anmeldungen geht nichts
    // verloren (echte Prüfung 04.11.2026 – vorher fragte eine frisch freigegebene, leere Veranstaltung).
    if (unsere.some((r) => wartetBis(r) !== datum || r?.isEnabled !== true)) {
      const anzahl = await anmeldungenIn(id);
      if (anzahl > 0) throw new LoeschdatumVorbei(datum, anzahl);
    }
  }
  if (datum !== null) await anmeldeschlussBegrenzen(id, g, datum, zeitzone);

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
    const vorher = vorhanden?.routine?.steps ?? [];
    const folge = schrittFolge(vorher);
    // Erinnerungen nur in „Platz“ (A9-3b) – und nur mit Löschdatum (beide brauchen den Termin).
    const er = r.art === 'platz' && datum !== null ? { mail: mails.erinnerung, liste } : null;
    const fallenWeg = folge.erinnerungen.length - (er?.liste.length ?? 0);
    if (datum !== null && er && fallenWeg > 0) {
      // Erst ohne Mail auf heute: Wer an einer wegfallenden Erinnerung wartet, läuft weiter (gemessen M5-5) – einen
      // Schritt mit Wartenden nähme ChurchTools sonst nur mit `finish` weg, und die fielen aus dem Löschen.
      const weg: Erinnerung[] = Array.from({ length: fallenWeg }, () => ({
        tage: 0,
        datum: heute,
        an: false,
      }));
      await ctAnfrage(`/routines/${routineId}`, {
        method: 'PATCH',
        body: json({
          steps: routinenSchritte(mail, absenderId, vorher, datum, true, {
            ...er,
            liste: [...er.liste, ...weg],
          }),
        }),
      });
    }
    // Ohne Löschdatum (Termin entfernt) fallen alle Warte-Schritte weg – wer dort wartet, wird beendet, nicht entfernt.
    const warteSchritte = [
      ...folge.erinnerungen.map((x) => x.warte),
      ...(folge.loeschWarte === undefined ? [] : [folge.loeschWarte]),
    ];
    const beschr = beschreibung(r.art);
    await ctAnfrage(`/routines/${routineId}`, {
      method: 'PATCH',
      body: json({
        isEnabled: true,
        steps: routinenSchritte(mail, absenderId, vorher, datum, true, er),
        ...(datum === null && warteSchritte.length ? { finish: warteSchritte } : {}),
        ...(schreiben[r.art] ? { description: beschr } : {}),
      }),
    });
    // Nachlesen: Ein 200 allein beweist nicht, dass ChurchTools die Mail auch so verschickt.
    const nachher = await ctDaten<RoutineRoh>(`/routines/${routineId}`);
    const s = mailSchritt(nachher);
    const sollEr = er?.liste ?? [];
    const istEr = erinnerungenIn(nachher);
    if (
      nachher.isEnabled !== true ||
      !s?.isEnabled ||
      s.actionData?.subject !== mail.betreff ||
      s.actionData?.addSignOutUrl !== false ||
      s.actionData?.senderId !== absenderId ||
      (schreiben[r.art] && (nachher.description ?? null) !== beschr) ||
      (wartetBis(nachher) ?? null) !== datum ||
      (datum !== null && nachher.steps?.at(-1)?.actionKey !== 'remove-member') ||
      istEr.length !== sollEr.length ||
      istEr.some(
        (x, i) =>
          x.datum !== sollEr[i].datum ||
          x.an !== sollEr[i].an ||
          x.mail?.subject !== er?.mail.betreff ||
          x.mail?.senderId !== absenderId,
      )
    )
      throw new NichtUebernommen('den Ablauf „' + r.name + '“');
    if (datum !== null)
      await nachstarten(routineId, mail, absenderId, nachher.steps ?? [], datum, er, heute);
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

/**
 * **Anmeldeschluss vor das Löschdatum** (A9-3a, Fund der echten Prüfung 28.10.2026): Steht die Anmeldung am Löschdatum
 * noch offen, bekommt eine neue Anmeldung „Du bist dabei!“ und ist im selben Augenblick entfernt (gemessen). Kein oder
 * ein späterer Anmeldeschluss wird darum auf den Tag davor gezogen; ein früherer bleibt. ChurchTools nimmt auch einen
 * Schluss vor dem Beginn an (gemessen) – dann ist die Anmeldung eben zu.
 */
async function anmeldeschlussBegrenzen(
  id: number,
  g: GruppeRoh,
  datum: string,
  zeitzone: string,
): Promise<void> {
  const schluss = anmeldeschlussVorLoeschen(g.settings?.signUpClosingDate, datum, zeitzone);
  if (schluss === null) return;
  await ctAnfrage(`/groups/${id}`, {
    method: 'PATCH',
    body: json({ signUpClosingDate: schluss }),
  });
  const nachher = await ctDaten<GruppeRoh>(`/groups/${id}`);
  if (anmeldeschlussVorLoeschen(nachher.settings?.signUpClosingDate, datum, zeitzone) !== null)
    throw new NichtUebernommen('den Anmeldeschluss vor dem Löschdatum');
}

/**
 * **Schon Angemeldete an die richtige Stelle bringen** (A9-3a E6, A9-3b E7): Richtig wartet ein Lauf am ersten
 * Warte-Schritt, dessen Tag noch kommt – an der nächsten Erinnerung oder am Löschen. Wer sich vor dem Löschen angemeldet
 * hat, dessen Lauf ist abgeschlossen; wer wartet, als eine frühere Erinnerung dazukam, wartet zu weit hinten; wer schon
 * vor den Routinen angemeldet war (ältere Veranstaltung, A9-5), hat gar keinen (`not-started`) – neue Schritte erreichen
 * sie alle nicht. Gemessener Weg (28.10., 04.11. und 05.11.2026): Bestätigung aus → `restart` (`'finished'`,
 * `'not-started'` bzw. die Nummer des Warte-Schritts) → wieder an; die Läufe gehen ohne Mail bis zum richtigen Warten. Dabei sind auch die
 * Erinnerungen aus, deren Tag schon da ist – sonst bekämen alle sie beim Neustart. Nur, wenn es solche Läufe gibt –
 * solange die Bestätigung aus ist, bekäme eine neue Anmeldung keine. Sie wird darum auch nach einem Fehler wieder
 * eingeschaltet.
 */
async function nachstarten(
  routineId: number,
  mail: AblaufMail,
  absenderId: number,
  schritte: { id: number; actionKey: string }[],
  datum: string,
  erinnerung: { mail: AblaufMail; liste: readonly Erinnerung[] } | null,
  heute: string,
): Promise<void> {
  // Ohne den Zusatz fehlen die noch nie Gestarteten (A9-5, gemessen 05.11.2026).
  const laeufe = await ctAlleSeiten<{ status?: string; routineStepId?: number | null }>(
    `/routines/${routineId}/runs?with_potential_domain_objects=true`,
  );
  const folge = schrittFolge(schritte);
  const liste = erinnerung?.liste ?? [];
  const warten = [
    ...folge.erinnerungen.map((x, i) => ({ id: x.warte, bis: liste[i]?.datum ?? '' })),
    { id: folge.loeschWarte, bis: datum },
  ];
  const ziel = warten.find((w) => w.bis > heute)?.id;
  const fertig = laeufe.some((l) => l.status === 'finished');
  // A9-5: vor den Routinen angemeldet (ältere Veranstaltung) – sonst nähmen sie weder Erinnerung noch Löschen mit.
  const nieGestartet = laeufe.some((l) => l.status === 'not-started');
  const falsch =
    ziel === undefined
      ? []
      : [
          ...new Set(
            laeufe
              .filter(
                (l) =>
                  l.status === 'waiting' &&
                  l.routineStepId !== ziel &&
                  warten.some((w) => w.id === l.routineStepId),
              )
              .map((l) => l.routineStepId!),
          ),
        ];
  if (!fertig && !nieGestartet && !falsch.length) return;
  const mitMail = (an: boolean) =>
    ctAnfrage(`/routines/${routineId}`, {
      method: 'PATCH',
      body: json({
        steps: routinenSchritte(
          mail,
          absenderId,
          schritte,
          datum,
          an,
          erinnerung && {
            ...erinnerung,
            liste: an ? liste : liste.map((x) => ({ ...x, an: x.an && x.datum > heute })),
          },
        ),
      }),
    });
  await mitMail(false);
  try {
    if (fertig)
      await ctAnfrage(`/routines/${routineId}`, {
        method: 'PATCH',
        body: json({ restart: ['finished'] }),
      });
    if (nieGestartet)
      await ctAnfrage(`/routines/${routineId}`, {
        method: 'PATCH',
        body: json({ restart: ['not-started'] }),
      });
    if (falsch.length)
      await ctAnfrage(`/routines/${routineId}`, {
        method: 'PATCH',
        body: json({ restart: falsch }),
      });
  } finally {
    await mitMail(true);
  }
  const nachher = await ctDaten<RoutineRoh>(`/routines/${routineId}`);
  if (!mailSchritt(nachher)?.isEnabled)
    throw new NichtUebernommen('das Wiedereinschalten der Mail');
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
 * Veranstaltungen richtet erst „Jetzt einrichten“ ein (A9-5, `ablaeufeNachholen`), nie still beim Öffnen, und
 * abgeschaltete (archiviert) bleiben aus.
 */
export async function ablaeufeAbgleichen(
  id: number,
  heute = heuteImKalender(),
  zeitzone = gemeindeZeitzone(),
): Promise<AblaufStand> {
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
  const datum = loeschDatum(e);
  // A9-3b: Termin oder Tage geändert, oder ein Tag erreicht (R7: ältere vorbeie aus) → die Erinnerungen ziehen mit.
  const sollEr = datum === null ? [] : erinnerungen(e, heute);
  const istEr = erinnerungenIn(unsereFuer(zuordnungen, rolle, 'active'));
  const passt =
    istEr.length === sollEr.length &&
    istEr.every(
      (x, i) =>
        x.datum === sollEr[i].datum &&
        x.an === sollEr[i].an &&
        x.mail?.subject === soll.erinnerung.betreff &&
        x.mail?.body === soll.erinnerung.html,
    ) &&
    !(mitQr && qrMailAn(g)) &&
    ROUTINEN.every((r) => {
      const s = mailSchritt(unsereFuer(zuordnungen, rolle, r.status))?.actionData;
      const m = r.art === 'platz' ? soll.platz : soll.warte;
      return s?.subject === m.betreff && s?.body === m.html;
    }) &&
    // A9-3a: Termin oder Frist geändert → das Löschdatum zieht mit.
    ROUTINEN.every(
      (r) => (wartetBis(unsereFuer(zuordnungen, rolle, r.status)) ?? null) === datum,
    ) &&
    // … und die Anmeldung schließt vorher – auch, wenn jemand den Anmeldeschluss später wieder geöffnet hat.
    (datum === null ||
      anmeldeschlussVorLoeschen(g.settings?.signUpClosingDate, datum, zeitzone) === null);
  if (passt) return stand;
  // E3 (Alwin, 28.10.2026): Ein neues Löschdatum heute oder früher schreibt der Abgleich nie still – ChurchTools entfernte
  // sonst beim bloßen Öffnen alle Anmeldungen. Die Karte „Datenschutz“ zeigt es, gelöscht wird nach der Rückfrage.
  try {
    await ablaeufeEinrichten(id, stand.absenderId, undefined, undefined, { heute, zeitzone });
  } catch (x) {
    if (x instanceof LoeschdatumVorbei) return { ...stand, loeschenOffen: x.datum };
    throw x;
  }
  return ablaeufeLesen(id);
}

/**
 * **Abläufe wieder einschalten** (A9-4) – nach „Rückgängig“ beim Archivieren: ChurchTools schaltet unsere Routinen beim
 * Archivieren ab und beim Zurückholen nicht wieder an (gemessen 24.10.2026). Ohne das blieben Mails und Löschen still
 * aus, und der Abgleich ließe die Veranstaltung liegen (er gleicht nur ab, wo beide an sind). Wartende Läufe sind danach
 * wieder da. Nachgelesen.
 */
export async function ablaeufeWiederAn(id: number): Promise<void> {
  const [zuordnungen, rolle] = await Promise.all([
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
    teilnehmerRolle(id),
  ]);
  const aus = ROUTINEN.map((r) => unsereFuer(zuordnungen, rolle, r.status)).filter(
    (r): r is RoutineRoh => !!r && r.isEnabled !== true,
  );
  for (const r of aus)
    await ctAnfrage(`/routines/${r.id}`, { method: 'PATCH', body: json({ isEnabled: true }) });
  for (const r of aus)
    if ((await ctDaten<RoutineRoh>(`/routines/${r.id}`)).isEnabled !== true)
      throw new NichtUebernommen('das Wiedereinschalten der Abläufe');
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
