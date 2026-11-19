/**
 * **Die Team-Mail** (Etappe F7c, Entwurf `f7-mails-v1`, Klick-Runden 11 und 12, Messung M2) – nach dem Absenden schickt
 * das Formular über „Leiter kontaktieren“ (`POST /publicgroups/{id}/mailToLeaders`, ohne Login) eine Mail an alle Leiter
 * der Gruppe. Ohne Server-Teil (Alwin ausdrücklich).
 *
 * Gemessen M2 (18.11.2026): Betreff legt ChurchTools fest („Formularanfrage zur Gruppe …“), die Nachricht steht im
 * Kasten „Kommentar“ – **Zeilenumbrüche gehen verloren, HTML erscheint als Text**. Darum ist die Nachricht reiner Text
 * in einem Absatz, Teile getrennt mit „ | “. Absender ist die Person, die anmeldet: Antworten gehen an sie.
 *
 * Entschieden (Klick-Runde 12): eine Mail je Anmeldung, auch bei Warteliste (Stand je Person) und wenn jemand noch per
 * Mail bestätigen muss (mit Vermerk); alle Antworten an, die Leitung wählt ab. Bei „Von Hand“ gibt es keine.
 */
import { adresseText } from './adresse';
import { kurzname, leeren } from './bedingungen';
import { fragen } from './druckliste';
import {
  SYSTEMFELDER,
  type Antwort,
  type Antworten,
  type Feld,
  type OeffentlicheEinstellungen,
  type TeamMailEinstellung,
} from './formular';
import { freiAnzeige, freiText } from './freieAntwort';
import { MEHRFACH_TRENNER } from './liste';
import { erziehungText, type PersonErgebnis } from './senden';

/** Ohne Einstellung: an, ohne eigenen Text, alle Antworten (Alwin: Standard an). */
export const TEAM_STANDARD: TeamMailEinstellung = { an: true, text: '', ohne: [] };

/** Die Team-Mail einer Veranstaltung – fehlt die Einstellung, der Standard. */
export const teamMailVon = (e: Pick<OeffentlicheEinstellungen, 'teamMail'>): TeamMailEinstellung =>
  e.teamMail ?? TEAM_STANDARD;

/** Die Fragen, die mitkommen können – dieselben wie die Spalten der Tabelle (samt Adresse). */
export const teamFragen = (e: OeffentlicheEinstellungen): Feld[] => fragen(e);

/** Was sich in den eigenen Text einfügen lässt: jede Frage (Kurzname, gleiche nur einmal) und die Anmelde-Nr. */
export function teamBausteinNamen(e: OeffentlicheEinstellungen): string[] {
  const nr = SYSTEMFELDER.find((x) => x.id === 'nr')!.name;
  return [...new Set([...teamFragen(e).map((f) => kurzname(f)), nr])];
}

/**
 * **Eine Antwort aus dem Formular als Text** – wie sie in der Team-Mail steht: Ankreuzen „ja“, Mehrfachauswahl mit
 * `MEHRFACH_TRENNER`, die freie Antwort als ihr Text (wie in Tabelle und Druckliste, `freiAnzeige`), Adresse und
 * Erziehungsberechtigte lesbar, die Unterschrift nur als „unterschrieben“. `null`: nicht beantwortet.
 */
export function antwortAlsText(f: Feld, teil: Record<string, Antwort>): string | null {
  const w = teil[f.id];
  if (w === undefined || w === '' || w === false) return null;
  const frei = (a: string) => freiAnzeige(f, a, freiText(teil, f.id));
  switch (f.typ) {
    case 'check':
      return 'ja';
    case 'adresse':
      return adresseText(w) || null;
    case 'erziehungsberechtigte':
      return erziehungText(w);
    case 'unterschrift':
      return 'unterschrieben';
    case 'multi':
      return Array.isArray(w) && w.length ? w.map(frei).join(MEHRFACH_TRENNER) : null;
    default:
      return typeof w === 'string' && w.trim() ? frei(w.trim()) : null;
  }
}

