/**
 * **Rundmail** (A7-5, Entwurf `a7-5-rundmail-v1`, abgenommen 22.10.2026) – ChurchTools verschickt, je Anmeldung **eine**
 * Mail an den Kontakt (Alwin). Gemessen 22.10.2026: Jede Person bekommt ihre eigene Mail (Absender „Name
 * <noreply@churchtools.de>“, Antwort an die Absenderin), Platzhalter füllt ChurchTools je Person – auch alle Felder der
 * Anmeldung (`/placeholders/group/{id}`).
 *
 * Im Text schreibt das Team Platzhalter lesbar in eckigen Klammern – `[Betrag]`, `[Anmelde-Nr.]` –, so wie schon
 * `[Nachname]` im Verwendungszweck (`bezahlung.ts`). Erst beim Senden werden sie zu den Platzhaltern von ChurchTools.
 */
import { tagPunkt } from '../ct/datum';
import { bankZeilen } from './bezahlung';
import { grussZeilen } from './bewegung';
import type { OeffentlicheEinstellungen } from './formular';
import type { ListenAnmeldung } from './liste';

export type RundmailFilter = 'alle' | 'offen' | 'warte';

export interface RundmailEmpfaenger {
  /** An diese Person schickt ChurchTools – ihre Felder füllen die Platzhalter. */
  personId: number;
  wer: string;
  nr: string | null;
  email: string;
}

/**
 * **Wer die Rundmail bekommt** – je Anmeldung eine Person: die erste (bei ihr stehen Kontakt, Betrag und Anmelde-Nr.),
 * hat sie keine E-Mail-Adresse, die nächste mit Adresse. Ohne jede Adresse wird die Anmeldung übersprungen und genannt.
 * Auswahl wie die Filter der Liste: alle, Zahlung offen, Warteliste (mindestens eine Person wartet).
 */
export function rundmailEmpfaenger(
  liste: ListenAnmeldung[],
  filter: RundmailFilter,
): { an: RundmailEmpfaenger[]; ohneAdresse: string[] } {
  const passt = (x: ListenAnmeldung) =>
    filter === 'offen'
      ? x.zahlungOffen
      : filter === 'warte'
        ? x.personen.some((p) => p.status === 'wartet')
        : true;
  const an: RundmailEmpfaenger[] = [];
  const ohneAdresse: string[] = [];
  for (const x of liste.filter(passt)) {
    const reihe = [
      ...x.personen.filter((p) => p.personId === x.zahlungBei),
      ...x.personen.filter((p) => p.personId !== x.zahlungBei),
    ];
    const p = reihe.find((y) => y.email);
    if (p?.email) an.push({ personId: p.personId, wer: x.wer, nr: x.nr, email: p.email });
    else ohneAdresse.push(x.wer);
  }
  return { an, ohneAdresse };
}

/**
 * Die Platzhalter, die das Fenster anbietet – Name im Text → Bezeichnung bei ChurchTools (`/placeholders/group/{id}`,
 * Felder heißen dort wie in der Gruppe). „Vorname“ und „Nachname“ sind die der Person, an die die Mail geht.
 */
export const RUNDMAIL_PLATZHALTER = [
  'Angemeldet von',
  'Vorname',
  'Nachname',
  'Anmelde-Nr.',
  'Betrag',
  'Aufschlüsselung',
  'Wartelistenplatz',
] as const;

/** Platzhalter der Person – fest in ChurchTools (gemessen 22.10.2026: `{{person.firstName}}` → „Nora“). */
const PERSON: Record<string, string> = {
  Vorname: '{{person.firstName}}',
  Nachname: '{{person.lastName}}',
};

const KLAMMER = /\[([^\]\n]{1,60})\]/g;

/**
 * **Lesbare Platzhalter → ChurchTools** – `[Betrag]` wird zu dem, was ChurchTools für das Feld „Betrag“ nennt.
 * `ctPlatzhalter`: Bezeichnung → Platzhalter, aus `/placeholders/group/{id}`. Unbekannte bleiben stehen und werden
 * genannt – so sieht das Team sie vor dem Senden.
 */
export function mitCtPlatzhaltern(
  text: string,
  ctPlatzhalter: ReadonlyMap<string, string>,
): { text: string; unbekannt: string[] } {
  const unbekannt = new Set<string>();
  const ersetzt = text.replace(KLAMMER, (ganz, name: string) => {
    const t = name.trim();
    const ct = PERSON[t] ?? ctPlatzhalter.get(t);
    if (ct) return ct;
    unbekannt.add(t);
    return ganz;
  });
  return { text: ersetzt, unbekannt: [...unbekannt] };
}

const zeichen: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Text so, dass HTML ihn wörtlich zeigt (`&`, `<`, `>`, `"` geschützt). */
export function htmlSicher(text: string): string {
  return text.replace(/[&<>"]/g, (z) => zeichen[z]);
}

/**
 * **Der Text als HTML** für ChurchTools (der Mail-Editor dort schreibt HTML): Absätze bei Leerzeilen, sonst Zeilenumbrüche.
 * Sonderzeichen werden geschützt – das Team schreibt Text, kein HTML.
 */
export function textZuHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((absatz) => `<p>${htmlSicher(absatz).split('\n').join('<br>')}</p>`)
    .join('');
}

export type RundmailVorlage = 'leer' | 'zahlung' | 'vorab';

/**
 * **Die Vorlagen** (Alwin, 22.10.2026: leer, Zahlungserinnerung, Infos vorab) – Betreff und Text, frei änderbar. Die
 * Zahlungserinnerung nimmt Bankdaten und Verwendungszweck aus der Karte „Bezahlung“, „Infos vorab“ Datum und Ort aus
 * dem Termin.
 */
export function rundmailVorlage(
  art: RundmailVorlage,
  e: OeffentlicheEinstellungen,
  veranstaltung: string,
): { betreff: string; text: string } {
  if (art === 'leer') return { betreff: '', text: '' };
  const gruss = grussZeilen(e);
  if (art === 'zahlung') {
    const b = e.bezahlung;
    const bank = b.iban
      ? ['Bitte überweist ihn an:', ...bankZeilen(b, '[Nachname]')]
      : ['Wie ihr bezahlt, sagen wir euch noch.'];
    return {
      betreff: `${veranstaltung}: Bitte noch überweisen`,
      text: [
        'Hallo [Angemeldet von],',
        '',
        `für eure Anmeldung [Anmelde-Nr.] zu „${veranstaltung}“ ist noch [Betrag] offen.`,
        ...bank,
        'Habt ihr schon überwiesen? Dann ist alles gut – danke!',
        ...gruss,
      ].join('\n'),
    };
  }
  const t = e.termin;
  const wann = t
    ? ` am ${tagPunkt(t.beginn)}${t.beginn.length > 10 ? `, ${t.beginn.slice(11, 16)} Uhr` : ''}${t.ort ? ` in ${t.ort}` : ''}`
    : '';
  return {
    betreff: `${veranstaltung}: Infos vorab`,
    text: [
      'Hallo [Angemeldet von],',
      '',
      `bald ist es so weit: „${veranstaltung}“${wann}.`,
      '',
      '…',
      ...gruss,
    ].join('\n'),
  };
}
