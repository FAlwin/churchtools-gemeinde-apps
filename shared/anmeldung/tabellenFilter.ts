/**
 * **Filter in der Tabelle der Anmeldungen** (R2, Entwurf `r2-u3-filter-ansichten-v1`, abgenommen 23.11.2026) – welche
 * Spalte wie gefiltert wird, was ein Filter anbietet und **ob eine Anmeldung bzw. Person zum Filter passt**.
 *
 * Eine Regel, eine Stelle: Tabelle, Summen, Reiter-Zähler, Rundmail und Druckliste fragen alle hier (`passtAnmeldung`,
 * `passtPerson`, `gefilterteListe`). Mehrere Filter gelten zusammen („und“), mehrere Antworten in einem Filter heißen
 * „eine davon“ („oder“).
 *
 * **Je Person** (Entscheidungsliste E4): Ein Filter auf eine Frage je Person (und auf Status/Alter) prüft die einzelne
 * Person. „Je Anmeldung“ zählt eine Anmeldung, wenn **mindestens eine Person** alle Personen-Filter erfüllt; Filter auf
 * Angaben der Anmeldung (Betrag, Mitfahrt …) prüfen in beiden Ansichten die Anmeldung.
 */
import type { Feld, OeffentlicheEinstellungen, SpaltenFilter } from './formular';
import { frageAntwort, frageAntwortRoh, frageSchluessel, fragen } from './druckliste';
import { kurzname, wahlAntworten } from './bedingungen';
import { mehrfachAnzeigeTeile, type ListenAnmeldung, type ListenPerson } from './liste';
import { spaltenKatalog, zahlAus } from './tabelle';
import { zahlText } from './feldwert';
import { AMPEL_TEXT, ampelDerPerson, nachweisArtVon, type AmpelWert } from './nachweisAmpel';

export type { SpaltenFilter };

/** Wie eine Spalte gefiltert wird – `null`: gar nicht (Name und Nr. findet die Suche, Datumsspalten bleiben ohne). */
export type FilterArt = 'antworten' | 'zahl' | 'text';

const MIT_ANTWORTEN = new Set<Feld['typ']>(['janein', 'radio', 'select', 'multi', 'check']);

const frageZu = (e: OeffentlicheEinstellungen, spalte: string) =>
  fragen(e).find((f) => frageSchluessel(f) === spalte);

/** **Wie eine Spalte gefiltert wird** – nach der Art der Frage bzw. der festen Spalte. */
export function filterArt(e: OeffentlicheEinstellungen, spalte: string): FilterArt | null {
  const art = nachweisArtVon(spalte);
  if (art !== null)
    return (e.nachweise ?? []).some((b) => b.artGruppeId === art) ? 'antworten' : null;
  switch (spalte) {
    case 'bezahlt':
    case 'status':
      return 'antworten';
    case 'personen':
    case 'betrag':
    case 'alter':
      return 'zahl';
    case 'kontakt':
      return 'text';
  }
  const f = frageZu(e, spalte);
  if (!f) return null;
  if (MIT_ANTWORTEN.has(f.typ)) return 'antworten';
  return f.typ === 'number' ? 'zahl' : 'text';
}

const ANGEKREUZT = 'angekreuzt';
const NICHT_ANGEKREUZT = 'nicht angekreuzt';

/**
 * **Die Antworten der Nachweis-Spalte** (N3d): fest, unabhängig von den geladenen Daten – sonst fielen gespeicherte Filter
 * einer Ansicht (U3, `filterBereinigt`) weg, solange der Stand noch lädt. „Stand nicht lesbar“ und „Bedingung prüfen“ kommen
 * dazu, wenn es sie in dieser Veranstaltung gibt.
 */
function nachweisAntworten(e: OeffentlicheEinstellungen, art: number): string[] {
  const feste: AmpelWert[] = [
    'fehlt',
    'abgelaufen',
    'nochNicht',
    'laeuftAb',
    'gueltig',
    'nichtNoetig',
  ];
  const lage = e.nachweisLage?.arten.get(art);
  return [
    ...feste,
    ...(lage?.nichtLesbar ? (['nichtLesbar'] as const) : []),
    ...(lage?.bedingungKaputt ? (['bedingung'] as const) : []),
  ].map((w) => AMPEL_TEXT[w]);
}

