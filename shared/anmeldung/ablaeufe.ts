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
import { absatzMitAntworten, alleAngaben, mailBausteine, mailText } from './mailAntworten';
import { mitCtPlatzhaltern } from './rundmail';
import { terminZeile } from './termin';
import { datumText, plusTage } from '../ct/datum';
import { utcAus } from '../ct/zeit';
import type { RoutinenSchritt } from '../ct/routinen';

/** Lag bis O9-1 (11.11.2026) hier; jetzt in `shared/ct/routinen.ts` (auch der Gruppenwechsel schreibt Routinen). */
export type { RoutinenSchritt };

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
  /** F7a, nur Bestätigung: „Alle Angaben mitschicken“ – fehlt bei allem, was vorher gespeichert wurde (= aus). */
  alle?: boolean;
}

export const OHNE_EIGENEN_TEXT: EigenerText = { betreff: '', absatz: '', gruss: '' };

/**
 * **Wann die zweite Mail kommt** (F7b, Klick-Runde 11, Messung M3): gleich nach der Bestätigung, X Tage danach
 * (Warten mit `duration` – zählt in Tagen ab der Bestätigung) oder an einem Datum (`JJJJ-MM-TT`, wie die Erinnerungen).
 */
export type ZweiteWann =
  | { art: 'sofort' }
  | { art: 'tage'; tage: number }
  | { art: 'datum'; datum: string };

/**
 * **Die zweite Mail** (F7b, Alwin 18.11.2026) – eigener Betreff und Text, an jede Person mit Platz; wer nachrückt,
 * bekommt sie dann. `null`: aus. Gespeichert: der Text in der Beschreibung der Routine „Warteliste“ (mit deren Text
 * höchstens 1.000 Zeichen), **wann** in der von „Platz“ – dort stehen ihre Schritte, und beides wird im selben Aufruf
 * geschrieben. So passt beim Lesen der Schritte (`schrittFolge`) immer das „Wann“ zu dem, was in ChurchTools steht.
 */
export interface ZweiteMail {
  wann: ZweiteWann;
  betreff: string;
  text: string;
}

/** Grenzen für „X Tage nach der Anmeldung“. */
export const ZWEITE_TAGE_MIN = 1;
export const ZWEITE_TAGE_MAX = 365;

/** Höchstlänge der Beschreibung einer Routine (Schnittstelle, gemessen: 1.001 → 400). */
export const BESCHREIBUNG_MAX = 1000;

const TextSchema = z.object({
  betreff: z.string().default(''),
  absatz: z.string().default(''),
  gruss: z.string().default(''),
  alle: z.boolean().optional(),
});
const WannSchema = z.discriminatedUnion('art', [
  z.object({ art: z.literal('sofort') }),
  z.object({ art: z.literal('tage'), tage: z.number().int() }),
  z.object({ art: z.literal('datum'), datum: z.string() }),
]);
const EigenSchema = TextSchema.extend({
  v: z.literal(1),
  erinnerung: TextSchema.optional(),
  // F7b: „wann“ in der Beschreibung von „Platz“, Betreff und Text in der von „Warteliste“.
  zweiteWann: WannSchema.optional(),
  zweite: z.object({ betreff: z.string().default(''), text: z.string().default('') }).optional(),
});

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
  ...(t.alle ? { alle: true } : {}),
});

/** Der eigene Text aus der Beschreibung einer Routine. Was nicht von uns stammt (oder leer ist), gilt als „kein eigener“. */
export function eigenerTextAus(beschreibung: string | null | undefined): EigenerText {
  const b = beschreibungLesen(beschreibung);
  return b ? nurText(b) : OHNE_EIGENEN_TEXT;
}

/** F7b: Wann die zweite Mail kommt – aus der Beschreibung der Routine „Platz“; `null`: keine. */
export function zweiteWannAus(beschreibung: string | null | undefined): ZweiteWann | null {
  return beschreibungLesen(beschreibung)?.zweiteWann ?? null;
}

/**
 * **Die zweite Mail** (F7b) aus den Beschreibungen beider Routinen. Fehlt eine Hälfte (nur von Hand in ChurchTools
 * möglich – geschrieben wird erst „Warteliste“, dann „Platz“), gilt sie als aus: lieber keine Mail als eine leere.
 */
