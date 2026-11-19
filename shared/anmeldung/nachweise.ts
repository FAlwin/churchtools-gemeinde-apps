/**
 * **Nachweise** (Etappe F, N1a/N1b) – was die Erweiterung in ChurchTools für Nachweis-Arten (z. B. Führungszeugnis) anlegt:
 * die **Gruppenart „Nachweis“** und je Nachweis-Art eine **Gruppe „Nachweis: …“** mit ihren Gruppenfeldern, ihren
 * Einstellungen, den Vertrauenspersonen (Leiter) und einem **Ablauf** (Aufforderung → Einladung → Folgeaufgabe „Einsicht
 * nehmen“ → Kreislauf „Erneut einsehen“). Gemessen an der Test-Instanz am 19.11.2026: `GET /group/grouptypes/11`, Rollen
 * 53 (Teilnehmer) und 56 (Leiter) (N1a); Ablauf 113 mit den Schritten unten (N0, M4). Das Anlegen der Gruppenart macht der
 * gemeinsame Baustein `shared/ct/gruppenart.ts` (auch das Organigramm nutzt ihn).
 *
 * **Alles, was die Schnittstelle nicht selbst prüft, wird hier in EINER Funktion gebaut und getestet:** `dry_run` prüft die
 * `actionData` eines Ablauf-Schritts nicht (gemessen N0) – ein falscher Feldname fiele erst im echten Lauf auf.
 */
import { z } from 'zod';
import type { GruppenartVorgabe, SollRecht } from '../ct/gruppenart';
import { textEntpacken, textPacken } from '../ct/packen';
import { STUFE_NACHWEIS } from './felder';
import { BESCHREIBUNG_MAX } from './formular';
import { mitCtPlatzhaltern, textZuHtml } from './rundmail';
import { antragFehler, antragSchema, gleicherAntrag, type NachweisAntrag } from './nachweisAntrag';

/** Wie die Gruppenart angelegt wird. */
export const NACHWEIS_ART: GruppenartVorgabe = {
  name: 'Nachweis',
  namePlural: 'Nachweise',
  shorty: 'NW',
  color: 'gray',
  description:
    'Angelegt von der Erweiterung „Anmeldungen“: je Nachweis-Art (z. B. Führungszeugnis) eine Gruppe „Nachweis: …“.',
};

/** Ist das die Gruppenart „Nachweis“? Wie bei „Anmeldung“: ohne Leerzeichen am Rand, Groß/Klein egal. */
export const istNachweisArt = (name: unknown): boolean =>
  typeof name === 'string' &&
  name.trim().toLocaleLowerCase('de') === NACHWEIS_ART.name.toLocaleLowerCase('de');

/** Stufe 1 („Niedrig“) für „Gruppeninfos sehen“ und „Gruppenmitglieder sehen“ – wie beim Gruppenwechsel (Organigramm). */
const STUFE_SEHEN = 1;

/**
 * Die gruppeninternen Rechte der Leiter-Rolle (Alwin, 19.11.2026): die Vertrauenspersonen sehen die Gruppe und ihre
 * Mitglieder, sehen und ändern die Angaben (Stufe `STUFE_NACHWEIS`) und führen Follow-ups durch. Die Teilnehmer-Rolle
 * bekommt keins. Churchauth-Nummern: 10101 Gruppenmitglieder sehen, 10102 Gruppeninfos sehen, 10126 Gruppenmitgliedsfelder
 * sehen, 10133 Gruppenmitgliedsfelder bearbeiten, 10110 Follow-ups durchführen. Die Stufe steht in `dataId`; der PUT schickt
 * `dataId: [stufe]` (`rechteErgaenzen`).
 */
export const NACHWEIS_LEITER_RECHTE: readonly SollRecht[] = [
  { authId: 10102, name: 'Gruppeninfos sehen', dataId: STUFE_SEHEN },
  { authId: 10101, name: 'Gruppenmitglieder sehen', dataId: STUFE_SEHEN },
  { authId: 10126, name: 'Gruppenmitgliedsfelder sehen', dataId: STUFE_NACHWEIS },
  { authId: 10133, name: 'Gruppenmitgliedsfelder bearbeiten', dataId: STUFE_NACHWEIS },
  { authId: 10110, name: 'Follow-ups durchführen', dataId: null },
];

