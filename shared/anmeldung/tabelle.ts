/**
 * **Die Tabelle der Anmeldungen** (U2-1, Entwurf `u2-tabelle-v1`, abgenommen 29.10.2026) – welche Spalten es gibt,
 * was in einer Zelle steht, wie sortiert wird und was die Summenzeile zählt. Ohne Oberfläche; die Erweiterung zeichnet
 * daraus `AnmeldungenTabelle.tsx`.
 *
 * Eine Regel, eine Stelle: Die Fragen kommen aus demselben Katalog wie die Druckliste (`fragen`, `frageAntwort`), die
 * Beträge aus `listenZahlen` – dieselbe Zählung wie Kacheln, Startseite und Rundmail.
 */
import { tagPunkt } from '../ct/datum';
import type { Feld, OeffentlicheEinstellungen, TabellenWahl } from './formular';
import {
  frageAntwort,
  frageSchluessel,
  fragen,
  nurVorhandene,
  teilnehmerSpalten,
  teilnehmerZelle,
} from './druckliste';
import { listenZahlen, type ListenAnmeldung, type ListenPerson } from './liste';
import { altersregel, euroText, kannEtwasKosten } from './preis';

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

/** Die Fragen, die einmal je Anmeldung gestellt werden – Personenfragen gibt es nur „je Person“ (U2-2). */
function anmeldungsFragen(e: OeffentlicheEinstellungen): Feld[] {
  return fragen(e).filter((f) => e.formular.anmeldung.includes(f));
}

/** Die Fragen je Person – Allergien, Fotos … */
function personenFragen(e: OeffentlicheEinstellungen): Feld[] {
  return fragen(e).filter((f) => e.formular.person.includes(f));
}

const ZAHL_TYPEN = new Set<Feld['typ']>(['number']);

const spalte = (schluessel: string, titel: string, zahl = false): TabellenSpalte => ({
  schluessel,
  titel,
  zahl,
});
/** Eine Frage als Spalte – Zahlenfragen rechtsbündig. */
const frageSpalte = (f: Feld) => spalte(frageSchluessel(f), f.frage, ZAHL_TYPEN.has(f.typ));

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
  personenFragen(e).find((f) => frageSchluessel(f) === schluessel);
/** Irgendeine Frage – je Person stehen auch die Fragen der Anmeldung zur Wahl (U2-3). */
const jedeFrage = (e: OeffentlicheEinstellungen, schluessel: string) =>
  fragen(e).find((f) => frageSchluessel(f) === schluessel);

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
    case 'geburtstag':
      return z.p.geburtstag;
    case 'warteplatz':
      return z.p.status === 'wartet' ? (z.p.warteplatz ?? null) : null;
    case 'status':
      return z.p.status === 'wartet' ? 1 : 0;
    case 'betrag':
    case 'bezahlt':
      return sortWert(e, schluessel, z.x);
  }
  const f = jedeFrage(e, schluessel);
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
 * die Wartenden). Betrag, Bezahlt und die Fragen der Anmeldung (U2-3) zählen jede Anmeldung **einmal**, egal wie viele
 * Personen sie hat.
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
  if (!f) {
    // Eine Frage der Anmeldung: dieselbe Summe wie je Anmeldung – sonst zählte „Mitfahrt: Ja“ jedes Kind mit.
    const je = jedeFrage(e, schluessel) ? summe(e, schluessel, anmeldungenVon(zeilen)) : null;
    return je && !je.klein ? { ...je, klein: 'einmal je Anmeldung' } : je;
  }
  return frageSumme(
    f,
    zaehlen.map((z) => frageAntwort(e, f, z.x, z.p)),
    'Personen',
  );
}

// ── Spalten wählen (U2-3) ─────────────────────────────────────────────────────────────────────

export type TabellenModus = 'anmeldung' | 'person';

/** Eine Spalte, wie die Tabelle sie zeigt – `fest` = angeheftet, bleibt beim seitlichen Scrollen links stehen. */
export interface GezeigteSpalte extends TabellenSpalte {
  fest: boolean;
}

/**
 * **Welche Spalten es gibt.** Je Anmeldung: Name, Nr., Personen, jede Frage der Anmeldung, Betrag und Bezahlt (nur
 * wenn etwas kosten kann), Angemeldet am. Je Person: Vor- und Nachname, Status, aus dem Katalog der Druckliste
 * (`teilnehmerSpalten`) Alter, Geburtsdatum, jede Frage der Person, „Angemeldet von“ und Nr., dann die Fragen der
 * Anmeldung und Betrag/Bezahlt der Anmeldung (einen Preis je Person kennt ChurchTools nicht, Bauplan U2-2). Den
 * Warteplatz gibt es nicht zur Wahl – im Reiter Warteliste steht er von selbst.
 */