export function zweiteMailAus(
  platz: string | null | undefined,
  warte: string | null | undefined,
): ZweiteMail | null {
  const wann = zweiteWannAus(platz);
  const t = beschreibungLesen(warte)?.zweite;
  return wann && t ? { wann, betreff: t.betreff, text: t.text } : null;
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
  ...(t.alle ? { alle: true } : {}),
});
const leer = (t: EigenerText) => !t.betreff && !t.absatz && !t.gruss && !t.alle;

/**
 * Der eigene Text als Beschreibung der Routine – `null`, wenn nichts Eigenes da ist. `erinnerung` nur bei der Routine
 * „Platz“ (A9-3b): Sie steht mit in derselben Beschreibung.
 */
export function eigenerTextAlsBeschreibung(
  t: EigenerText,
  erinnerung: EigenerText = OHNE_EIGENEN_TEXT,
  zweite: ZweiteMail | null = null,
): string | null {
  const x = getrimmt(t);
  const er = getrimmt(erinnerung);
  if (leer(x) && leer(er) && !zweite) return null;
  return JSON.stringify({
    v: 1,
    ...x,
    ...(leer(er) ? {} : { erinnerung: er }),
    ...(zweite ? { zweiteWann: zweite.wann } : {}),
  });
}

/** F7b: Die Beschreibung der Routine „Warteliste“ – ihr eigener Text und Betreff + Text der zweiten Mail. */
export function warteBeschreibung(t: EigenerText, zweite: ZweiteMail | null): string | null {
  const x = getrimmt(t);
  if (leer(x) && !zweite) return null;
  return JSON.stringify({
    v: 1,
    ...x,
    ...(zweite ? { zweite: { betreff: zweite.betreff.trim(), text: zweite.text.trim() } } : {}),
  });
}

/**
 * Was am eigenen Text nicht passt – `null`, wenn alles passt. Gezählt wird, was ChurchTools speichern muss – bei der
 * Routine „Platz“ Bestätigung und Erinnerung zusammen (E4).
 */
export function eigenerTextFehler(
  t: EigenerText,
  erinnerung: EigenerText = OHNE_EIGENEN_TEXT,
  zweite: ZweiteMail | null = null,
): string | null {
  if (t.betreff.trim().length > BETREFF_MAX || erinnerung.betreff.trim().length > BETREFF_MAX)
    return `Der Betreff hat höchstens ${BETREFF_MAX} Zeichen.`;
  const laenge = eigenerTextAlsBeschreibung(t, erinnerung, zweite)?.length ?? 0;
  if (laenge > BESCHREIBUNG_MAX)
    return `Eigener Absatz und Gruß sind zusammen zu lang (${laenge - BESCHREIBUNG_MAX} Zeichen zu viel).`;
  return null;
}

/**
 * **Was an Warteliste-Text und zweiter Mail nicht passt** (F7b) – `null`, wenn alles passt. Beide teilen sich die
 * Beschreibung der Routine „Warteliste“. `loeschen`: das Löschdatum – eine zweite Mail an diesem Tag oder danach käme
 * nie an (die Anmeldungen sind dann weg), und das Warten darauf hielte das Löschen auf.
 */
export function warteFehler(
  t: EigenerText,
  zweite: ZweiteMail | null,
  loeschen: string | null = null,
): string | null {
  if (t.betreff.trim().length > BETREFF_MAX)
    return `Der Betreff hat höchstens ${BETREFF_MAX} Zeichen.`;
  if (zweite) {
    if (!zweite.text.trim()) return 'Die zweite Mail braucht einen Text.';
    if (zweite.betreff.trim().length > BETREFF_MAX)
      return `Der Betreff hat höchstens ${BETREFF_MAX} Zeichen.`;
    const w = zweite.wann;
    if (
      w.art === 'tage' &&
      (!Number.isInteger(w.tage) || w.tage < ZWEITE_TAGE_MIN || w.tage > ZWEITE_TAGE_MAX)
    )
      return `Zweite Mail: bitte ${ZWEITE_TAGE_MIN} bis ${ZWEITE_TAGE_MAX} Tage.`;
    if (w.art === 'datum' && !/^\d{4}-\d{2}-\d{2}$/.test(w.datum))
      return 'Zweite Mail: bitte ein Datum wählen.';
    if (w.art === 'datum' && loeschen && w.datum >= loeschen)
      return 'Zweite Mail: Das Datum liegt am Löschdatum oder danach – dann sind die Anmeldungen schon weg.';
  }
  const laenge = warteBeschreibung(t, zweite)?.length ?? 0;
  if (laenge > BESCHREIBUNG_MAX)
    return `Warteliste und zweite Mail sind zusammen zu lang (${laenge - BESCHREIBUNG_MAX} Zeichen zu viel).`;
  return null;
}