/**
 * Das eine Recht der **Teilnehmer-Rolle** (Alwin nach Messung M6, 19.11.2026): „Gruppeninfos sehen“ (10102, Stufe 1). Ohne
 * es ist „Meine Gruppen“ leer, und die Person fände ihre Bescheinigung nicht (das PDF selbst braucht kein Recht). Folge:
 * Teilnehmer sehen die Gruppe und die Namen der anderen Mitglieder – keine Angaben, keine Ergebnisse. Sonst nichts.
 */
export const NACHWEIS_TEILNEHMER_RECHTE: readonly SollRecht[] = [
  { authId: 10102, name: 'Gruppeninfos sehen', dataId: STUFE_SEHEN },
];

// ── Name der Gruppe ─────────────────────────────────────────────────────────────────────────────────────────────

/** Jede Nachweis-Art ist eine Gruppe „Nachweis: <Name>“ – daran erkennt die Seite sie auch in der Liste. */
export const NACHWEIS_PRAEFIX = 'Nachweis: ';
export const NACHWEIS_NAME_MAX = 80;

/** Der Name der Gruppe in ChurchTools. */
export const nachweisGruppenName = (name: string): string => `${NACHWEIS_PRAEFIX}${name.trim()}`;

/** Der Name der Nachweis-Art aus dem Namen der Gruppe – ohne das Präfix (egal ob groß oder klein geschrieben). */
export function nachweisNameAus(gruppenName: string): string {
  const t = gruppenName.trim();
  return t.toLocaleLowerCase('de').startsWith(NACHWEIS_PRAEFIX.toLocaleLowerCase('de'))
    ? t.slice(NACHWEIS_PRAEFIX.length).trim()
    : t;
}

/** Zwei Gruppennamen gleich? Ohne Rand-Leerzeichen, Groß/Klein egal – wie beim Namen der Gruppenart. */
export const gleicherGruppenName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de');

/** Was am Namen nicht passt – `null`, wenn er taugt. */
export function nachweisNameFehler(name: string): string | null {
  const t = name.trim();
  if (!t) return 'Bitte einen Namen eintragen (z. B. „Führungszeugnis“).';
  if (t.length > NACHWEIS_NAME_MAX)
    return `Der Name ist zu lang (höchstens ${NACHWEIS_NAME_MAX} Zeichen).`;
  return null;
}

// ── Gruppenfelder ───────────────────────────────────────────────────────────────────────────────────────────────

export const ERGEBNIS_OHNE = 'Keine Eintragung, die einer Mitarbeit entgegensteht';
export const ERGEBNIS_EINTRAG = 'Eintragung – Rücksprache mit der Leitung nötig';

/**
 * Die drei Angaben je Person (Entwurf N Version 2: nur, was § 72a Abs. 5 SGB VIII erlaubt – eingesehen am, Datum des
 * Zeugnisses, Ergebnis). Gruppenfelder der Nachweis-Gruppe, **nicht** im Anmeldeformular, Stufe `STUFE_NACHWEIS`.
 */
export const NACHWEIS_FELDER = [
  { id: 'eingesehenAm', name: 'Eingesehen am', fieldTypeCode: 'date' },
  { id: 'ausgestelltAm', name: 'Ausgestellt am', fieldTypeCode: 'date' },
  {
    id: 'ergebnis',
    name: 'Ergebnis',
    fieldTypeCode: 'radioselect',
    optionen: [ERGEBNIS_OHNE, ERGEBNIS_EINTRAG],
  },
] as const;

export type NachweisFeld = (typeof NACHWEIS_FELDER)[number];

