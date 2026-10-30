/**
 * **Die Tabelle der Anmeldungen** (U2-1, Entwurf `u2-tabelle-v1`, abgenommen 29.10.2026) – welche Spalten es gibt,
 * was in einer Zelle steht, wie sortiert wird und was die Summenzeile zählt. Ohne Oberfläche; die Erweiterung zeichnet
 * daraus `AnmeldungenTabelle.tsx`.
 *
 * Eine Regel, eine Stelle: Die Fragen kommen aus demselben Katalog wie die Druckliste (`fragen`, `frageAntwort`), die
 * Beträge aus `listenZahlen` – dieselbe Zählung wie Kacheln, Startseite und Rundmail.
 */
import { tagPunkt } from '../ct/datum';
import type { Feld, OeffentlicheEinstellungen } from './formular';
import {
  frageAntwort,
  frageSchluessel,
  fragen,
  teilnehmerSpalten,
  teilnehmerZelle,
} from './druckliste';
import { listenZahlen, type ListenAnmeldung, type ListenPerson } from './liste';
import { altersregel, euroText } from './preis';

export interface TabellenSpalte {
  schluessel: string;
  titel: string;
  /** Rechtsbündig (Zahlen, Beträge). */
  zahl: boolean;
}

/** Eine Summe: der Wert und darunter klein, was er bedeutet (`null` = leere Zelle). */
export interface Summe {
  text: string;
  klein?: string;
}

export type Sortierung = { schluessel: string; absteigend: boolean } | null;

/** Die Fragen, die einmal je Anmeldung gestellt werden – Personenfragen kommen mit „je Person“ (U2-2). */
function anmeldungsFragen(e: OeffentlicheEinstellungen): Feld[] {
  return fragen(e).filter((f) => e.formular.anmeldung.includes(f));
}

const ZAHL_TYPEN = new Set<Feld['typ']>(['number']);

/**
 * **Die Spalten je Anmeldung** – noch ohne Wahl (die kommt mit U2-3): Name, Nr., auf der Warteliste der Warteplatz,
 * Personen, jede Frage der Anmeldung, Betrag und Bezahlt (nur wenn etwas kosten kann), Angemeldet am.
 */
export function anmeldungsSpalten(
  e: OeffentlicheEinstellungen,
  { kostet, warteliste }: { kostet: boolean; warteliste: boolean },
): TabellenSpalte[] {
  const s = (schluessel: string, titel: string, zahl = false) => ({ schluessel, titel, zahl });
  return [
    s('name', 'Name'),
    s('nr', 'Nr.'),
    ...(warteliste ? [s('warteplatz', 'Warteplatz', true)] : []),
    s('personen', 'Personen'),
    ...anmeldungsFragen(e).map((f) => s(frageSchluessel(f), f.frage, ZAHL_TYPEN.has(f.typ))),
    ...(kostet ? [s('betrag', 'Betrag', true), s('bezahlt', 'Bezahlt')] : []),
    s('am', 'Angemeldet am'),
  ];
}

const mitPlatz = (x: ListenAnmeldung) => x.personen.filter((p) => p.status === 'aktiv');
const ersterWarteplatz = (x: ListenAnmeldung) =>
  Math.min(...x.personen.map((p) => (p.status === 'wartet' ? (p.warteplatz ?? 999) : 999)));

const frageVon = (e: OeffentlicheEinstellungen, schluessel: string) =>
  anmeldungsFragen(e).find((f) => frageSchluessel(f) === schluessel);