/** **Die Antworten zur Wahl** – in der Reihenfolge des Formulars (die freie Antwort unter ihrer Beschriftung, F3). */
export function filterAntworten(e: OeffentlicheEinstellungen, spalte: string): string[] {
  const art = nachweisArtVon(spalte);
  if (art !== null) return nachweisAntworten(e, art);
  if (spalte === 'bezahlt') return ['bezahlt', 'offen'];
  if (spalte === 'status') return ['Platz', 'Warteliste'];
  const f = frageZu(e, spalte);
  if (!f) return [];
  if (f.typ === 'janein') return ['Ja', 'Nein'];
  if (f.typ === 'check') return [ANGEKREUZT, NICHT_ANGEKREUZT];
  return [...wahlAntworten(f), ...(f.verborgen ?? [])];
}

/** Steht die Spalte an der Person (Status, Alter, Fragen je Person)? Dann prüft der Filter je Person (E4). */
export function personenSpalte(e: OeffentlicheEinstellungen, spalte: string): boolean {
  if (spalte === 'status' || spalte === 'alter' || nachweisArtVon(spalte) !== null) return true;
  const f = frageZu(e, spalte);
  return !!f && e.formular.person.includes(f);
}

/** **Der Name der Spalte** auf dem Chip und über dem Filterfenster – Fragen mit ihrem Kurznamen (sonst gekürzt). */
export function filterName(e: OeffentlicheEinstellungen, spalte: string): string {
  const f = frageZu(e, spalte);
  if (f) return kurzname(f, 30);
  const s = [...spaltenKatalog(e, 'anmeldung'), ...spaltenKatalog(e, 'person')].find(
    (k) => k.schluessel === spalte,
  );
  return s?.titel ?? spalte;
}

/** **Was auf dem Chip steht** – „Küche oder Technik“, „ab 3“, „50–100 €“, „enthält „Nuss““. */
export function filterText(f: SpaltenFilter): string {
  if ('werte' in f) return f.werte.join(' oder ');
  if ('text' in f)
    return f.text === 'ausgefuellt'
      ? 'ausgefüllt'
      : f.text === 'leer'
        ? 'leer'
        : `enthält „${f.suche ?? ''}“`;
  const euro = f.spalte === 'betrag' ? ' €' : '';
  if (f.ab !== null && f.bis !== null) return `${zahlText(f.ab)}–${zahlText(f.bis)}${euro}`;
  return f.ab !== null ? `ab ${zahlText(f.ab)}${euro}` : `bis ${zahlText(f.bis ?? 0)}${euro}`;
}

/** Ist der Filter vollständig? (Mindestens eine Antwort, eine Grenze, bei „enthält“ ein Wort.) */
export function filterVollstaendig(f: SpaltenFilter): boolean {
  if ('werte' in f) return f.werte.length > 0;
  if ('text' in f) return f.text !== 'enthaelt' || (f.suche ?? '').trim() !== '';
  return f.ab !== null || f.bis !== null;
}

/**
 * **Gemerkte Filter bereinigen** (U3) – wie die Spaltenwahl (`nurVorhandene`): Ist die Frage gelöscht oder hat sie die
 * Art gewechselt, fällt der Filter still weg; entfernte Antworten fallen aus dem Filter (bleibt keine, fällt er weg).
 */
export function filterBereinigt(
  e: OeffentlicheEinstellungen,
  filter: SpaltenFilter[],
): SpaltenFilter[] {
  return filter.flatMap((f): SpaltenFilter[] => {
    const art = filterArt(e, f.spalte);
    if ('werte' in f) {
      if (art !== 'antworten') return [];
      const da = new Set(filterAntworten(e, f.spalte));
      const werte = f.werte.filter((w) => da.has(w));
      return werte.length ? [{ spalte: f.spalte, werte }] : [];
    }
    if ('text' in f) return art === 'text' && filterVollstaendig(f) ? [f] : [];
    return art === 'zahl' && filterVollstaendig(f) ? [f] : [];
  });
}

/** Die Antworten einer Anmeldung bzw. Person in dieser Spalte (Filter-Art „antworten“). */
function antwortenVon(
  e: OeffentlicheEinstellungen,
  spalte: string,
  x: ListenAnmeldung,
  p: ListenPerson | null,
): string[] {
  if (spalte === 'bezahlt')
    return x.bezahlt && (x.betragCent ?? 0) > 0 ? ['bezahlt'] : x.zahlungOffen ? ['offen'] : [];
  if (spalte === 'status') return p ? [p.status === 'wartet' ? 'Warteliste' : 'Platz'] : [];
  if (nachweisArtVon(spalte) !== null) {
    const a = p ? ampelDerPerson(e.nachweisLage, spalte, p.personId) : null;
    return a ? [AMPEL_TEXT[a.wert]] : [];
  }
  const f = frageZu(e, spalte);
  if (!f) return [];
  const roh = frageAntwortRoh(e, f, x, p);
  if (f.typ === 'check') return [roh ? ANGEKREUZT : NICHT_ANGEKREUZT];
  if (roh === null || roh === '') return [];
  return f.typ === 'multi' ? mehrfachAnzeigeTeile(f, roh) : [roh];
}