/** Der Rumpf für `POST /groups/{id}/memberfields/group` (Form wie `systemfeldAnlage`/`feldDefinition` in `felder.ts`). */
export function nachweisFeldAnlage(f: NachweisFeld) {
  return {
    name: f.name,
    fieldTypeCode: f.fieldTypeCode,
    securityLevel: STUFE_NACHWEIS,
    useInRegistrationForm: false,
    requiredInRegistrationForm: false,
    ...('optionen' in f ? { options: f.optionen.map((name) => ({ name })) } : {}),
  };
}

// ── Einstellungen der Art (stehen unsichtbar in der Beschreibung der Gruppe) ────────────────────────────────────

export const NACHWEIS_JAHRE_MIN = 1;
export const NACHWEIS_JAHRE_MAX = 10;
export const NACHWEIS_BETREFF_MAX = 200;
export const NACHWEIS_TEXT_MAX = 2000;

/** Ab wann die Gültigkeit zählt: Datum auf dem Zeugnis oder Tag der Einsicht. */
export type NachweisAb = 'ausstellung' | 'einsicht';

export interface NachweisEinstellungen {
  /** Wie viele Jahre der Nachweis gilt – danach kommt „Erneut einsehen“. */
  gueltigJahre: number;
  ab: NachweisAb;
  /** Die Aufforderung an die Person (Mail aus dem Ablauf). */
  betreff: string;
  /** Mit `[Vorname]` als einzigem Platzhalter. */
  text: string;
  /**
   * Der Antrag als Bescheinigung (N1c, Fassung 2 des Blocks) – ohne Bilder. Fehlt er, ist es eine Art ohne Antrag oder aus
   * N1b (Fassung 1): „kein Antrag“.
   */
  antrag?: NachweisAntrag;
}

const ART_KENNUNG = 'nachweis-einstellungen';

const einstellungenSchema = z.object({
  art: z.literal(ART_KENNUNG),
  // 1: N1b (ohne Antrag), 2: N1c (mit `antrag`) – beide lesbar; geschrieben wird 1 ohne und 2 mit Antrag.
  fassung: z.union([z.literal(1), z.literal(2)]),
  gueltigJahre: z.number().int().min(NACHWEIS_JAHRE_MIN).max(NACHWEIS_JAHRE_MAX),
  ab: z.enum(['ausstellung', 'einsicht']),
  betreff: z.string().max(NACHWEIS_BETREFF_MAX),
  text: z.string().max(NACHWEIS_TEXT_MAX),
  antrag: antragSchema.optional(),
});

/** Beginn der unsichtbaren Zeile; dahinter der gepackte Code. Eigene Kennung – nie mit `[anmeldung]` verwechselbar. */
export const NACHWEIS_VERWEIS = '[nachweis]: #v1:';
const VERWEIS_ZEILE = /^\[nachweis\]: #v1:([A-Za-z0-9_-]+)[ \t]*$/m;

/** Der sichtbare Satz in „Infos“ der Gruppe, solange niemand eigenen Text schreibt. */
export const NACHWEIS_HINWEIS_SATZ =
  'Diese Nachweis-Art wird mit der Erweiterung **Anmeldungen** verwaltet. Einstellungen bitte dort ändern.';

/** Was an den Einstellungen nicht passt – `null`, wenn sie taugen. Meldet auch unbekannte Platzhalter im Text. */
export function nachweisEinstellungenFehler(e: NachweisEinstellungen): string | null {
  if (
    !Number.isInteger(e.gueltigJahre) ||
    e.gueltigJahre < NACHWEIS_JAHRE_MIN ||
    e.gueltigJahre > NACHWEIS_JAHRE_MAX
  )
    return `Die Gültigkeit muss zwischen ${NACHWEIS_JAHRE_MIN} und ${NACHWEIS_JAHRE_MAX} Jahren liegen.`;
  if (!e.betreff.trim()) return 'Bitte einen Betreff für die Aufforderung eintragen.';
  if (e.betreff.length > NACHWEIS_BETREFF_MAX)
    return `Der Betreff ist zu lang (höchstens ${NACHWEIS_BETREFF_MAX} Zeichen).`;
  if (!e.text.trim()) return 'Bitte einen Text für die Aufforderung eintragen.';
  if (e.text.length > NACHWEIS_TEXT_MAX)
    return `Der Text ist zu lang (höchstens ${NACHWEIS_TEXT_MAX} Zeichen).`;
  const { unbekannt } = mitCtPlatzhaltern(e.text, new Map());
  if (unbekannt.length)
    return `Im Text steht ${unbekannt.map((u) => `[${u}]`).join(', ')} – nur [Vorname] kennt die Mail. Eckige Klammern sonst bitte weglassen.`;
  return e.antrag ? antragFehler(e.antrag) : null;
}