/** Eine Zahl aus einem Zahlenfeld („3“, „2,5“) – `null`, wenn keine. */
function zahlAus(text: string | null): number | null {
  if (text === null || text.trim() === '') return null;
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * **Die gewählten Antworten einer Mehrfachauswahl** – ChurchTools speichert sie als Text „Fr, Sa“ (A0). Gesucht wird
 * jede bekannte Antwort als ganzes Stück, damit „Sa, So“ nicht in „Sa“ und „So“ zerfällt, wenn eine Antwort selbst ein
 * Komma enthält.
 */
export function mehrfachAntworten(f: Feld, text: string | null): string[] {
  if (!text) return [];
  const rein = `, ${text}, `;
  return [...f.antworten, ...(f.verborgen ?? [])].filter((a) => rein.includes(`, ${a}, `));
}

/** Was in der Zelle steht – nur Text; Personen, Bezahlt und Name zeichnet die Erweiterung selbst. */
export function zellText(
  e: OeffentlicheEinstellungen,
  schluessel: string,
  x: ListenAnmeldung,
): string {
  switch (schluessel) {
    case 'name':
      return x.wer;
    case 'nr':
      return x.nr ?? '';
    case 'warteplatz': {
      const w = ersterWarteplatz(x);
      return w === 999 ? '' : String(w);
    }
    case 'am':
      return x.angemeldetAm ? tagPunkt(x.angemeldetAm) : '';
    case 'betrag':
      return x.betragCent === null ? '' : euroText(x.betragCent);
  }
  const f = frageVon(e, schluessel);
  return f ? (frageAntwort(e, f, x, null) ?? '') : '';
}

/** Wonach eine Spalte sortiert – Zahlen als Zahl, sonst Text; `null` steht immer hinten. */
function sortWert(
  e: OeffentlicheEinstellungen,
  schluessel: string,
  x: ListenAnmeldung,
): string | number | null {
  switch (schluessel) {
    case 'personen':
      return mitPlatz(x).length;
    case 'warteplatz': {
      const w = ersterWarteplatz(x);
      return w === 999 ? null : w;
    }
    case 'am':
      return x.angemeldetAm;
    case 'betrag':
      return x.betragCent;
    case 'bezahlt':
      return x.betragCent === null || x.betragCent <= 0 ? null : x.bezahlt ? 1 : 0;
  }
  const f = frageVon(e, schluessel);
  if (f && ZAHL_TYPEN.has(f.typ)) return zahlAus(frageAntwort(e, f, x, null));
  const t = zellText(e, schluessel, x);
  return t === '' ? null : t;
}

const deutsch = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

/**
 * **Sortieren** – ohne Wahl bleibt die Reihenfolge der Liste (Anmeldetag), auf der Warteliste nach dem Warteplatz.
 * Leere Zellen stehen in beiden Richtungen hinten; Gleiches behält seine Reihenfolge.
 */
export function sortiert(
  e: OeffentlicheEinstellungen,
  liste: ListenAnmeldung[],
  sortierung: Sortierung,
  warteliste = false,
): ListenAnmeldung[] {
  return ordnen(liste, (k, x) => sortWert(e, k, x), sortierung, warteliste);
}

/** Die eine Sortier-Regel für beide Ansichten (je Anmeldung, je Person). */
function ordnen<Z>(
  liste: Z[],
  wert: (schluessel: string, z: Z) => string | number | null,
  sortierung: Sortierung,
  warteliste: boolean,
): Z[] {
  const s = sortierung ?? (warteliste ? { schluessel: 'warteplatz', absteigend: false } : null);
  if (!s) return liste;
  const werte = new Map(liste.map((x) => [x, wert(s.schluessel, x)]));
  return [...liste].sort((u, w) => {
    const a = werte.get(u)!;
    const b = werte.get(w)!;
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    const d =
      typeof a === 'number' && typeof b === 'number'
        ? a - b
        : deutsch.compare(String(a), String(b));
    return s.absteigend ? -d : d;
  });
}

/**
 * Wessen Antworten die Summen zählen: wer einen Platz hat – nur wenn alle gezeigten warten (Reiter Warteliste), die
 * Wartenden. Sonst zählten Zeltplätze und Mitfahrten derer mit, die noch gar nicht kommen.
 */
function zaehlbar(liste: ListenAnmeldung[]): ListenAnmeldung[] {
  const mit = liste.filter((x) => mitPlatz(x).length > 0);
  return mit.length > 0 ? mit : liste;
}

const zahlText = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/** **Die Summe einer Frage** nach ihrer Art (Entscheidung 3, 29.10.2026); `wer` zählt bei Auswahl je Antwort. */
export function frageSumme(
  f: Feld,
  antworten: (string | null)[],
  wer: 'Anmeldungen' | 'Personen' = 'Anmeldungen',
): Summe | null {
  const da = antworten.filter((a): a is string => a !== null && a !== '');
  switch (f.typ) {
    case 'number':
      return { text: zahlText(da.reduce((s, a) => s + (zahlAus(a) ?? 0), 0)) };
    case 'janein':
      return { text: `${da.filter((a) => a === 'Ja').length}× Ja` };
    case 'check':
      return { text: `${da.length}× angekreuzt` };
    case 'radio':
    case 'select':
    case 'multi': {
      const je = new Map<string, number>();
      for (const a of da)
        for (const k of f.typ === 'multi' ? mehrfachAntworten(f, a) : [a])
          je.set(k, (je.get(k) ?? 0) + 1);
      const reihe = [...f.antworten, ...(f.verborgen ?? [])];
      const teile = reihe.filter((k) => je.get(k)).map((k) => `${k} ${je.get(k)}`);
      // Antworten, die es im Formular nicht (mehr) gibt, hinten – sie stehen ja in ChurchTools.
      for (const [k, n] of je) if (!reihe.includes(k)) teile.push(`${k} ${n}`);
      return teile.length ? { text: teile.join(' · '), klein: `${wer} je Antwort` } : null;
    }
    default:
      return { text: `${da.length} ausgefüllt` };
  }
}

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

/**
 * **Die Summenzeile** zu den gezeigten Anmeldungen. Personen: mit Platz, Wartende als „+ n“. Beträge aus
 * `listenZahlen` (gesamt = offen + eingegangen). Fragen nach ihrer Art, nur von Anmeldungen mit Platz (`zaehlbar`).
 */
export function summe(
  e: OeffentlicheEinstellungen,
  schluessel: string,
  liste: ListenAnmeldung[],
): Summe | null {
  switch (schluessel) {
    case 'name':
      return { text: anzahl(liste.length, 'Anmeldung', 'Anmeldungen') };
    case 'personen': {
      const z = listenZahlen(e, liste);
      return {
        text: anzahl(z.belegt, 'Person', 'Personen'),
        ...(z.wartend ? { klein: `+ ${z.wartend} auf der Warteliste` } : {}),
      };
    }
    case 'betrag': {
      const z = listenZahlen(e, liste);
      return {
        text: euroText(z.offenCent + z.eingegangenCent),
        klein: `${euroText(z.offenCent)} offen · ${euroText(z.eingegangenCent)} eingegangen`,
      };
    }
    case 'bezahlt':
      return {
        text: `${liste.filter((x) => x.bezahlt && (x.betragCent ?? 0) > 0).length}× bezahlt`,
      };
  }
  const f = frageVon(e, schluessel);
  if (!f) return null;
  return frageSumme(
    f,
    zaehlbar(liste).map((x) => frageAntwort(e, f, x, null)),
  );
}

/** **Suchen** – Name der Anmeldung, Anmelde-Nr. und jede Person; ohne Suchtext alle. Auch für Absagen (nur Name). */
export function passtZurSuche(
  x: { wer: string; nr: string | null; personen: { vor: string; nach: string }[] },
  suche: string,
): boolean {
  const q = suche.trim().toLowerCase();
  if (!q) return true;
  return [x.wer, x.nr, ...x.personen.map((p) => `${p.vor} ${p.nach}`)].some((t) =>
    t?.toLowerCase().includes(q),
  );
}

// ── Je Person (U2-2) ──────────────────────────────────────────────────────────────────────────

/** Eine Zeile der Tabelle „je Person“: die Person und ihre Anmeldung (Betrag, Kontakt, Fragen der Anmeldung). */
export interface PersonZeile {
  x: ListenAnmeldung;
  p: ListenPerson;
}

/** Jede Person jeder Anmeldung – in der Reihenfolge der Liste, die erste Person zuerst. */
export function personZeilen(liste: ListenAnmeldung[]): PersonZeile[] {
  return liste.flatMap((x) => x.personen.map((p) => ({ x, p })));
}

const personenFrage = (e: OeffentlicheEinstellungen, schluessel: string) =>
  fragen(e).find((f) => e.formular.person.includes(f) && frageSchluessel(f) === schluessel);

/**
 * **Die Spalten je Person** – noch ohne Wahl (U2-3): Vor- und Nachname, auf der Warteliste der Warteplatz, Status,
 * dann aus dem Katalog der Druckliste (`teilnehmerSpalten`) Alter und jede Frage der Person, „Angemeldet von“ und die
 * Anmelde-Nr.; Betrag und Bezahlt sind die der Anmeldung (einen Preis je Person kennt ChurchTools nicht, Bauplan U2-2).
 * Fragen der Anmeldung stehen in dieser Ansicht erst zur Wahl (U2-3).
 */
export function personenSpalten(
  e: OeffentlicheEinstellungen,
  { kostet, warteliste }: { kostet: boolean; warteliste: boolean },
): TabellenSpalte[] {
  const s = (schluessel: string, titel: string, zahl = false) => ({ schluessel, titel, zahl });
  const katalog = teilnehmerSpalten(e);
  const aus = (pruefe: (k: string) => boolean) =>
    katalog
      .filter((k) => pruefe(k.schluessel))
      .map((k) =>
        s(
          k.schluessel,
          k.titel,
          k.schluessel === 'alter' || ZAHL_TYPEN.has(personenFrage(e, k.schluessel)?.typ ?? 'text'),
        ),
      );
  return [
    s('vor', 'Vorname'),
    s('nach', 'Nachname'),
    ...(warteliste ? [s('warteplatz', 'Warteplatz', true)] : []),
    s('status', 'Status'),
    ...aus((k) => k === 'alter' || !!personenFrage(e, k)),
    ...aus((k) => k === 'kontakt' || k === 'nr'),
    ...(kostet ? [s('betrag', 'Betrag der Anmeldung', true), s('bezahlt', 'Bezahlt')] : []),
  ];
}

/** Was in der Zelle steht – Status und Bezahlt zeichnet die Erweiterung selbst. */
export function personZellText(
  e: OeffentlicheEinstellungen,
  schluessel: string,
  { x, p }: PersonZeile,
): string {
  switch (schluessel) {
    case 'vor':
      return p.vor;
    case 'nach':
      return p.nach;
    case 'warteplatz':
      return p.status === 'wartet' && p.warteplatz ? String(p.warteplatz) : '';
    case 'status':
      return p.status === 'wartet' ? 'Warteliste' : 'Platz';
    case 'betrag':
      return x.betragCent === null ? '' : euroText(x.betragCent);
  }
  return teilnehmerZelle(e, schluessel, x, p);
}

function personSortWert(
  e: OeffentlicheEinstellungen,
  schluessel: string,
  z: PersonZeile,
): string | number | null {
  switch (schluessel) {
    case 'alter':
      return z.p.alter;
    case 'warteplatz':
      return z.p.status === 'wartet' ? (z.p.warteplatz ?? null) : null;
    case 'status':
      return z.p.status === 'wartet' ? 1 : 0;
    case 'betrag':
    case 'bezahlt':
      return sortWert(e, schluessel, z.x);
  }
  const f = personenFrage(e, schluessel);
  if (f && ZAHL_TYPEN.has(f.typ)) return zahlAus(frageAntwort(e, f, z.x, z.p));
  const t = personZellText(e, schluessel, z);
  return t === '' ? null : t;
}

/** **Sortieren je Person** – wie je Anmeldung (`ordnen`); ohne Wahl die Reihenfolge der Liste. */
export function personenSortiert(
  e: OeffentlicheEinstellungen,
  zeilen: PersonZeile[],
  sortierung: Sortierung,
  warteliste = false,
): PersonZeile[] {
  return ordnen(zeilen, (k, z) => personSortWert(e, k, z), sortierung, warteliste);
}

/** Jede Anmeldung einmal – Beträge gehören der Anmeldung, nicht der Person. */
const anmeldungenVon = (zeilen: PersonZeile[]) => [...new Set(zeilen.map((z) => z.x))];

/**
 * **Personen nach Alter** – in den Altersstufen der Preise (`altersregel`, dieselbe Regel wie die Rechnung); ohne
 * Altersstufen keine Summe. Wer in keine Stufe fällt, steht unter „übrige“, ohne bekanntes Alter zählt niemand.
 */
function altersSumme(e: OeffentlicheEinstellungen, zeilen: PersonZeile[]): Summe | null {
  const stufen = [...e.preis.alter].sort((u, w) => u.von - w.von);
  if (stufen.length === 0) return null;
  const je = new Map<string, number>();
  const name = (r: { von: number; bis: number | null }) =>
    r.bis === null ? `ab ${r.von}` : `${r.von}–${r.bis}`;
  const hoechste = Math.max(...stufen.map((r) => (r.bis === null ? Infinity : r.bis)));
  for (const { p } of zeilen) {
    if (p.alter === null) continue;
    const r = altersregel(stufen, p.alter);
    const k = r ? name(r) : p.alter > hoechste ? `ab ${hoechste + 1}` : 'übrige';
    je.set(k, (je.get(k) ?? 0) + 1);
  }
  const reihe = [...stufen.map(name), `ab ${hoechste + 1}`, 'übrige'];
  const teile = reihe.filter((k) => je.get(k)).map((k) => `${k}: ${je.get(k)}`);
  return teile.length
    ? { text: teile.join(' · '), klein: 'Personen je Altersstufe der Preise' }
    : null;
}

/**
 * **Die Summenzeile je Person** – wie je Anmeldung, aber gezählt wird, wer einen Platz hat (nur im Reiter Warteliste
 * die Wartenden). Betrag und Bezahlt zählen jede Anmeldung **einmal**, egal wie viele Personen sie hat.
 */
export function personSumme(
  e: OeffentlicheEinstellungen,
  schluessel: string,
  zeilen: PersonZeile[],
): Summe | null {
  const mitPlatz = zeilen.filter((z) => z.p.status === 'aktiv');
  const zaehlen = mitPlatz.length > 0 ? mitPlatz : zeilen;
  switch (schluessel) {
    case 'vor': {
      const wartend = zeilen.length - mitPlatz.length;
      return {
        text: anzahl(zaehlen.length, 'Person', 'Personen'),
        ...(mitPlatz.length > 0 && wartend ? { klein: `+ ${wartend} auf der Warteliste` } : {}),
      };
    }
    case 'alter':
      return altersSumme(e, zaehlen);
    case 'betrag':
    case 'bezahlt':
      return summe(e, schluessel, anmeldungenVon(zeilen));
  }
  const f = personenFrage(e, schluessel);
  if (!f) return null;
  return frageSumme(
    f,
    zaehlen.map((z) => frageAntwort(e, f, z.x, z.p)),
    'Personen',
  );
}
