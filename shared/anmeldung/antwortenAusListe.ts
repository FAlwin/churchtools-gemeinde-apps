/**
 * **Antworten aus ChurchTools zurück** (Etappe F1e, Klick-Runde 6 am 16.11.2026) – was in ChurchTools steht, wieder
 * als Antworten des Formulars, damit dieselben Regeln (`bedingungen.ts`) auch für gespeicherte Anmeldungen gelten:
 *
 * - Die Nachprüfung meldet, was das Formular verhindert hätte – eine gesperrte Antwort, eine Antwort auf eine Frage,
 *   die nicht gezeigt worden wäre (`bedingungsBefunde`). Geändert wird nichts.
 * - „Person dazu“ (von Hand) startet mit den Kontakt-Antworten der Anmeldung – Fragen je Person, die auf eine
 *   Kontakt-Frage schauen, erscheinen dort wie im Formular.
 *
 * Der Rückweg spiegelt den Hinweg beim Absenden (`ctWert` in `senden.ts`) und liest über dieselbe Stelle wie
 * Fenster, Tabelle und Druckliste (`antwortText`).
 */
import type { Antwort, Antworten, Feld, OeffentlicheEinstellungen } from './formular';
import { bedingungSatz, feldSichtbar, kurzname, ungueltigeAntworten } from './bedingungen';
import { antwortText, mehrfachAntworten, type ListenAnmeldung, type Werte } from './liste';

/** Eine gespeicherte Antwort so, wie die Regeln sie erwarten: Ankreuzen als `true`, Mehrfachauswahl als Liste. */
function antwortAus(
  f: Feld,
  werte: Werte,
  ctFelder: OeffentlicheEinstellungen['ctFelder'],
): Antwort {
  const text = antwortText(f, werte, ctFelder);
  if (text === null) return undefined;
  if (f.typ === 'check') return true;
  if (f.typ === 'multi') return mehrfachAntworten(f, text);
  return text;
}

function teil(
  felder: Feld[],
  werte: Werte,
  ctFelder: OeffentlicheEinstellungen['ctFelder'],
): Record<string, Antwort> {
  const aus: Record<string, Antwort> = {};
  for (const f of felder) {
    const w = antwortAus(f, werte, ctFelder);
    if (w !== undefined) aus[f.id] = w;
  }
  return aus;
}

// Je Anmeldung einmal – Tabelle und Druckliste fragen Zelle für Zelle.
const zwischen = new WeakMap<ListenAnmeldung, { e: OeffentlicheEinstellungen; a: Antworten }>();

/**
 * **Die Antworten einer gespeicherten Anmeldung** – Kontakt-Fragen aus dem, was es einmal je Anmeldung gibt, Fragen je
 * Person aus ihren Werten. E-Mail und Geburtsdatum stehen an der Person in ChurchTools, nicht in Gruppenfeldern.
 */
export function antwortenAus(e: OeffentlicheEinstellungen, x: ListenAnmeldung): Antworten {
  const da = zwischen.get(x);
  if (da && da.e === e) return da.a;
  const mail = e.formular.anmeldung.find((f) => f.typ === 'email');
  const a: Antworten = {
    anmeldung: {
      ...teil(e.formular.anmeldung, x.einmal, e.ctFelder),
      ...(mail && x.email ? { [mail.id]: x.email } : {}),
    },
    personen: x.personen.map((p) => ({
      ...teil(e.formular.person, p.werte, e.ctFelder),
      ...(p.geburtstag ? { birth: p.geburtstag.slice(0, 10) } : {}),
    })),
  };
  zwischen.set(x, { e, a });
  return a;
}

/** Was das Formular verhindert hätte – eine Zeile der Nachprüfung. */
export interface Bedingungsbefund {
  /** Schlüssel der Anmeldung (Sprung ins Fenster). */
  schluessel: string;
  nr: string | null;
  /** Wen es betrifft: bei Fragen je Person die Person, sonst „Angemeldet von“. */
  name: string;
  /** `antwort` = eine gesperrte Antwort gewählt; `frage` = eine nicht gestellte Frage beantwortet. */
  art: 'antwort' | 'frage';
  frage: string;
  /** Bei `antwort`: die gewählte. */
  antwort?: string;
  /** Wann es erlaubt wäre: „„Taufe“ ist Ja“ (`bedingungSatz`). */
  bedingung: string;
  /** Bei `antwort`: der Hinweis neben der gesperrten Antwort, falls es einen gibt („nur für Getaufte“). */
  grund?: string;
}

/**
 * **Bedingungen in der Nachprüfung** (F1e, Klick-Runde 6: „Hinweis in der Nachprüfung“) – je Anmeldung, was gegen die
 * Bedingungen des Formulars steht. Entsteht nur, wenn jemand in ChurchTools von Hand etwas einträgt (das Formular
 * selbst lässt es nicht zu). Gewertet wird mit den Bedingungen von heute.
 */
export function bedingungsBefunde(
  e: OeffentlicheEinstellungen,
  anmeldungen: ListenAnmeldung[],
): Bedingungsbefund[] {
  const fo = e.formular;
  if (![...fo.anmeldung, ...fo.person].some((f) => f.bed || f.antwortBed)) return [];
  const aus: Bedingungsbefund[] = [];
  for (const x of anmeldungen) {
    const a = antwortenAus(e, x);
    const name = (person?: number) => {
      const p = person === undefined ? null : x.personen[person];
      return p ? `${p.vor} ${p.nach}`.trim() : x.wer;
    };
    const dazu = (
      f: Feld,
      person: number | undefined,
      b: Pick<Bedingungsbefund, 'art' | 'antwort' | 'bedingung' | 'grund'>,
    ) =>
      aus.push({
        schluessel: x.schluessel,
        nr: x.nr,
        name: name(person),
        frage: kurzname(f),
        ...b,
      });
    // Beantwortet, obwohl die Frage nicht gezeigt worden wäre (das Formular leert so etwas beim Absenden).
    const gestellt = (f: Feld, w: Antwort, person?: number) => {
      if (w !== undefined && f.bed && !feldSichtbar(fo, f, a, person))
        dazu(f, person, { art: 'frage', bedingung: bedingungSatz(fo, f.bed) });
    };
    for (const f of fo.anmeldung) gestellt(f, a.anmeldung[f.id]);
    a.personen.forEach((w, i) => fo.person.forEach((f) => gestellt(f, w[f.id], i)));
    // Eine gesperrte Antwort gewählt – dieselbe Prüfung wie im Formular (`ungueltigeAntworten`).
    for (const u of ungueltigeAntworten(fo, a)) {
      const person = /^personen\.(\d+)\./.exec(u.pfad)?.[1];
      const b = u.feld.antwortBed![u.antwort];
      const grund = b.art === 'grau' ? b.grund?.trim() : undefined;
      dazu(u.feld, person === undefined ? undefined : Number(person), {
        art: 'antwort',
        antwort: u.antwort,
        bedingung: bedingungSatz(fo, b),
        ...(grund ? { grund } : {}),
      });
    }
  }
  return aus;
}

/** Der Satz zu einem Befund: was steht und warum das Formular es nicht erlaubt hätte (F1e). */
export function bedingungsText(b: Bedingungsbefund): string {
  return b.art === 'antwort'
    ? `„${b.frage}“: „${b.antwort}“ gewählt – ${b.grund ?? `nur wählbar, wenn ${b.bedingung}`}`
    : `„${b.frage}“ beantwortet – die Frage erscheint nur, wenn ${b.bedingung}`;
}
