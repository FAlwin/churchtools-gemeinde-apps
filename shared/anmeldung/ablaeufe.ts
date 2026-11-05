/**
 * **Abläufe in ChurchTools** (A9, Entwurf `a9-ablaeufe-v1`, Messung `messung-a9-2026-10-24`) – die Mails, die ChurchTools
 * von selbst verschickt. Die eine Stelle, die aus den Einstellungen einer Veranstaltung die Routinen baut; die
 * Erweiterung schreibt sie nur (`anmeldungen/src/ablaeufe.ts`).
 *
 * Gemessen 24.10.2026:
 * - Eine Routine gilt für Gruppe + Rolle + Status und startet, sobald jemand dort ankommt – über das Formular, durchs
 *   Team, beim Nachrücken. Darum zwei Routinen: **Platz** (aktiv) und **Warteliste** (wartend).
 * - Die Routine-Mail füllt Gruppenfelder als Platzhalter und kennt `{{#if …}}…{{else}}…{{/if}}`. Einen Platzhalter für
 *   den Abmelde-Schlüssel gibt es nicht – den Link zu „Deine Anmeldung“ schreibt das Formular ins Feld „Link zur
 *   Anmeldung“ (`abmeldeLink`).
 * - Jede Person ist eine eigene Anmeldung (A6) und bekommt ihre eigene Mail. Betrag und Aufschlüsselung stehen nur bei
 *   der ersten Person – die Bankdaten darum nur, wenn das Feld „Betrag“ gefüllt ist.
 *
 * Text wird lesbar mit `[Platzhalter]` geschrieben wie bei der Rundmail (`mitCtPlatzhaltern`); was aus den Einstellungen
 * kommt (Name, Termin, Bankdaten, Kontakt) und was Veranstalter selbst schreiben (`EigenerText`, A9-2a), wird erst
 * danach eingesetzt – eckige Klammern darin bleiben so Text.
 */
import { z } from 'zod';
import { bankZeilen } from './bezahlung';
import { grussZeilen } from './bewegung';
import { SYSTEMFELDER, type OeffentlicheEinstellungen } from './formular';
import { kannEtwasKosten } from './preis';
import { htmlSicher, mitCtPlatzhaltern } from './rundmail';
import { terminZeile } from './termin';
import { plusTage } from '../ct/datum';
import { utcAus } from '../ct/zeit';

/** Name eines Systemfelds – so heißt es auch als Platzhalter bei ChurchTools (`/placeholders/group/{id}`). */
const feld = (id: (typeof SYSTEMFELDER)[number]['id']) =>
  SYSTEMFELDER.find((f) => f.id === id)!.name;

/** Die beiden Routinen einer Veranstaltung: für wen sie gelten und wie sie in ChurchTools heißen. */
export const ROUTINEN = [
  { art: 'platz', status: 'active', name: 'Anmeldungen: Platz' },
  { art: 'warte', status: 'waiting', name: 'Anmeldungen: Warteliste' },
] as const;

export type RoutinenArt = (typeof ROUTINEN)[number]['art'];

/** Jede Mail mit eigenem Text: die beiden Routinen und die Erinnerung (A9-3b – sie steckt in der Routine „Platz“). */
export type MailArt = RoutinenArt | 'erinnerung';

export interface AblaufMail {
  betreff: string;
  html: string;
}

/**
 * Bezeichnung des Check-in-Codes in `/placeholders/group/{id}` (A9-2b, gemessen 26.10.2026): `{{{groupMember.checkInCodeQr}}}`
 * wird zum QR-Bild, solange die Person einen Code hat – den legt ChurchTools beim Einschalten von `qrCodeCheckin` an.
 */
export const QR_CODE = 'Check-in-Code (QR-Code)';

/** Höchstlänge des Betreffs einer Routine-Mail (Schnittstelle: 200). */
export const BETREFF_MAX = 200;