/** Wie die Karte „Mails“ und das Fenster den Zeitpunkt nennen. */
export function zweiteWannText(w: ZweiteWann): string {
  if (w.art === 'sofort') return 'gleich nach der Bestätigung';
  if (w.art === 'tage') return `${w.tage === 1 ? '1 Tag' : `${w.tage} Tage`} nach der Anmeldung`;
  return `am ${datumText(w.datum)}`;
}

/** Der Betreff, wenn Veranstalter keinen eigenen schreiben. */
export function standardBetreff(art: MailArt | 'zweite', veranstaltung: string): string {
  const text =
    art === 'zweite'
      ? `${veranstaltung}: Weitere Infos`
      : art === 'erinnerung'
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

/** **Die Meldung, wenn Platzhalter fehlen** – die eine für Speichern und Vorschau (`ablaufMails` → `unbekannt`). */
export function fehltInChurchTools(unbekannt: readonly string[]): string {
  return `Für die Bestätigungsmail fehlen in ChurchTools: ${unbekannt.join(', ')}.`;
}

/** Was aus den Einstellungen kommt: HTML-sicher und ohne `{{` (`mailText`, seit F7a dort). */
const wert = mailText;

/**
 * **Die Mails einer Veranstaltung** – Bestätigung (Platz) und Warteliste, als HTML mit den Platzhaltern von ChurchTools.
 * `ctPlatzhalter`: Bezeichnung → Platzhalter aus `/placeholders/group/{id}`. Fehlt dort ein Feld, steht es in
 * `unbekannt` – dann darf nichts geschrieben werden (die Mail zeigte sonst „[Betrag]“). `qr` (A9-2b): Check-in-Code in
 * der Bestätigung – maßgeblich ist `qrCodeCheckin` der Gruppe. `spalten` (F7a): Nummer → Name der Spalten der Gruppe –
 * damit `[Frage]` im eigenen Absatz der Bestätigung und „Alle Angaben“ ihren Platzhalter finden (`mailAntworten.ts`).
 */
export function ablaufMails(
  e: OeffentlicheEinstellungen,
  veranstaltung: string,
  ctPlatzhalter: ReadonlyMap<string, string>,
  eigen: Readonly<Record<RoutinenArt, EigenerText>> & {
    readonly erinnerung?: EigenerText;
    readonly zweite?: ZweiteMail | null;
  } = {
    platz: OHNE_EIGENEN_TEXT,
    warte: OHNE_EIGENEN_TEXT,
  },
  qr = false,
  spalten: ReadonlyMap<number, string> = new Map(),
): {
  platz: AblaufMail;
  warte: AblaufMail;
  erinnerung: AblaufMail;
  zweite: AblaufMail | null;
  unbekannt: string[];
} {
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
  /**
   * F7a: In der Bestätigung wird `[Frage]` zur Antwort der Person, dazu auf Wunsch alle Angaben (Entwurf
   * `f7-mails-v1`: Warteliste und Erinnerung bleiben, wie sie sind).
   */
  const mitAntworten = (t: EigenerText) => {
    const r = absatzMitAntworten(t.absatz, mailBausteine(e, ctPlatzhalter, spalten));
    const liste = t.alle ? alleAngaben(e, ctPlatzhalter, spalten) : { html: '', unbekannt: [] };
    [...r.unbekannt, ...liste.unbekannt].forEach((u) => unbekannt.add(u));
    return r.html + liste.html;
  };
  /** „Bei Fragen …“ und der Gruß wie in den übrigen Mails (`grussZeilen`) – nur der Gruß selbst ist austauschbar. */
  const gruss = (t: EigenerText) => {
    const zeilen = grussZeilen(e).filter(Boolean);
    if (t.gruss.trim()) zeilen[zeilen.length - 1] = t.gruss.trim();
    return `<p>${zeilen.map((z) => wert(z)).join('<br>')}</p>`;
  };
  /** Der Betreff ist reiner Text – `{{` darin läse ChurchTools sonst als Platzhalter. */
  const betreffAus = (eigener: string, art: MailArt | 'zweite') =>
    (eigener.trim() || standardBetreff(art, veranstaltung))
      .replace(/\{\{/g, '{ {')
      .slice(0, BETREFF_MAX);
  const betreff = (art: MailArt) => betreffAus((eigen[art] ?? OHNE_EIGENEN_TEXT).betreff, art);

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
      mitAntworten(eigen.platz),
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
  // F7b: die zweite Mail – nur ihr Text (mit „Antwort einfügen“ wie in der Bestätigung) und der Gruß. Was im Text
  // steht, schreibt die Leitung selbst (Entwurf `f7-mails-v1`: „Hallo [Vorname], …“).
  const z = eigen.zweite;
  const zweite: AblaufMail | null = z
    ? {
        betreff: betreffAus(z.betreff, 'zweite'),
        html: (() => {
          const r = absatzMitAntworten(z.text, mailBausteine(e, ctPlatzhalter, spalten));
          r.unbekannt.forEach((u) => unbekannt.add(u));
          return r.html + gruss(OHNE_EIGENEN_TEXT);
        })(),
      }
    : null;
  return { platz, warte, erinnerung, zweite, unbekannt: [...unbekannt] };
}

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
 *
 * F7b: die **zweite Mail** – `zweite` sagt, wann sie kommt (aus der Beschreibung derselben Routine, `zweiteWannAus`; sie
 * wird im selben Aufruf geschrieben wie die Schritte). „Sofort“: die Mail direkt nach der Bestätigung; „X Tage“: Warten
 * mit Dauer + Mail direkt danach; „Datum“: das Paar „warten bis“ + Mail mit ihrem Datum zwischen den Erinnerungen (bei
 * gleichem Tag das erste). `zweiteVor`: so viele Erinnerungen stehen vor ihr.
 */
export interface SchrittFolge {
  bestaetigung?: number;
  zweite?: { warte?: number; mail: number };
  zweiteVor?: number;
  erinnerungen: { warte: number; mail: number }[];
  loeschWarte?: number;
  entfernen?: number;
}

/** Ein Schritt, wie ChurchTools ihn liefert – soweit `schrittFolge` ihn braucht. */
export interface SchrittRoh {
  id: number;
  actionKey: string;
  isEnabled?: boolean;
  actionData?: Readonly<Record<string, unknown>> | null;
}

export function schrittFolge(
  schritte: readonly SchrittRoh[],
  zweite: ZweiteWann | null = null,
): SchrittFolge {
  const f: SchrittFolge = { erinnerungen: [] };
  const ende = schritte.findIndex((s) => s.actionKey === 'remove-member');
  const loesch = ende > 0 && schritte[ende - 1].actionKey === 'special:wait' ? ende - 1 : -1;
  if (schritte[0]?.actionKey === 'send-member-email') f.bestaetigung = schritte[0].id;
  const bis = loesch >= 0 ? loesch : schritte.length;
  const ist = (i: number, art: string) => i < bis && schritte[i]?.actionKey === art;
  let i = f.bestaetigung === undefined ? 0 : 1;
  if (zweite?.art === 'sofort' && ist(i, 'send-member-email')) {
    f.zweite = { mail: schritte[i].id };
    f.zweiteVor = 0;
    i++;
  } else if (zweite?.art === 'tage' && ist(i, 'special:wait') && ist(i + 1, 'send-member-email')) {
    f.zweite = { warte: schritte[i].id, mail: schritte[i + 1].id };
    f.zweiteVor = 0;
    i += 2;
  }
  for (; i + 1 < bis; i++)
    if (ist(i, 'special:wait') && ist(i + 1, 'send-member-email')) {
      const paar = { warte: schritte[i].id, mail: schritte[i + 1].id };
      if (
        zweite?.art === 'datum' &&
        !f.zweite &&
        schritte[i].actionData?.untilDate === zweite.datum
      ) {
        f.zweite = paar;
        f.zweiteVor = f.erinnerungen.length;
      } else f.erinnerungen.push(paar);
      i++;
    }
  if (loesch >= 0) f.loeschWarte = schritte[loesch].id;
  if (ende >= 0) f.entfernen = schritte[ende].id;
  return f;
}

/** F7b: die zweite Mail für `routinenSchritte` – `an: false` schaltet nur ihre Mail aus (Nachstarten). */
export interface ZweiteSchritte {
  mail: AblaufMail;
  wann: ZweiteWann;
  an: boolean;
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
 *
 * F7b: die **zweite Mail** (`zweite`) steht bei „sofort“ und „X Tage“ direkt nach der Bestätigung, mit Datum nach Datum
 * zwischen den Erinnerungen (vor einer am selben Tag) – unabhängig vom Löschdatum. `vorherWann`: wann sie in `vorher`
 * kam (Beschreibung der Routine), damit ihre Schritte erkannt werden. Ihre Nummern bleiben nur, wenn sie an **derselben
 * Stelle** bleibt (gleiche Art, gleich viele Erinnerungen davor) – ein Schritt mit Wartenden wandert nie; sonst wird sie
 * neu angelegt, und die alten Schritte fallen weg (Wartende vorher über „bis heute“ weiter, `wegfallendeWarten`).
 */
export function routinenSchritte(
  mail: AblaufMail,
  absenderId: number,
  vorher: readonly SchrittRoh[] = [],
  loeschen: string | null = null,
  mailAn = true,
  erinnerung: { mail: AblaufMail; liste: readonly Erinnerung[] } | null = null,
  zweite: ZweiteSchritte | null = null,
  vorherWann: ZweiteWann | null = null,
): RoutinenSchritt[] {
  const f = schrittFolge(vorher, vorherWann);
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
  const liste = loeschen ? (erinnerung?.liste ?? []) : [];
  // Wie viele Erinnerungen vor der zweiten Mail stehen – mit Datum nach Datum, vor einer am selben Tag.
  const zweiteVor =
    zweite?.wann.art === 'datum'
      ? liste.filter((x) => x.datum < (zweite.wann as { datum: string }).datum).length
      : 0;
  const bleibt = !!zweite && vorherWann?.art === zweite.wann.art && f.zweiteVor === zweiteVor;
  const zweiteSchritte = (z: ZweiteSchritte): RoutinenSchritt[] => {
    const m: RoutinenSchritt = {
      ...nr(bleibt ? f.zweite?.mail : undefined),
      actionKey: 'send-member-email',
      isEnabled: z.an,
      actionData: mailDaten(z.mail),
    };
    if (z.wann.art === 'sofort') return [m];
    const warte = nr(bleibt ? f.zweite?.warte : undefined);
    return [
      z.wann.art === 'tage'
        ? {
            ...warte,
            actionKey: 'special:wait',
            isEnabled: true,
            actionData: { duration: { numDays: z.wann.tage } },
          }
        : {
            ...warte,
            actionKey: 'special:wait',
            isEnabled: true,
            actionData: { untilDate: z.wann.datum },
          },
      m,
    ];
  };
  if (zweite && zweite.wann.art !== 'datum') schritte.push(...zweiteSchritte(zweite));
  liste.forEach((x, i) => {
    if (zweite?.wann.art === 'datum' && i === zweiteVor) schritte.push(...zweiteSchritte(zweite));
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
    );
  });
  if (zweite?.wann.art === 'datum' && zweiteVor === liste.length)
    schritte.push(...zweiteSchritte(zweite));
  if (!loeschen) return schritte;
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

/**
 * **Warte-Schritte, die wegfallen** (F7b, verallgemeinert aus A9-3b): Nummern aus `vorher`, die in den neuen Schritten
 * nicht mehr vorkommen. Wartet dort jemand, nimmt ChurchTools sie nicht weg (422, gemessen M5 und M3).
 */
export function wegfallendeWarten(
  vorher: readonly SchrittRoh[],
  neu: readonly RoutinenSchritt[],
): number[] {
  const bleiben = new Set(neu.map((s) => s.id).filter((id): id is number => id !== undefined));
  return vorher
    .filter((s) => s.actionKey === 'special:wait' && !bleiben.has(s.id))
    .map((s) => s.id);
}

/**
 * **Erst durchlassen, dann wegnehmen** (gemessen M5-5, M3): die bisherigen Schritte unverändert, nur die wegfallenden
 * Warte-Schritte „bis heute“ und die Mail direkt dahinter aus – so laufen Wartende ohne diese Mail weiter. Danach
 * können die neuen Schritte geschrieben werden. **Nie eine `emailId` mitschicken** (M5-1).
 */
export function durchlassSchritte(
  vorher: readonly SchrittRoh[],
  weg: readonly number[],
  heute: string,
): Record<string, unknown>[] {
  const fort = new Set(weg);
  return vorher.map((s, i) => {
    const { emailId: _id, ...daten } = (s.actionData ?? {}) as Record<string, unknown>;
    const nachWeg = i > 0 && fort.has(vorher[i - 1].id) && s.actionKey === 'send-member-email';
    return {
      id: s.id,
      actionKey: s.actionKey,
      isEnabled: nachWeg ? false : s.isEnabled !== false,
      actionData: fort.has(s.id) ? { untilDate: heute } : daten,
    };
  });
}
