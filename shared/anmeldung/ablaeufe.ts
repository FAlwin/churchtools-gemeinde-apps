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

/** Name eines Systemfelds – so heißt es auch als Platzhalter bei ChurchTools (`/placeholders/group/{id}`). */
const feld = (id: (typeof SYSTEMFELDER)[number]['id']) =>
  SYSTEMFELDER.find((f) => f.id === id)!.name;

/** Die beiden Routinen einer Veranstaltung: für wen sie gelten und wie sie in ChurchTools heißen. */
export const ROUTINEN = [
  { art: 'platz', status: 'active', name: 'Anmeldungen: Platz' },
  { art: 'warte', status: 'waiting', name: 'Anmeldungen: Warteliste' },
] as const;

export type RoutinenArt = (typeof ROUTINEN)[number]['art'];

export interface AblaufMail {
  betreff: string;
  html: string;
}

/** Höchstlänge des Betreffs einer Routine-Mail (Schnittstelle: 200). */
export const BETREFF_MAX = 200;

/**
 * **Was Veranstalter an einer Mail selbst schreiben** (A9-2a, Alwin 26.10.2026: fester Rahmen + eigener Absatz). Leer
 * heißt: der Standard (`standardBetreff`, kein eigener Absatz, „Viele Grüße“). Steht als JSON in der **Beschreibung der
 * Routine** – nicht öffentlich, höchstens 1.000 Zeichen, Leerzeichen am Ende schneidet ChurchTools ab (gemessen
 * 26.10.2026); beim Neuschreiben der Schritte bleibt sie stehen.
 */
export interface EigenerText {
  betreff: string;
  absatz: string;
  gruss: string;
}

export const OHNE_EIGENEN_TEXT: EigenerText = { betreff: '', absatz: '', gruss: '' };

/** Höchstlänge der Beschreibung einer Routine (Schnittstelle, gemessen: 1.001 → 400). */
export const BESCHREIBUNG_MAX = 1000;

const EigenSchema = z.object({
  v: z.literal(1),
  betreff: z.string().default(''),
  absatz: z.string().default(''),
  gruss: z.string().default(''),
});

/** Der eigene Text aus der Beschreibung einer Routine. Was nicht von uns stammt (oder leer ist), gilt als „kein eigener“. */
export function eigenerTextAus(beschreibung: string | null | undefined): EigenerText {
  if (!beschreibung) return OHNE_EIGENEN_TEXT;
  try {
    const r = EigenSchema.safeParse(JSON.parse(beschreibung));
    return r.success
      ? { betreff: r.data.betreff, absatz: r.data.absatz, gruss: r.data.gruss }
      : OHNE_EIGENEN_TEXT;
  } catch {
    return OHNE_EIGENEN_TEXT;
  }
}

/** Der eigene Text als Beschreibung der Routine – `null`, wenn nichts Eigenes da ist. */
export function eigenerTextAlsBeschreibung(t: EigenerText): string | null {
  const x = { betreff: t.betreff.trim(), absatz: t.absatz.trim(), gruss: t.gruss.trim() };
  if (!x.betreff && !x.absatz && !x.gruss) return null;
  return JSON.stringify({ v: 1, ...x });
}

/** Was am eigenen Text nicht passt – `null`, wenn alles passt. Gezählt wird, was ChurchTools speichern muss. */
export function eigenerTextFehler(t: EigenerText): string | null {
  if (t.betreff.trim().length > BETREFF_MAX)
    return `Der Betreff hat höchstens ${BETREFF_MAX} Zeichen.`;
  const laenge = eigenerTextAlsBeschreibung(t)?.length ?? 0;
  if (laenge > BESCHREIBUNG_MAX)
    return `Eigener Absatz und Gruß sind zusammen zu lang (${laenge - BESCHREIBUNG_MAX} Zeichen zu viel).`;
  return null;
}

/** Der Betreff, wenn Veranstalter keinen eigenen schreiben. */
export function standardBetreff(art: RoutinenArt, veranstaltung: string): string {
  return `${veranstaltung}: ${art === 'platz' ? 'Anmeldung bestätigt' : 'Warteliste'}`.slice(
    0,
    BETREFF_MAX,
  );
}

/** Was aus den Einstellungen kommt: HTML-sicher und ohne `{{`, damit ChurchTools nichts davon als Platzhalter liest. */
function wert(text: string): string {
  return htmlSicher(text).replace(/\{/g, '&#123;').split('\n').join('<br>');
}

/**
 * **Die Mails einer Veranstaltung** – Bestätigung (Platz) und Warteliste, als HTML mit den Platzhaltern von ChurchTools.
 * `ctPlatzhalter`: Bezeichnung → Platzhalter aus `/placeholders/group/{id}`. Fehlt dort ein Feld, steht es in
 * `unbekannt` – dann darf nichts geschrieben werden (die Mail zeigte sonst „[Betrag]“).
 */
export function ablaufMails(
  e: OeffentlicheEinstellungen,
  veranstaltung: string,
  ctPlatzhalter: ReadonlyMap<string, string>,
  eigen: Readonly<Record<RoutinenArt, EigenerText>> = {
    platz: OHNE_EIGENEN_TEXT,
    warte: OHNE_EIGENEN_TEXT,
  },
): { platz: AblaufMail; warte: AblaufMail; unbekannt: string[] } {
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
  const betreff = (art: RoutinenArt) =>
    (eigen[art].betreff.trim() || standardBetreff(art, veranstaltung))
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
  return { platz, warte, unbekannt: [...unbekannt] };
}

/** Ein Schritt einer Routine, wie `PATCH /routines/{id}` ihn nimmt. */
export interface RoutinenSchritt {
  id?: number;
  actionKey: 'send-member-email';
  isEnabled: boolean;
  actionData: { subject: string; body: string; addSignOutUrl: false; senderId: number };
}

/**
 * **Die Schritte einer Routine** – in A9-1 nur die Mail. `vorher`: die Schritte, die ChurchTools schon hat; ihre
 * Nummern werden mitgeschickt, damit laufende Abläufe an ihrer Stelle bleiben (gemessen: ohne Nummer legt ChurchTools
 * neue Schritte an). `addSignOutUrl: false` – der Link von ChurchTools führte an „Deine Anmeldung“ vorbei.
 */
export function routinenSchritte(
  mail: AblaufMail,
  absenderId: number,
  vorher: { id: number; actionKey: string }[] = [],
): RoutinenSchritt[] {
  const id = vorher.find((s) => s.actionKey === 'send-member-email')?.id;
  return [
    {
      ...(id ? { id } : {}),
      actionKey: 'send-member-email',
      isEnabled: true,
      actionData: {
        subject: mail.betreff,
        body: mail.html,
        addSignOutUrl: false,
        senderId: absenderId,
      },
    },
  ];
}