/**
 * **Was Veranstalter an einer Mail selbst schreiben** (A9-2a, Alwin 26.10.2026: fester Rahmen + eigener Absatz). Leer
 * heißt: der Standard (`standardBetreff`, kein eigener Absatz, „Viele Grüße“). Steht als JSON in der **Beschreibung der
 * Routine** – nicht öffentlich, höchstens 1.000 Zeichen, Leerzeichen am Ende schneidet ChurchTools ab (gemessen
 * 26.10.2026); beim Neuschreiben der Schritte bleibt sie stehen. Der Text der Erinnerung (A9-3b, E4) steht mit in der
 * Beschreibung der Routine „Platz“ – beide teilen sich die 1.000 Zeichen.
 */
export interface EigenerText {
  betreff: string;
  absatz: string;
  gruss: string;
}

export const OHNE_EIGENEN_TEXT: EigenerText = { betreff: '', absatz: '', gruss: '' };

/** Höchstlänge der Beschreibung einer Routine (Schnittstelle, gemessen: 1.001 → 400). */
export const BESCHREIBUNG_MAX = 1000;

const TextSchema = z.object({
  betreff: z.string().default(''),
  absatz: z.string().default(''),
  gruss: z.string().default(''),
});
const EigenSchema = TextSchema.extend({ v: z.literal(1), erinnerung: TextSchema.optional() });