/** Die Einstellungen als gepackter Code (deflate, Base64url). Wirft bei ungültigen Einstellungen. */
export function nachweisEinstellungenPacken(e: NachweisEinstellungen): string {
  return textPacken(
    JSON.stringify(
      einstellungenSchema.parse({ art: ART_KENNUNG, fassung: e.antrag ? 2 : 1, ...e }),
    ),
  );
}

/**
 * **Die Beschreibung der Gruppe**: sichtbarer Text (Standard: `NACHWEIS_HINWEIS_SATZ`), darunter unsichtbar der gepackte
 * Code – eine Markdown-Link-Definition, die ChurchTools nicht anzeigt (wie bei den Anmeldungen, `einstellungenAlsText`).
 * Wirft, wenn sie die Höchstlänge sprengt oder die Einstellungen ungültig sind.
 */
export function nachweisNotiz(
  e: NachweisEinstellungen,
  sichtbar: string = NACHWEIS_HINWEIS_SATZ,
): string {
  const text = `${sichtbar.trim()}\n\n${NACHWEIS_VERWEIS}${nachweisEinstellungenPacken(e)}`;
  if (text.length > BESCHREIBUNG_MAX)
    throw new Error(
      `Die Beschreibung wäre ${text.length} Zeichen lang, erlaubt sind ${BESCHREIBUNG_MAX}.`,
    );
  return text;
}

/**
 * Die Einstellungen aus der Beschreibung – **`null`, wenn keine oder keine gültigen darin stehen** (anderes oder älteres
 * Format, kaputter Code, fremde Gruppe): nie eine Ausnahme. Eine Gruppe ohne gültigen Block ist keine fertige Nachweis-Art.
 */
export function nachweisEinstellungenLesen(
  beschreibung: string | null | undefined,
): NachweisEinstellungen | null {
  const m = beschreibung ? VERWEIS_ZEILE.exec(beschreibung) : null;
  if (!m) return null;
  try {
    const r = einstellungenSchema.safeParse(JSON.parse(textEntpacken(m[1])));
    if (!r.success) return null;
    const { gueltigJahre, ab, betreff, text, antrag } = r.data;
    return { gueltigJahre, ab, betreff, text, ...(antrag ? { antrag } : {}) };
  } catch {
    return null;
  }
}

/** Was in „Infos“ sichtbar bleibt: die Beschreibung ohne unsere Zeile; hat jemand eigenen Text geschrieben, bleibt er. */
export function nachweisSichtbarerText(beschreibung: string | null | undefined): string {
  const ohne = (beschreibung ?? '').replace(VERWEIS_ZEILE, '').trim();
  return ohne || NACHWEIS_HINWEIS_SATZ;
}

/** Gleiche Einstellungen? (Zum Vergleichen nach dem Nachlesen.) */
export const gleicheNachweisEinstellungen = (a: NachweisEinstellungen, b: NachweisEinstellungen) =>
  a.gueltigJahre === b.gueltigJahre &&
  a.ab === b.ab &&
  a.betreff === b.betreff &&
  a.text === b.text &&
  gleicherAntrag(a.antrag, b.antrag);

/** Text der Gültigkeit für die Liste: „3 Jahre ab Ausstellung“. */
export function nachweisGueltigText(e: Pick<NachweisEinstellungen, 'gueltigJahre' | 'ab'>): string {
  return `${e.gueltigJahre} ${e.gueltigJahre === 1 ? 'Jahr' : 'Jahre'} ab ${e.ab === 'ausstellung' ? 'Ausstellung' : 'Einsicht'}`;
}

