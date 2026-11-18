/**
 * **Antworten in der Bestätigung** (Etappe F7a, Klick-Runde 11 am 18.11.2026, Entwurf `f7-mails-v1`, Messung M2) – die
 * Knöpfe „Antwort einfügen“ setzen `[Frage]` in den eigenen Absatz, und „Alle Angaben mitschicken“ hängt eine Liste
 * aller Antworten an. ChurchTools füllt beides je Person: Jede Frage hat ihre Spalte, und deren Platzhalter
 * (`{{{groupMemberField.<schlüssel>}}}`) setzt die Routine-Mail ein (gemessen M2: Auswahl, freie Antwort,
 * Mehrfachauswahl, Text, Adresse aus `person.*`).
 *
 * Der Weg von der Frage zum Platzhalter: Frage → Spalten-Nummer (`ctFelder`) → Name der Spalte in ChurchTools (der kann
 * vom Text der Frage abweichen, `ctFeldName` hängt „(2)“ an) → Platzhalter (`/placeholders/group/{id}`). Die Namen
 * der Spalten kommen darum mit (`spalten`, Nummer → Name).
 *
 * Grenzen (Entwurf): Fragen der Anmeldung (Telefon, Bemerkungen …) stehen nur bei der ersten Person (`senden.ts`) –
 * in den Mails der übrigen bleiben sie leer. Ein Häkchen (`check`) fehlt: Was ChurchTools dafür einsetzt, ist nicht
 * gemessen.
 */
import { kurzname } from './bedingungen';
import { fragen } from './druckliste';
import { SYSTEMFELDER, type Feld, type OeffentlicheEinstellungen } from './formular';
import { freiMitText, freiSchluessel } from './freieAntwort';
import { PERSON_PLATZHALTER, htmlSicher } from './rundmail';

/**
 * **Text, der in eine Routine-Mail kommt** – HTML-sicher und ohne `{`, damit ChurchTools nichts davon als Platzhalter
 * liest; Zeilenumbrüche bleiben. Die EINE Stelle dafür (Einstellungen, eigener Absatz, Namen der Fragen).
 */