export function spaltenKatalog(
  e: OeffentlicheEinstellungen,
  modus: TabellenModus,
): TabellenSpalte[] {
  // Dieselbe Bedingung wie die Kacheln und der Reiter „Zahlung offen“ (`listenZahlen`).
  const geld = kannEtwasKosten(e.preis)
    ? [
        spalte('betrag', modus === 'person' ? 'Betrag der Anmeldung' : 'Betrag', true),
        spalte('bezahlt', 'Bezahlt'),
      ]
    : [];
  if (modus === 'anmeldung')
    return [
      spalte('name', 'Name'),
      spalte('nr', 'Nr.'),
      spalte('personen', 'Personen'),
      ...anmeldungsFragen(e).map(frageSpalte),
      ...geld,
      spalte('am', 'Angemeldet am'),
    ];
  const druck = teilnehmerSpalten(e);
  const ausDruck = (k: string) =>
    druck.filter((s) => s.schluessel === k).map((s) => spalte(k, s.titel, k === 'alter'));
  return [
    spalte('vor', 'Vorname'),
    spalte('nach', 'Nachname'),
    spalte('status', 'Status'),
    ...ausDruck('alter'),
    ...ausDruck('geburtstag'),
    ...personenFragen(e).map(frageSpalte),
    ...ausDruck('kontakt'),
    ...ausDruck('nr'),
    ...anmeldungsFragen(e).map(frageSpalte),
    ...geld,
  ];
}

/** Ohne Wahl angeheftet (Entwurf `u2-tabelle-v1`): der Name, je Person Vor- und Nachname. */
const VORGABE_FEST: Record<TabellenModus, string[]> = {
  anmeldung: ['name'],
  person: ['vor', 'nach'],
};

/**
 * **Die Vorgabe** – alle Spalten in der Reihenfolge des Katalogs. Je Person ausgeblendet: das Geburtsdatum (das Alter
 * steht da) und die Fragen der Anmeldung (sie stehen bei jeder Person ihrer Anmeldung gleich).
 */
export function vorgabeWahl(e: OeffentlicheEinstellungen, modus: TabellenModus): TabellenWahl {
  const reihe = spaltenKatalog(e, modus).map((s) => s.schluessel);
  const aus =
    modus === 'person'
      ? new Set(['geburtstag', ...anmeldungsFragen(e).map(frageSchluessel)])
      : new Set<string>();
  return {
    reihe,
    aus: reihe.filter((k) => aus.has(k)),
    fest: VORGABE_FEST[modus].filter((k) => reihe.includes(k)),
  };
}

/**
 * **Die gemerkte Wahl** (gilt fürs ganze Team), bereinigt wie die Druckliste (`nurVorhandene`: gelöschte Fragen fallen
 * weg). Spalten, die es beim Speichern noch nicht gab (neue Frage), stehen hinten und folgen der Vorgabe. Bleibt keine
 * Spalte sichtbar, gilt die Vorgabe – eine leere Tabelle hilft niemandem.
 */
export function spaltenWahl(e: OeffentlicheEinstellungen, modus: TabellenModus): TabellenWahl {
  const vorgabe = vorgabeWahl(e, modus);
  const w = e.tabelle?.[modus];
  if (!w) return vorgabe;
  const katalog = spaltenKatalog(e, modus);
  const reihe = nurVorhandene(w.reihe, katalog);
  const neu = vorgabe.reihe.filter((k) => !reihe.includes(k));
  const aus = [...nurVorhandene(w.aus, katalog), ...neu.filter((k) => vorgabe.aus.includes(k))];
  const fest = nurVorhandene(w.fest, katalog).filter((k) => !aus.includes(k));
  const alle = [...reihe, ...neu];
  return alle.some((k) => !aus.includes(k)) ? { reihe: alle, aus, fest } : vorgabe;
}

/**
 * **Die Spalten der Tabelle** – erst die angehefteten in der Reihenfolge des Anheftens, im Reiter Warteliste dann der
 * Warteplatz, dahinter die sichtbaren in ihrer Reihenfolge.
 */