/** Wer in dieser Anmeldung angekommen ist – je Person ihr Stand. Offen gebliebene gehören nicht in die Team-Mail. */
export interface TeamPerson {
  index: number;
  name: string;
  ergebnis: PersonErgebnis;
}

const STAND: Partial<Record<PersonErgebnis, string>> = {
  angemeldet: 'Platz',
  warteliste: 'Warteliste',
  bestaetigen: 'muss die Anmeldung noch per Mail bestätigen',
};

/** Personen, die in die Team-Mail gehören: angemeldet, auf der Warteliste oder noch zu bestätigen. */
export const teamPersonen = (personen: readonly TeamPerson[]): TeamPerson[] =>
  personen.filter((p) => STAND[p.ergebnis] !== undefined);

/**
 * **Die Nachricht der Team-Mail** – reiner Text in einem Absatz (ChurchTools übernimmt keine Umbrüche): eigener Text
 * mit gefüllten `[Frage]`, Anmelde-Nr., die Antworten zur Anmeldung, dann je Person Name, Stand und ihre Antworten.
 * Ausgeblendetes zählt nicht (`leeren`, wie beim Absenden). `wert` ersetzt die Antworten – für die Vorschau im Fenster.
 */
export function teamMailText(
  e: OeffentlicheEinstellungen,
  roh: Antworten,
  personen: readonly TeamPerson[],
  nr?: string,
  wert: (f: Feld, teil: Record<string, Antwort>) => string | null = antwortAlsText,
): string {
  const a = leeren(e.formular, roh);
  const t = teamMailVon(e);
  const jePerson = (f: Feld) => e.formular.person.includes(f);
  const dabei = teamPersonen(personen);
  const teilVon = (p: TeamPerson) => a.personen[p.index] ?? {};
  const nrName = SYSTEMFELDER.find((x) => x.id === 'nr')!.name;

  /** `[Frage]` → die Antwort; je Person die verschiedenen Antworten aller Personen. Unbekanntes bleibt stehen. */
  const eigen = t.text
    .replace(/\[([^[\]\n]+)\]/g, (ganz, name: string) => {
      if (name === nrName) return nr ?? '–';
      const f = teamFragen(e).find((x) => kurzname(x) === name);
      if (!f) return ganz;
      const werte = jePerson(f) ? dabei.map((p) => wert(f, teilVon(p))) : [wert(f, a.anmeldung)];
      const da = [...new Set(werte.filter((x): x is string => !!x))];
      return da.length ? da.join(', ') : '–';
    })
    .replace(/\s*\n\s*/g, ' ')
    .trim();

  const mit = teamFragen(e).filter((f) => !t.ohne.includes(f.id));
  const zeile = (felder: Feld[], teil: Record<string, Antwort>) =>
    felder
      .map((f) => {
        const x = wert(f, teil);
        return x === null ? null : `${kurzname(f)}: ${x.replace(/\s*\n\s*/g, ', ')}`;
      })
      .filter((x): x is string => !!x)
      .join('; ');

  const teile: string[] = [];
  if (eigen) teile.push(eigen);
  if (nr) teile.push(`${nrName} ${nr}`);
  const einmal = zeile(
    mit.filter((f) => !jePerson(f)),
    a.anmeldung,
  );
  if (einmal) teile.push(einmal);
  for (const p of dabei) {
    const z = zeile(mit.filter(jePerson), teilVon(p));
    teile.push(`${p.name} (${STAND[p.ergebnis]})${z ? `: ${z}` : ''}`);
  }
  if (dabei.some((p) => p.ergebnis === 'bestaetigen'))
    teile.push(
      'Die Person muss ihre Anmeldung noch per Mail bestätigen – erst dann ist sie angemeldet.',
    );
  return teile.join(' | ');
}