// ── Der Ablauf der Gruppe ───────────────────────────────────────────────────────────────────────────────────────

/** So heißt der Ablauf in ChurchTools – daran erkennt die Erweiterung ihren eigenen (und lässt fremde stehen). */
export const NACHWEIS_ABLAUF_NAME = 'Nachweise: Aufforderung und Einsicht';

/** Wie lange die erste Folgeaufgabe offen bleibt, bevor sie fällig ist (gemessen N0: 14 Tage). */
const EINSICHT_TAGE = 14;

/** Ein Schritt, wie ChurchTools ihn liefert – soweit `nachweisSchritte` ihn braucht (auch verschachtelt unter `children`). */
export interface NachweisSchrittRoh {
  id?: number;
  specId?: number;
  actionKey: string;
  isEnabled?: boolean;
  actionData?: Readonly<Record<string, unknown>> | null;
  children?: readonly NachweisSchrittRoh[] | null;
}

/** Ein Schritt für `PATCH /routines/{id}`. */
export interface NachweisSchritt {
  id?: number;
  specId?: number;
  actionKey: string;
  isEnabled: true;
  actionData: Record<string, unknown> | null;
  children?: NachweisSchritt[];
}

/** Die Aufforderung als Mail: Betreff reiner Text, Text als HTML mit `[Vorname]` → `{{person.firstName}}`. */
export function nachweisMail(e: Pick<NachweisEinstellungen, 'betreff' | 'text'>): {
  betreff: string;
  html: string;
  unbekannt: string[];
} {
  const r = mitCtPlatzhaltern(textZuHtml(e.text), new Map());
  return {
    // `{{` im Betreff läse ChurchTools als Platzhalter.
    betreff: e.betreff.trim().replace(/\{\{/g, '{ {').slice(0, NACHWEIS_BETREFF_MAX),
    html: r.text,
    unbekannt: r.unbekannt,
  };
}

const ABLAUF_FORM = ['send-member-email', 'invite-member', 'create-follow-up', 'special:repeat'];
const WIEDERHOLEN_FORM = ['create-follow-up', 'special:wait'];
const schluessel = (l: readonly { actionKey: string }[]) => l.map((s) => s.actionKey);

/**
 * Hat der Ablauf in ChurchTools die Form, die `nachweisSchritte` baut (Mail, Einladung, Folgeaufgabe, Wiederholen mit
 * Folgeaufgabe und Warten)? Nur dann dürfen die Nummern der Schritte mitgehen – sonst hat jemand den Ablauf in ChurchTools
 * umgebaut, und die Erweiterung fasst ihn nicht an (ein neu geschriebener Ablauf nähme fremde Schritte weg).
 */
export function nachweisAblaufErkannt(vorher: readonly NachweisSchrittRoh[]): boolean {
  const k = vorher[3]?.children ?? [];
  return (
    schluessel(vorher).join() === ABLAUF_FORM.join() &&
    schluessel(k).join() === WIEDERHOLEN_FORM.join()
  );
}

/**
 * **Die Schritte des Ablaufs einer Nachweis-Art** – die eine Stelle dafür (gemessen N0/M4, Ablauf 113):
 *
 * 1. `send-member-email` – die Aufforderung (Absender: eine Vertrauensperson),
 * 2. `invite-member` – Einladung zu ChurchTools (Nachweise gibt es nur mit Login),
 * 3. `create-follow-up` „Einsicht nehmen“ – der Lauf geht erst weiter, wenn sie erledigt ist (`when-completed`),
 * 4. `special:repeat` mit `children`: „Erneut einsehen“ (`when-completed`, `numYears` = Gültigkeit) und `special:wait` 1 Tag.
 *
 * `vorher`: die Schritte, die ChurchTools schon hat. Haben sie die erwartete Form (`nachweisAblaufErkannt`), gehen `id` und
 * `specId` jedes Schritts mit (beim Lesen kommt `specId` je Folgeaufgabe zurück, beim Ändern muss sie mit) – so bleiben
 * laufende Personen an ihrer Stelle; was ChurchTools sonst noch an `actionData` kennt, bleibt unter den eigenen Feldern
 * stehen. Beim Anlegen: ohne Nummern.
 */
export function nachweisSchritte(
  art: { name: string } & NachweisEinstellungen,
  absenderId: number,
  vorher: readonly NachweisSchrittRoh[] = [],
): NachweisSchritt[] {
  const alt = nachweisAblaufErkannt(vorher) ? vorher : [];
  const altKinder = alt[3]?.children ?? [];
  const mail = nachweisMail(art);
  const nummern = (a: NachweisSchrittRoh | undefined) => ({
    ...(a?.id !== undefined ? { id: a.id } : {}),
    ...(a?.specId !== undefined ? { specId: a.specId } : {}),
  });
  const folge = (
    a: NachweisSchrittRoh | undefined,
    titel: string,
    dauer: { numDays: number } | { numYears: number },
  ): NachweisSchritt => ({
    ...nummern(a),
    actionKey: 'create-follow-up',
    isEnabled: true,
    actionData: {
      ...(a?.actionData ?? {}),
      title: titel,
      description: `${art.name.trim()} einsehen`,
      color: 'yellow',
      icon: 'handshake',
      origin: 'routine',
      continuationType: 'when-completed',
      duration: dauer,
      successGroupId: null,
      successGroupMemberStatus: null,
      successGroupOfGroupTypeId: null,
      successRoleId: null,
    },
  });
  return [
    {
      ...nummern(alt[0]),
      actionKey: 'send-member-email',
      isEnabled: true,
      actionData: {
        ...(alt[0]?.actionData ?? {}),
        subject: mail.betreff,
        body: mail.html,
        senderId: absenderId,
        addSignOutUrl: false,
        attachmentIds: [],
        skipIfEmailAddressMissing: false,
        templateId: null,
      },
    },
    { ...nummern(alt[1]), actionKey: 'invite-member', isEnabled: true, actionData: null },
    folge(alt[2], 'Einsicht nehmen', { numDays: EINSICHT_TAGE }),
    {
      ...nummern(alt[3]),
      actionKey: 'special:repeat',
      isEnabled: true,
      actionData: null,
      children: [
        folge(altKinder[0], 'Erneut einsehen', { numYears: art.gueltigJahre }),
        {
          ...nummern(altKinder[1]),
          actionKey: 'special:wait',
          isEnabled: true,
          actionData: { ...(altKinder[1]?.actionData ?? {}), duration: { numDays: 1 } },
        },
      ],
    },
  ];
}

/** Die Dauer ohne leere Teile – ChurchTools kann `numDays: null` neben `numYears` mitliefern; eine 0 zählt wie „nicht da“. */
function dauer(d: unknown): unknown {
  if (!d || typeof d !== 'object') return null;
  return Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === 'number' && v > 0));
}