export function mailText(text: string): string {
  return htmlSicher(text).replace(/\{/g, '&#123;').split('\n').join('<br>');
}

/** Fragen, deren Antwort in eine Mail kann – die Spalten der Tabelle ohne Häkchen (nicht gemessen). */
export function mailFragen(e: OeffentlicheEinstellungen): Feld[] {
  return fragen(e).filter((f) => f.typ !== 'check');
}

/** Wie die Antwort einer Frage im Text heißt – `[Kurzname]`, wie in Regeln und Tabelle. */
export const antwortName = (f: Feld): string => kurzname(f);

/** Was sich außer den Antworten einfügen lässt (Entwurf: Anmelde-Nr.; Vorname wie in der Rundmail). */
const WEITERE = ['Vorname', SYSTEMFELDER.find((x) => x.id === 'nr')!.name] as const;

/** **Die Knöpfe „Antwort einfügen“** – jede Frage einmal (gleiche Kurznamen: die erste), dann Vorname und Nr. */
export function mailBausteinNamen(e: OeffentlicheEinstellungen): string[] {
  const namen = mailFragen(e).map(antwortName);
  return [...new Set([...namen, ...WEITERE])];
}

/** Der Platzhalter ohne Klammern – so steht er in `{{#if …}}`. */
const ohneKlammern = (ct: string) => ct.replace(/^\{+|\}+$/g, '');

/** Die Adresse aus der Person (F4: Straße, PLZ, Ort stehen dort) – nur, wenn eine Straße da ist. */
const ADRESSE = '{{{person.street}}}, {{{person.zip}}} {{{person.city}}}';
const ADRESSE_WENN = 'person.street';

/**
 * **Eine Antwort als Ausdruck für ChurchTools** – `wenn`: die Bedingung „ist beantwortet“, `wert`: was eingesetzt
 * wird. `null`: Die Spalte fehlt in ChurchTools (dann darf nichts geschrieben werden – die Mail zeigte sonst „[…]“).
 * Freie Antwort mit Text (F3): ihr Text statt der Beschriftung („Fotos“ statt „Sonstiges“), bei einer
 * Mehrfachauswahl dahinter in Klammern – die Liste selbst kann ChurchTools nicht umschreiben.
 */
function antwortAusdruck(
  f: Feld,
  e: OeffentlicheEinstellungen,
  ctPlatzhalter: ReadonlyMap<string, string>,
  spalten: ReadonlyMap<number, string>,
): { wenn: string; wert: string } | null {
  if (f.typ === 'adresse') return { wenn: ADRESSE_WENN, wert: ADRESSE };
  const platzhalter = (schluessel: string) => {
    const nr = e.ctFelder[schluessel];
    const name = nr === undefined ? undefined : spalten.get(nr);
    return name === undefined ? undefined : ctPlatzhalter.get(name);
  };
  const feld = platzhalter(f.id);
  if (!feld) return null;
  const frei = freiMitText(f) ? platzhalter(freiSchluessel(f.id)) : undefined;
  const wenn = ohneKlammern(feld);
  if (!frei) return { wenn, wert: feld };
  const fw = ohneKlammern(frei);
  return {
    wenn,
    wert:
      f.typ === 'multi'
        ? `${feld}{{#if ${fw}}} (${frei}){{/if}}`
        : `{{#if ${fw}}}${frei}{{else}}${feld}{{/if}}`,
  };
}

/** Was ein Name im Text wird: Ausdruck, `null` (Spalte fehlt) – fehlt der Name hier ganz, bleibt `[…]` Text. */
export type MailBausteine = ReadonlyMap<string, { wenn: string; wert: string } | null>;

/** **Alle Namen mit ihrem Ausdruck** – Antworten zuerst (gleicher Kurzname: die erste Frage), dann Vorname und Nr. */
export function mailBausteine(
  e: OeffentlicheEinstellungen,
  ctPlatzhalter: ReadonlyMap<string, string>,
  spalten: ReadonlyMap<number, string>,
): MailBausteine {
  const m = new Map<string, { wenn: string; wert: string } | null>();
  for (const f of mailFragen(e)) {
    const name = antwortName(f);
    if (!m.has(name)) m.set(name, antwortAusdruck(f, e, ctPlatzhalter, spalten));
  }
  for (const name of WEITERE) {
    if (m.has(name)) continue;
    const ct = PERSON_PLATZHALTER[name] ?? ctPlatzhalter.get(name);
    m.set(name, ct ? { wenn: ohneKlammern(ct), wert: ct } : null);
  }
  return m;
}

/**
 * **Der eigene Absatz mit eingefügten Antworten** – Leerzeilen trennen Absätze. `[Name]` aus `bausteine` wird zum
 * Platzhalter; alles andere (auch `[…]`, das niemand kennt) bleibt Text. Fehlt die Spalte einer Frage in
 * ChurchTools, steht ihr Name in `unbekannt`.
 */
export function absatzMitAntworten(
  text: string,
  bausteine: MailBausteine,
): { html: string; unbekannt: string[] } {
  const unbekannt = new Set<string>();
  const zeile = (a: string) =>
    a
      .split(/(\[[^[\]\n]+\])/)
      .map((teil) => {
        const name = /^\[([^[\]\n]+)\]$/.exec(teil)?.[1];
        if (name === undefined || !bausteine.has(name)) return mailText(teil);
        const b = bausteine.get(name);
        if (!b) {
          unbekannt.add(name);
          return '';
        }
        return b.wert;
      })
      .join('');
  const html = text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((a) => `<p>${zeile(a.trim())}</p>`)
    .join('');
  return { html, unbekannt: [...unbekannt] };
}

/**
 * **„Alle Angaben mitschicken“** – eine Tabelle aller Antworten der Person; was leer ist, fällt weg (`{{#if}}` je
 * Zeile). Jede Frage für sich, auch bei gleichem Kurznamen. Fehlt eine Spalte, steht ihr Name in `unbekannt`.
 */
export function alleAngaben(
  e: OeffentlicheEinstellungen,
  ctPlatzhalter: ReadonlyMap<string, string>,
  spalten: ReadonlyMap<number, string>,
): { html: string; unbekannt: string[] } {
  const unbekannt: string[] = [];
  const zeilen = mailFragen(e).map((f) => {
    const name = antwortName(f);
    const b = antwortAusdruck(f, e, ctPlatzhalter, spalten);
    if (!b) {
      unbekannt.push(name);
      return '';
    }
    return `{{#if ${b.wenn}}}<tr><td style="padding:2px 16px 2px 0;vertical-align:top">${mailText(name)}</td><td style="padding:2px 0">${b.wert}</td></tr>{{/if}}`;
  });
  if (!zeilen.length) return { html: '', unbekannt };
  return {
    html: `<p><b>Deine Angaben</b></p><table style="border-collapse:collapse">${zeilen.join('')}</table>`,
    unbekannt,
  };
}