/** Die Zahl einer Anmeldung bzw. Person in dieser Spalte (Filter-Art „zahl“) – Beträge in Euro. */
function zahlVon(
  e: OeffentlicheEinstellungen,
  spalte: string,
  x: ListenAnmeldung,
  p: ListenPerson | null,
): number | null {
  if (spalte === 'personen') return x.personen.length;
  if (spalte === 'betrag') return x.betragCent === null ? null : x.betragCent / 100;
  if (spalte === 'alter') return p?.alter ?? null;
  const f = frageZu(e, spalte);
  return f ? zahlAus(frageAntwort(e, f, x, p)) : null;
}

/** Der Text einer Anmeldung bzw. Person in dieser Spalte (Filter-Art „text“) – wie er in der Zelle steht. */
function textVon(
  e: OeffentlicheEinstellungen,
  spalte: string,
  x: ListenAnmeldung,
  p: ListenPerson | null,
): string {
  if (spalte === 'kontakt') return x.wer;
  const f = frageZu(e, spalte);
  return f ? (frageAntwort(e, f, x, p) ?? '') : '';
}

/** Passt diese Anmeldung bzw. Person zu EINEM Filter? */
function passtEinem(
  e: OeffentlicheEinstellungen,
  f: SpaltenFilter,
  x: ListenAnmeldung,
  p: ListenPerson | null,
): boolean {
  if ('werte' in f) {
    const da = antwortenVon(e, f.spalte, x, p);
    return f.werte.some((w) => da.includes(w));
  }
  if ('text' in f) {
    const t = textVon(e, f.spalte, x, p).trim();
    if (f.text === 'ausgefuellt') return t !== '';
    if (f.text === 'leer') return t === '';
    return t.toLowerCase().includes((f.suche ?? '').trim().toLowerCase());
  }
  const n = zahlVon(e, f.spalte, x, p);
  if (n === null) return false;
  return (f.ab === null || n >= f.ab) && (f.bis === null || n <= f.bis);
}

/** Erfüllt die Person alle Filter (die der Person an ihr, die der Anmeldung an der Anmeldung)? */
export function passtPerson(
  e: OeffentlicheEinstellungen,
  filter: SpaltenFilter[],
  { x, p }: { x: ListenAnmeldung; p: ListenPerson },
): boolean {
  return filter.every((f) => passtEinem(e, f, x, personenSpalte(e, f.spalte) ? p : null));
}

/**
 * **Passt die Anmeldung?** Die Filter der Anmeldung an der Anmeldung; gibt es Filter je Person, muss **eine** Person sie
 * alle erfüllen (E4).
 */
export function passtAnmeldung(
  e: OeffentlicheEinstellungen,
  filter: SpaltenFilter[],
  x: ListenAnmeldung,
): boolean {
  const jePerson = filter.filter((f) => personenSpalte(e, f.spalte));
  const anmeldung = filter.filter((f) => !personenSpalte(e, f.spalte));
  return (
    anmeldung.every((f) => passtEinem(e, f, x, null)) &&
    (jePerson.length === 0 || x.personen.some((p) => jePerson.every((f) => passtEinem(e, f, x, p))))
  );
}

/**
 * **Die gefilterten Anmeldungen für Rundmail und Druckliste** („nehmen immer das Gefilterte“, Klick-Runde 23.11.2026):
 * nur passende Anmeldungen, und darin nur die Personen, die die Filter je Person erfüllen – auf der Küchenliste mit
 * „Allergien: ausgefüllt“ steht nicht die ganze Familie.
 */
export function gefilterteListe(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  filter: SpaltenFilter[],
): ListenAnmeldung[] {
  if (filter.length === 0) return liste;
  const mitPerson = filter.some((f) => personenSpalte(e, f.spalte));
  return liste
    .filter((x) => passtAnmeldung(e, filter, x))
    .map((x) =>
      mitPerson
        ? { ...x, personen: x.personen.filter((p) => passtPerson(e, filter, { x, p })) }
        : x,
    );
}

/** Ein Filter mit genau dieser Spalte ersetzt (oder angehängt); mit `null` entfernt. Die Reihenfolge der Chips bleibt. */
export function filterSetzen(
  filter: SpaltenFilter[],
  spalte: string,
  neu: SpaltenFilter | null,
): SpaltenFilter[] {
  const da = filter.some((f) => f.spalte === spalte);
  if (!neu) return filter.filter((f) => f.spalte !== spalte);
  return da ? filter.map((f) => (f.spalte === spalte ? neu : f)) : [...filter, neu];
}