export function gezeigteSpalten(
  e: OeffentlicheEinstellungen,
  modus: TabellenModus,
  w: TabellenWahl,
  { warteliste }: { warteliste: boolean },
): GezeigteSpalte[] {
  const katalog = new Map(spaltenKatalog(e, modus).map((s) => [s.schluessel, s]));
  const nimm = (k: string, fest: boolean) => {
    const s = katalog.get(k);
    return s ? [{ ...s, fest }] : [];
  };
  return [
    ...w.fest.flatMap((k) => nimm(k, true)),
    ...(warteliste ? [{ ...spalte('warteplatz', 'Warteplatz', true), fest: false }] : []),
    ...w.reihe
      .filter((k) => !w.fest.includes(k) && !w.aus.includes(k))
      .flatMap((k) => nimm(k, false)),
  ];
}

/** Die Spalten im Fenster „Spalten“, in drei Gruppen wie im Entwurf. */
export function spaltenGruppen(w: TabellenWahl): {
  fest: string[];
  sichtbar: string[];
  aus: string[];
} {
  return {
    fest: w.fest,
    sichtbar: w.reihe.filter((k) => !w.fest.includes(k) && !w.aus.includes(k)),
    aus: w.reihe.filter((k) => w.aus.includes(k)),
  };
}

/** **Ein- oder ausblenden** – eine angeheftete Spalte wird dabei losgelassen; die letzte sichtbare bleibt. */
export function spalteZeigen(w: TabellenWahl, k: string): TabellenWahl {
  if (w.aus.includes(k)) return { ...w, aus: w.aus.filter((x) => x !== k) };
  if (w.reihe.filter((x) => !w.aus.includes(x)).length <= 1) return w;
  return { ...w, aus: [...w.aus, k], fest: w.fest.filter((x) => x !== k) };
}

/** **Anheften oder loslassen** – angeheftet wird hinter die schon angehefteten; eine ausgeblendete Spalte erscheint. */
export function spalteAnheften(w: TabellenWahl, k: string): TabellenWahl {
  return w.fest.includes(k)
    ? { ...w, fest: w.fest.filter((x) => x !== k) }
    : { ...w, fest: [...w.fest, k], aus: w.aus.filter((x) => x !== k) };
}

/** **Eine Stelle nach oben (−1) oder unten (+1)** – innerhalb der Angehefteten bzw. der übrigen sichtbaren Spalten. */
export function spalteVerschieben(w: TabellenWahl, k: string, um: -1 | 1): TabellenWahl {
  const tausche = (liste: string[], a: string, b: string) =>
    liste.map((x) => (x === a ? b : x === b ? a : x));
  const gruppe = w.fest.includes(k) ? w.fest : spaltenGruppen(w).sichtbar;
  const nachbar = gruppe[gruppe.indexOf(k) + um];
  if (!gruppe.includes(k) || nachbar === undefined) return w;
  return w.fest.includes(k)
    ? { ...w, fest: tausche(w.fest, k, nachbar) }
    : { ...w, reihe: tausche(w.reihe, k, nachbar) };
}

const gleicheWahl = (u: TabellenWahl, w: TabellenWahl) =>
  u.reihe.join('|') === w.reihe.join('|') &&
  u.fest.join('|') === w.fest.join('|') &&
  [...u.aus].sort().join('|') === [...w.aus].sort().join('|');

/**
 * **Die Wahl merken** – in den Einstellungen der Veranstaltung wie die Druckliste (`druck`). Gemerkt wird nur, was von
 * der Vorgabe abweicht; gleicht die Wahl ihr wieder, fällt die Ansicht weg (und ohne Ansichten das ganze Feld).
 */
export function mitSpaltenWahl(
  e: OeffentlicheEinstellungen,
  modus: TabellenModus,
  w: TabellenWahl,
): OeffentlicheEinstellungen {
  const tabelle = { ...e.tabelle };
  if (gleicheWahl(w, vorgabeWahl(e, modus))) delete tabelle[modus];
  else tabelle[modus] = w;
  const neu: OeffentlicheEinstellungen = { ...e, tabelle };
  if (!tabelle.anmeldung && !tabelle.person) delete neu.tabelle;
  return neu;
}

/** Hat sich gegenüber der gemerkten Wahl etwas geändert? (Speichern nur dann.) */
export function wahlGeaendert(
  e: OeffentlicheEinstellungen,
  modus: TabellenModus,
  w: TabellenWahl,
): boolean {
  return !gleicheWahl(w, spaltenWahl(e, modus));
}
