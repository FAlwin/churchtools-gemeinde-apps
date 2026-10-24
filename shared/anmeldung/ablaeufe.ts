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
 * kommt (Name, Termin, Bankdaten, Kontakt), wird erst danach eingesetzt – eckige Klammern darin bleiben so Text.
 */
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
const BETREFF_MAX = 200;

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
  const gruss = `<p>${grussZeilen(e)
    .filter(Boolean)
    .map((z) => wert(z))
    .join('<br>')}</p>`;

  const b = e.bezahlung;
  const bank = bankZeilen(b, '§nachname§');
  const zahlen = kannEtwasKosten(e.preis)
    ? wenn(
        feld('betrag'),
        html(`<p>Betrag: [${feld('betrag')}]<br>[${feld('aufschluesselung')}]</p>`) +
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
    betreff: `${veranstaltung}: Anmeldung bestätigt`.slice(0, BETREFF_MAX),
    html: [
      hallo,
      html(
        '<p>die Anmeldung von [Vorname] zu „§v§“ (§termin§) ist bestätigt – [Vorname] ist dabei.',
        v,
      ) +
        nr +
        '</p>',
      zahlen,
      link('absagen'),
      gruss,
    ].join(''),
  };
  const warte: AblaufMail = {
    betreff: `${veranstaltung}: Warteliste`.slice(0, BETREFF_MAX),
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
      link('zurückziehen'),
      gruss,
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