/**
 * Nur die Felder, die `nachweisSchritte` selbst setzt – zum Vergleichen mit dem, was ChurchTools nachgelesen zeigt. Vom
 * Mailtext zählt nur, DASS er da ist (wie bei den Mails der Anmeldungen: ChurchTools darf das HTML umformen).
 */
function projektion(schritte: readonly NachweisSchrittRoh[]): unknown[] {
  return schritte.map((s) => {
    const d = s.actionData ?? {};
    return [
      s.actionKey,
      s.isEnabled !== false,
      d.subject ?? null,
      typeof d.body === 'string' && d.body.trim() !== '' ? 'text' : null,
      d.senderId ?? null,
      d.title ?? null,
      d.description ?? null,
      d.continuationType ?? null,
      dauer(d.duration),
      projektion(s.children ?? []),
    ];
  });
}

/** Steht der Ablauf in ChurchTools so da, wie `nachweisSchritte` ihn für diese Art und diesen Absender baut? */
export function nachweisAblaufStimmt(
  nachher: readonly NachweisSchrittRoh[],
  art: { name: string } & NachweisEinstellungen,
  absenderId: number,
): boolean {
  return (
    JSON.stringify(projektion(nachher)) ===
    JSON.stringify(projektion(nachweisSchritte(art, absenderId)))
  );
}