/** Die Beschreibung gelesen – `null`, wenn sie nicht von uns stammt. */
function beschreibungLesen(beschreibung: string | null | undefined) {
  if (!beschreibung) return null;
  try {
    const r = EigenSchema.safeParse(JSON.parse(beschreibung));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

const nurText = (t: z.infer<typeof TextSchema>): EigenerText => ({
  betreff: t.betreff,
  absatz: t.absatz,
  gruss: t.gruss,
});

/** Der eigene Text aus der Beschreibung einer Routine. Was nicht von uns stammt (oder leer ist), gilt als „kein eigener“. */
export function eigenerTextAus(beschreibung: string | null | undefined): EigenerText {
  const b = beschreibungLesen(beschreibung);
  return b ? nurText(b) : OHNE_EIGENEN_TEXT;
}

/** Der eigene Text der Erinnerung (A9-3b) – aus der Beschreibung der Routine „Platz“. */
export function erinnerungsTextAus(beschreibung: string | null | undefined): EigenerText {
  const e = beschreibungLesen(beschreibung)?.erinnerung;
  return e ? nurText(e) : OHNE_EIGENEN_TEXT;
}

const getrimmt = (t: EigenerText): EigenerText => ({
  betreff: t.betreff.trim(),
  absatz: t.absatz.trim(),
  gruss: t.gruss.trim(),
});
const leer = (t: EigenerText) => !t.betreff && !t.absatz && !t.gruss;

/**
 * Der eigene Text als Beschreibung der Routine – `null`, wenn nichts Eigenes da ist. `erinnerung` nur bei der Routine
 * „Platz“ (A9-3b): Sie steht mit in derselben Beschreibung.
 */
export function eigenerTextAlsBeschreibung(
  t: EigenerText,
  erinnerung: EigenerText = OHNE_EIGENEN_TEXT,
): string | null {
  const x = getrimmt(t);
  const er = getrimmt(erinnerung);
  if (leer(x) && leer(er)) return null;
  return JSON.stringify({ v: 1, ...x, ...(leer(er) ? {} : { erinnerung: er }) });
}

/**
 * Was am eigenen Text nicht passt – `null`, wenn alles passt. Gezählt wird, was ChurchTools speichern muss – bei der
 * Routine „Platz“ Bestätigung und Erinnerung zusammen (E4).
 */
export function eigenerTextFehler(
  t: EigenerText,
  erinnerung: EigenerText = OHNE_EIGENEN_TEXT,
): string | null {
  if (t.betreff.trim().length > BETREFF_MAX || erinnerung.betreff.trim().length > BETREFF_MAX)
    return `Der Betreff hat höchstens ${BETREFF_MAX} Zeichen.`;
  const laenge = eigenerTextAlsBeschreibung(t, erinnerung)?.length ?? 0;
  if (laenge > BESCHREIBUNG_MAX)
    return `Eigener Absatz und Gruß sind zusammen zu lang (${laenge - BESCHREIBUNG_MAX} Zeichen zu viel).`;
  return null;
}

/** Der Betreff, wenn Veranstalter keinen eigenen schreiben. */
export function standardBetreff(art: MailArt, veranstaltung: string): string {
  const text =
    art === 'erinnerung'
      ? `Bald ist es so weit: ${veranstaltung}`
      : `${veranstaltung}: ${art === 'platz' ? 'Anmeldung bestätigt' : 'Warteliste'}`;
  return text.slice(0, BETREFF_MAX);
}

/** Höchstens so viele Erinnerungen je Veranstaltung (A9-3b, R2). */
export const ERINNERUNGEN_MAX = 3;
/** Die Vorschläge zum Antippen und der beim Einschalten gewählte (R3). */
export const ERINNERUNG_VORSCHLAEGE = [1, 3, 7, 14] as const;
export const ERINNERUNG_VORGABE = 3;
/** Grenzen für „X Tage vorher“ (R3) – dieselben wie im Schema der Einstellungen. */
export const ERINNERUNG_TAGE_MIN = 1;
export const ERINNERUNG_TAGE_MAX = 30;

/**
 * **Was an den gewählten Tagen nicht passt** (Fenster „Mails“) – `null`, wenn alles passt. `null` in der Liste: Feld
 * leer. Dieselben Grenzen wie im Schema der Einstellungen.
 */
export function erinnerungTageFehler(tage: readonly (number | null)[]): string | null {
  if (tage.length > ERINNERUNGEN_MAX) return `Höchstens ${ERINNERUNGEN_MAX} Erinnerungen.`;
  for (const [i, n] of tage.entries()) {
    if (n === null || !Number.isInteger(n) || n < ERINNERUNG_TAGE_MIN || n > ERINNERUNG_TAGE_MAX)
      return `${i + 1}. Erinnerung: bitte ${ERINNERUNG_TAGE_MIN} bis ${ERINNERUNG_TAGE_MAX} Tage.`;
    if (tage.indexOf(n) !== i) return `${i + 1}. Erinnerung: Diese gibt es schon.`;
  }
  return null;
}

/** Eine Erinnerung mit ihrem Tag. `an`: Ihre Mail geht raus (R7). */
export interface Erinnerung {
  tage: number;
  /** `JJJJ-MM-TT` – so nimmt ChurchTools es im Warte-Schritt. */
  datum: string;
  an: boolean;
}

/**
 * **Die Erinnerungen einer Veranstaltung** (A9-3b) – früheste zuerst, so wie sie in der Routine stehen. Tag = Beginn
 * des Termins minus die Tage; ohne Termin keine. **R7:** Ein Tag heute oder früher ist vorbei – ChurchTools ließe die
 * Wartenden sofort durch und schickte die Mail an jede späte Anmeldung (gemessen M5-3). Von den vorbeien bleibt darum
 * nur die zuletzt fällige an (Spätangemeldete bekommen sie mit der Bestätigung, wie E1); ältere sind aus – eine
 * abgeschaltete Mail überspringt ChurchTools (M5-4).
 */
export function erinnerungen(
  e: Pick<OeffentlicheEinstellungen, 'termin' | 'erinnerungTage'>,
  heute: string,
): Erinnerung[] {
  if (!e.termin) return [];
  const beginn = e.termin.beginn.slice(0, 10);
  const liste = [...new Set(e.erinnerungTage ?? [])]
    .filter((n) => Number.isInteger(n) && n >= ERINNERUNG_TAGE_MIN && n <= ERINNERUNG_TAGE_MAX)
    .sort((a, b) => b - a)
    .slice(0, ERINNERUNGEN_MAX)
    .map((tage) => ({ tage, datum: plusTage(beginn, -tage) }));
  const zuletztFaellig = liste.filter((x) => x.datum <= heute).at(-1);
  return liste.map((x) => ({ ...x, an: x.datum > heute || x === zuletztFaellig }));
}

/** Was aus den Einstellungen kommt: HTML-sicher und ohne `{{`, damit ChurchTools nichts davon als Platzhalter liest. */
function wert(text: string): string {
  return htmlSicher(text).replace(/\{/g, '&#123;').split('\n').join('<br>');
}

/**
 * **Die Mails einer Veranstaltung** – Bestätigung (Platz) und Warteliste, als HTML mit den Platzhaltern von ChurchTools.
 * `ctPlatzhalter`: Bezeichnung → Platzhalter aus `/placeholders/group/{id}`. Fehlt dort ein Feld, steht es in
 * `unbekannt` – dann darf nichts geschrieben werden (die Mail zeigte sonst „[Betrag]“). `qr` (A9-2b): Check-in-Code in
 * der Bestätigung – maßgeblich ist `qrCodeCheckin` der Gruppe.
 */
export function ablaufMails(
  e: OeffentlicheEinstellungen,
  veranstaltung: string,
  ctPlatzhalter: ReadonlyMap<string, string>,
  eigen: Readonly<Record<RoutinenArt, EigenerText>> & { readonly erinnerung?: EigenerText } = {
    platz: OHNE_EIGENEN_TEXT,
    warte: OHNE_EIGENEN_TEXT,
  },
  qr = false,
): { platz: AblaufMail; warte: AblaufMail; erinnerung: AblaufMail; unbekannt: string[] } {
  const unbekannt = new Set<string>();
  /** Lesbaren Text mit `[…]` umwandeln; `§name§` wird danach durch `werte[name]` ersetzt. */
  const html = (vorlage: string, werte: Record<string, string> = {}): string => {
    const r = mitCtPlatzhaltern(vorlage, ctPlatzhalter);
    r.unbekannt.forEach((u) => unbekannt.add(u));
    return r.text.replace(/§(\w+)§/g, (ganz, n: string) => (n in werte ? wert(werte[n]) : ganz));
  };
  /** Ein Feld als Bedingung für `{{#if}}` – der Platzhalter ohne Klammern (`groupMemberField.betrag`). */
  const wenn = (name: string, dann: string, sonst = ''): string => {
    const ct = ctPlatzhalter.get(name);
    if (!ct) {
      unbekannt.add(name);
      return '';
    }
    const v = ct.replace(/^\{+|\}+$/g, '');
    return `{{#if ${v}}}${dann}${sonst ? `{{else}}${sonst}` : ''}{{/if}}`;
  };

  const v = { v: veranstaltung, termin: terminZeile(e) };
  const hallo = wenn(feld('kontakt'), html(`<p>Hallo [${feld('kontakt')}],</p>`), '<p>Hallo,</p>');
  const nr = wenn(feld('nr'), html(`<br>Anmelde-Nr.: [${feld('nr')}]`));
  const link = (was: string) =>
    wenn(
      feld('link'),
      html(
        `<p>Deine Anmeldung ansehen oder ${was}:<br><a href="[${feld('link')}]">[${feld('link')}]</a></p>`,
      ),
    );
  /** Der eigene Absatz – Leerzeilen trennen Absätze, wie beim Schreiben einer Mail. */
  const absatz = (t: EigenerText) =>
    t.absatz
      .replace(/\r\n?/g, '\n')
      .trim()
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((a) => `<p>${wert(a.trim())}</p>`)
      .join('');
  /** „Bei Fragen …“ und der Gruß wie in den übrigen Mails (`grussZeilen`) – nur der Gruß selbst ist austauschbar. */
  const gruss = (t: EigenerText) => {
    const zeilen = grussZeilen(e).filter(Boolean);
    if (t.gruss.trim()) zeilen[zeilen.length - 1] = t.gruss.trim();
    return `<p>${zeilen.map((z) => wert(z)).join('<br>')}</p>`;
  };
  /** Der Betreff ist reiner Text – `{{` darin läse ChurchTools sonst als Platzhalter. */
  const betreff = (art: MailArt) =>
    ((eigen[art] ?? OHNE_EIGENEN_TEXT).betreff.trim() || standardBetreff(art, veranstaltung))
      .replace(/\{\{/g, '{ {')
      .slice(0, BETREFF_MAX);

  const b = e.bezahlung;
  const bank = bankZeilen(b, '§nachname§');
  const zahlen = kannEtwasKosten(e.preis)
    ? wenn(
        feld('betrag'),
        // Nur der Betrag: Die Aufschlüsselung käme einzeilig an (ChurchTools übernimmt keine Zeilenumbrüche aus dem
        // Feld, echte Prüfung 24.10.2026), und ihr Format liest die Liste zeilenweise (Alwin, 26.10.2026).
        html(`<p>Betrag: [${feld('betrag')}]</p>`) +
          (bank.length
            ? html(
                `<p>Bitte überweise ihn${b.fristTage > 0 ? ` innerhalb von ${b.fristTage} Tagen` : ''} an:<br>§bank§</p>`,
                { bank: bank.join('\n') },
                // `[Nachname]` im Verwendungszweck = Nachname der Person, an die die Mail geht.
              ).replace(/§nachname§/g, '{{person.lastName}}')
            : '<p>Wie ihr bezahlt, sagen wir euch noch.</p>'),
      )
    : '';
  // Ohne Code (z. B. vor dem Einschalten angemeldet) fällt der Absatz weg – gemessen 28.10.2026, `{{#if}}` greift.
  const code = qr
    ? wenn(
        QR_CODE,
        html(`<p>Check-in-Code für [Vorname] – bitte beim Ankommen zeigen:<br>[${QR_CODE}]</p>`),
      )
    : '';

  const platz: AblaufMail = {
    betreff: betreff('platz'),
    html: [
      hallo,
      html(
        '<p>die Anmeldung von [Vorname] zu „§v§“ (§termin§) ist bestätigt – [Vorname] ist dabei.',
        v,
      ) +
        nr +
        '</p>',
      zahlen,
      code,
      absatz(eigen.platz),
      link('absagen'),
      gruss(eigen.platz),
    ].join(''),
  };
  const warte: AblaufMail = {
    betreff: betreff('warte'),
    html: [
      hallo,
      html(
        '<p>die Anmeldung von [Vorname] zu „§v§“ (§termin§) ist eingegangen. Im Moment ist kein Platz frei – [Vorname] steht auf Platz [Wartelistenplatz] der Warteliste.',
        v,
      ) +
        nr +
        '</p>',
      html(
        kannEtwasKosten(e.preis)
          ? '<p>Wird ein Platz frei, bekommt ihr eine Mail mit Betrag und Bankdaten – erst dann ist etwas zu bezahlen.</p>'
          : '<p>Wird ein Platz frei, bekommt ihr eine Mail.</p>',
      ),
      absatz(eigen.warte),
      link('zurückziehen'),
      gruss(eigen.warte),
    ].join(''),
  };
  // A9-3b: der Termin mit Datum, nicht „in 3 Tagen“ – wer sich spät anmeldet, bekommt sie sofort (R7, Alwin 04.11.2026).
  const er = eigen.erinnerung ?? OHNE_EIGENEN_TEXT;
  const erinnerung: AblaufMail = {
    betreff: betreff('erinnerung'),
    html: [
      hallo,
      html('<p>bald ist es so weit: [Vorname] ist bei „§v§“ dabei – §termin§.', v) + nr + '</p>',
      absatz(er),
      link('absagen'),
      gruss(er),
    ].join(''),
  };
  return { platz, warte, erinnerung, unbekannt: [...unbekannt] };
}

/** Ein Schritt einer Routine, wie `PATCH /routines/{id}` ihn nimmt. */
export type RoutinenSchritt =
  | {
      id?: number;
      actionKey: 'send-member-email';
      isEnabled: boolean;
      actionData: { subject: string; body: string; addSignOutUrl: false; senderId: number };
    }
  | { id?: number; actionKey: 'special:wait'; isEnabled: true; actionData: { untilDate: string } }
  | { id?: number; actionKey: 'remove-member'; isEnabled: true; actionData: Record<string, never> };

/**
 * **Darf eine Veranstaltung ins Archiv?** (A9-4, D1/D2) – Archivieren schaltet die Abläufe ab (gemessen 24.10.2026), danach
 * löschte ChurchTools die Anmeldungen nie. Darum: ohne Anmeldungen frei; mit Anmeldungen erst, wenn ChurchTools sie
 * gelöscht hat (`gesperrt`, `ab` = Löschdatum; `faellig`: der Tag ist da, die Routine läuft aber noch nicht – nachts).
 * Löscht ChurchTools gar nicht (kein Termin, keine Abläufe), geht es mit Hinweis (`ohneLoeschen`). `loeschDatum`: wie es
 * in ChurchTools steht (`AblaufStand`), nicht aus den Einstellungen – nur das löscht wirklich. `anzahl` unbekannt (`null`)
 * gilt als „mit Anmeldungen“.
 */
export type ArchivStand =
  | { art: 'frei' }
  | { art: 'ohneLoeschen' }
  | { art: 'gesperrt'; ab: string; faellig: boolean };

export function archivStand(
  anzahl: number | null,
  loeschDatum: string | null,
  heute: string,
): ArchivStand {
  if (anzahl === 0) return { art: 'frei' };
  if (loeschDatum === null) return { art: 'ohneLoeschen' };
  return { art: 'gesperrt', ab: loeschDatum, faellig: loeschDatum <= heute };
}

/** **Anmeldeschluss an einem Tag** – bis 23:59 Uhr Ortszeit, als Zeitpunkt für ChurchTools. Die eine Stelle dafür. */
export function anmeldeschlussAm(tag: string, zeitzone: string): string {
  return utcAus(`${tag}T23:59`, zeitzone);
}

/** **Letzter Tag zum Anmelden** vor dem Löschen: der Tag vor dem Löschdatum. */
export function letzterAnmeldetag(loeschDatum: string): string {
  return plusTage(loeschDatum, -1);
}

/**
 * **Anmeldeschluss, der zum Löschdatum passt** (A9-3a, Fund der echten Prüfung 28.10.2026): Wer sich ab dem Löschdatum
 * anmeldet, bekäme die Bestätigung und wäre im selben Augenblick entfernt (gemessen). Darum schließt die Anmeldung
 * spätestens am Tag davor. Liefert den Zeitpunkt, der geschrieben werden muss – `null`, wenn der Anmeldeschluss (`bis`,
 * aus ChurchTools) schon früh genug liegt. Kein Anmeldeschluss gilt als zu spät.
 */
export function anmeldeschlussVorLoeschen(
  bis: string | null | undefined,
  loeschDatum: string,
  zeitzone: string,
): string | null {
  const spaetestens = anmeldeschlussAm(letzterAnmeldetag(loeschDatum), zeitzone);
  return bis && Date.parse(bis) <= Date.parse(spaetestens) ? null : spaetestens;
}

/**
 * **Welcher Schritt welcher ist** (A9-3b) – nach seiner **Stellung**, nicht nach seiner Art: Bestätigung zuerst, dann je
 * Erinnerung „warten bis“ + Mail, dann „warten bis zum Löschdatum“ + „entfernen“. Mit mehreren Erinnerungen gibt es
 * mehrere Mail- und Warte-Schritte; „der erste Schritt dieser Art“ fände dann den falschen.
 */
export interface SchrittFolge {
  bestaetigung?: number;
  erinnerungen: { warte: number; mail: number }[];
  loeschWarte?: number;
  entfernen?: number;
}

export function schrittFolge(schritte: readonly { id: number; actionKey: string }[]): SchrittFolge {
  const f: SchrittFolge = { erinnerungen: [] };
  const ende = schritte.findIndex((s) => s.actionKey === 'remove-member');
  const loesch = ende > 0 && schritte[ende - 1].actionKey === 'special:wait' ? ende - 1 : -1;
  if (schritte[0]?.actionKey === 'send-member-email') f.bestaetigung = schritte[0].id;
  const bis = loesch >= 0 ? loesch : schritte.length;
  for (let i = f.bestaetigung === undefined ? 0 : 1; i + 1 < bis; i++)
    if (
      schritte[i].actionKey === 'special:wait' &&
      schritte[i + 1].actionKey === 'send-member-email'
    ) {
      f.erinnerungen.push({ warte: schritte[i].id, mail: schritte[i + 1].id });
      i++;
    }
  if (loesch >= 0) f.loeschWarte = schritte[loesch].id;
  if (ende >= 0) f.entfernen = schritte[ende].id;
  return f;
}

/**
 * **Die Schritte einer Routine** – die Mail (A9-1), die Erinnerungen (A9-3b) und, mit Löschdatum, „warten bis“ +
 * „entfernen“ (A9-3a; entfernen muss der letzte Schritt sein, Schnittstelle). `vorher`: die Schritte, die ChurchTools
 * schon hat; ihre Nummern werden nach ihrer Stellung (`schrittFolge`) mitgeschickt, damit laufende Abläufe an ihrer
 * Stelle bleiben (gemessen: ohne Nummer legt ChurchTools neue Schritte an). Erinnerungen bekommen die Nummern der
 * bisherigen der Reihe nach. **Nie eine `emailId` mitschicken** – sie gehört zu genau einem Schritt; teilen sich
 * Schritte eine, trägt die Bestätigung den Text der Erinnerung (gemessen M5-1). `addSignOutUrl: false` – der Link von
 * ChurchTools führte an „Deine Anmeldung“ vorbei. `mailAn: false` schaltet nur die Bestätigung aus – für das
 * Nachstarten schon Angemeldeter (gemessen 28.10.2026). Erinnerungen gibt es nur mit Löschdatum (beide brauchen den
 * Termin).
 */
export function routinenSchritte(
  mail: AblaufMail,
  absenderId: number,
  vorher: { id: number; actionKey: string }[] = [],
  loeschen: string | null = null,
  mailAn = true,
  erinnerung: { mail: AblaufMail; liste: readonly Erinnerung[] } | null = null,
): RoutinenSchritt[] {
  const f = schrittFolge(vorher);
  const nr = (id: number | undefined) => (id ? { id } : {});
  const mailDaten = (m: AblaufMail) => ({
    subject: m.betreff,
    body: m.html,
    addSignOutUrl: false as const,
    senderId: absenderId,
  });
  const schritte: RoutinenSchritt[] = [
    {
      ...nr(f.bestaetigung),
      actionKey: 'send-member-email',
      isEnabled: mailAn,
      actionData: mailDaten(mail),
    },
  ];
  if (!loeschen) return schritte;
  (erinnerung?.liste ?? []).forEach((x, i) =>
    schritte.push(
      {
        ...nr(f.erinnerungen[i]?.warte),
        actionKey: 'special:wait',
        isEnabled: true,
        actionData: { untilDate: x.datum },
      },
      {
        ...nr(f.erinnerungen[i]?.mail),
        actionKey: 'send-member-email',
        isEnabled: x.an,
        actionData: mailDaten(erinnerung!.mail),
      },
    ),
  );
  schritte.push(
    {
      ...nr(f.loeschWarte),
      actionKey: 'special:wait',
      isEnabled: true,
      actionData: { untilDate: loeschen },
    },
    { ...nr(f.entfernen), actionKey: 'remove-member', isEnabled: true, actionData: {} },
  );
  return schritte;
}
