/**
 * **Die Erinnerungs-Mail einer Abfrage – DIE eine Regel** (Bauplan R-4, 25.11.2026; Entwurf `runden-entwurf.html` Schritt 7).
 * Standard-Betreff und -Text, die Platzhalter und der Bau der Mail. Die Einstellungen (Fenster) und – ab R-5 – die
 * ChurchTools-Routine benutzen `mailFuer`; niemand baut den Text noch einmal nach.
 *
 * **Platzhalter** (Planer schreiben sie in Betreff und Text): `{zeitraum}` („Februar und März“), `{frist}` („Dienstag,
 * 5. Januar“), `{gruppe}` (Name der Dienstgruppe) und nur im Text `{vorname}`. Alles außer `{vorname}` setzt die App ein, wenn
 * sie die Mail baut; `{vorname}` wird zu ChurchTools' `{{{person.firstName}}}` – gemessen: die Routinen-Mail kennt diesen
 * Platzhalter, die App kennt die Empfänger nicht. Ein unbekannter Platzhalter bleibt unverändert stehen (`unbekannteStellen`
 * meldet ihn, das Fenster weist darauf hin; Speichern bleibt möglich).
 *
 * **Aufbau der HTML-Mail:** Absätze sind durch eine Leerzeile getrennt (einfache Zeilenumbrüche bleiben `<br>`). Der Knopf
 * „Im Dienstplaner eintragen“ steht **unter dem zweiten Absatz** (Anrede + Bitte); alles danach ist der kleine, graue
 * Nachsatz. Hat der Text höchstens zwei Absätze, steht der Knopf am Ende. Der Text wird erst maskiert (`htmlText`), dann
 * werden die – ebenfalls maskierten – Werte eingesetzt; der Betreff ist kein HTML und bleibt unmaskiert.
 *
 * **Bewusst nicht neutralisiert:** Wer `{{{person.lastName}}}` o. Ä. in den Text schreibt, bekommt den ChurchTools-Platzhalter –
 * das dürfen nur Planer, mehr als ein Nachname kommt dabei nicht heraus.
 */
import { tagLang } from '../ct/datum';
import type { Abfrage } from './abfragen';
import { monateText } from './abfrageStand';
import { htmlText, mailKnopf } from './erinnern';

export const STANDARD_BETREFF = 'Bitte eintragen: Wann kannst du im {zeitraum}?';

export const STANDARD_TEXT = [
  'Hallo {vorname},',
  'die {gruppe} plant {zeitraum}. Bitte trag bis {frist} im Dienstplaner ein, an welchen Terminen du kannst (Ja, Vielleicht oder Nein).',
  'Hast du inzwischen alles eingetragen? Dann ist diese Mail überholt, es kommt keine weitere. Du willst nicht mehr erinnert werden? Sag der Leitung der {gruppe} Bescheid.',
].join('\n\n');

/** ChurchTools' Platzhalter für den Vornamen in einer Routinen-Mail. */
export const CT_VORNAME = '{{{person.firstName}}}';

/** Was im Betreff und was im Text stehen darf. */
export const PLATZHALTER_BETREFF = ['zeitraum', 'frist', 'gruppe'] as const;
export const PLATZHALTER_TEXT = ['zeitraum', 'frist', 'gruppe', 'vorname'] as const;

const STELLE = /\{([A-Za-z]+)\}/g;

/** Die Platzhalter in `s`, die es nicht gibt (je einmal, in der Reihenfolge des Auftretens), mit Klammern: `{zeitrum}`. */
export function unbekannteStellen(s: string, erlaubt: readonly string[]): string[] {
  const funde = [...s.matchAll(STELLE)].map((m) => m[1]).filter((n) => !erlaubt.includes(n));
  return [...new Set(funde)].map((n) => `{${n}}`);
}

/** Ersetzt die Platzhalter in EINEM Durchgang (ein eingesetzter Wert wird nie noch einmal durchsucht). */
function einsetzen(s: string, werte: Record<string, string>): string {
  return s.replace(STELLE, (m, name: string) => (name in werte ? werte[name] : m));
}

const NACHSATZ_STIL = 'font-size:12px;color:#5f6368';

/**
 * **Die Mail für eine Abfrage:** Betreff (Klartext) und HTML. `plan.mail === null` = Standardtext. `link` ist die volle
 * Adresse von „Verfügbarkeit“ mit der Abfrage (Aufrufer baut sie mit `adresseFuerAbwesenheitenAbfrage` + `erweiterungsLink`).
 */
export function mailFuer(
  plan: { mail: { betreff: string; text: string } | null },
  abfrage: Pick<Abfrage, 'von' | 'bis' | 'frist'>,
  gruppe: string,
  link: string,
): { betreff: string; html: string } {
  const mail = plan.mail ?? { betreff: STANDARD_BETREFF, text: STANDARD_TEXT };
  const zeitraum = monateText(abfrage.von, abfrage.bis);
  const frist = tagLang(abfrage.frist);

  const betreff = einsetzen(mail.betreff, { zeitraum, frist, gruppe });

  const werte = {
    zeitraum: `<b>${htmlText(zeitraum)}</b>`,
    frist: `<b>${htmlText(frist)}</b>`,
    gruppe: htmlText(gruppe),
    vorname: CT_VORNAME,
  };
  const absaetze = mail.text
    .trim()
    .split(/\r?\n[ \t]*\r?\n/)
    .map((a) => a.trim())
    .filter(Boolean);
  const knopf = `<p>${mailKnopf(link, 'Im Dienstplaner eintragen')}</p>`;
  const teile = absaetze.map((a, i) => {
    const html = einsetzen(htmlText(a), werte).replace(/\r?\n/g, '<br>');
    return i >= 2 ? `<p style="${NACHSATZ_STIL}">${html}</p>` : `<p>${html}</p>`;
  });
  const vorKnopf = teile.slice(0, 2);
  return { betreff, html: [...vorKnopf, knopf, ...teile.slice(2)].join('') };
}
