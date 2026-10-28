/**
 * **Wie Daten und Stände auf der Startseite heißen** (A2, #480) – an einer Stelle, damit Liste, Hinweise
 * und Kacheln dasselbe sagen. Tage kommen als `YYYY-MM-DD` (Ortszeit der Gemeinde, siehe `TerminAngabe`).
 */
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import type { Anmeldestand, Veranstaltung } from '@shared/anmeldung/uebersicht';
import {
  altersText,
  bedingungText,
  euroText,
  type Altersregel,
  type Anpassung,
  type Geltung,
  type Grundpreis,
} from '@shared/anmeldung/preis';
import { datumText, kachel, monatTitel, tageBis } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';

// Tage anzeigen (Wochentag, Kachel, Monat, Tage bis) steht für alle Apps in `shared/ct/datum.ts`; hier nur
// weitergereicht, damit die Aufrufer der Anmeldungen bleiben, wie sie sind.
export { datumText, kachel, monatTitel, tageBis };

export const STAND_TEXT: Record<Anmeldestand, string> = {
  offen: 'Anmeldung offen',
  bald: 'Anmeldung noch nicht offen',
  geschlossen: 'Anmeldeschluss vorbei',
  voll: 'Ausgebucht',
};

/**
 * „Anmeldeschluss 7.11. (noch 26 Tage)“ – nur solange die Anmeldung offen ist. Der Anmeldeschluss kommt
 * von ChurchTools als Zeitpunkt in UTC; angezeigt wird sein Tag in der Zeitzone des Geräts.
 */
export function schlussText(v: Veranstaltung, heute: string, zeitzone: string): string | null {
  if (v.anmeldung !== 'offen' || !v.anmeldungBis) return null;
  // Der Tag über die eine Umrechnung UTC → Ortszeit (`shared/ct/zeit.ts`), nicht über einen eigenen Formatierer.
  const tag = tagAusIso(v.anmeldungBis, zeitzone);
  const rest = tageBis(heute, tag);
  const wann = rest === 0 ? 'heute' : rest === 1 ? 'morgen' : `noch ${rest} Tage`;
  return `Anmeldeschluss ${Number(tag.slice(8, 10))}.${Number(tag.slice(5, 7))}. (${wann})`;
}

/** Ein Wort für „1 Veranstaltung“ / „3 Veranstaltungen“. */
export function anzahlText(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

/** „Wer meldet sich an?“ – Name und Erklärung (A3). */
export const WER_TEXT: Record<OeffentlicheEinstellungen['wer'], [string, string]> = {
  familie: ['Familien', 'Erwachsene und Kinder in einer Anmeldung'],
  einzeln: ['Einzelpersonen', 'Jede Person meldet sich selbst an'],
  kinder: ['Nur Kinder', 'Eltern geben ihre Kontaktdaten an, angemeldet werden die Kinder'],
};

const WOZU_GEBURTSDATUM = {
  alter: 'Es gibt Preise nach Alter',
  geschwister: 'Es gibt einen Geschwister-Rabatt',
} as const;

/** Warnung auf der Preise-Karte: Die Preise brauchen das Geburtsdatum, es wird aber nicht abgefragt. */
export function ohneGeburtsdatumText(wozu: 'alter' | 'geschwister'): string {
  return `${WOZU_GEBURTSDATUM[wozu]}, aber das Geburtsdatum wird nicht abgefragt. Ohne Alter zahlt jede Person den Grundpreis.`;
}

/** Warnung dort, wo man das Geburtsdatum ausschaltet („Wer meldet sich an?“, Baukasten). */
export function geburtsdatumNoetigText(wozu: 'alter' | 'geschwister'): string {
  return `${WOZU_GEBURTSDATUM[wozu]}. Ohne Geburtsdatum kann das Formular sie nicht rechnen – jede Person zahlt dann den Grundpreis.`;
}

/**
 * **Ein Euro-Betrag aus einem Eingabefeld, in Cent** (A4): „12“, „12,5“, „12,50“, „12.50“, „1.234,50“,
 * auch mit „€“. `null`, wenn es kein Betrag ist; leer gilt als 0. Mehr als zwei Nachkommastellen lehnt es
 * ab, statt still zu runden.
 */
export function centAus(text: string): number | null {
  const t = text.replace(/[\s€]/g, '');
  if (t === '') return 0;
  // Tausenderpunkte nur vor einem Komma („1.234,50“); sonst ist ein Punkt das Dezimalzeichen.
  const ohneTausender = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t) ? t.replace(/\./g, '') : t;
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(ohneTausender);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Cent als Eingabetext: „12“, „12,50“ – das Gegenstück zu `centAus`. */
export function euroEingabe(cent: number): string {
  const euro = Math.floor(cent / 100);
  const rest = cent % 100;
  return rest === 0 ? String(euro) : `${euro},${String(rest).padStart(2, '0')}`;
}

// ── Preise (A4) ─────────────────────────────────────────────────────────────────────────────────

/** „pro Person“ / „pro Anmeldung“ (A4). */
export const JE: Record<Geltung, string> = { person: 'pro Person', anmeldung: 'pro Anmeldung' };

/** „12,00 € pro Person“, „kostenlos“, „nach Auswahl „Zimmertyp“ · 2 Optionen, 65,52 €–89,00 € pro Person“. */
export function grundpreisText(g: Grundpreis): string {
  if (g.art === 'fest')
    return g.betragCent === 0 ? 'kostenlos' : `${euroText(g.betragCent)} ${JE[g.gilt]}`;
  if (g.optionen.length === 0) return `nach Auswahl „${g.auswahlName}“ · noch keine Optionen`;
  const preise = g.optionen.map((o) => o.preisCent);
  const min = Math.min(...preise);
  const max = Math.max(...preise);
  const spanne = min === max ? euroText(min) : `${euroText(min)}–${euroText(max)}`;
  const optionen = g.optionen.length === 1 ? '1 Option' : `${g.optionen.length} Optionen`;
  const kontingent = g.optionen.some((o) => o.kontingent > 0) ? ' · mit Kontingent' : '';
  return `nach Auswahl „${g.auswahlName}“ · ${optionen}, ${spanne} pro Person${kontingent}`;
}

/** „unter 3 Jahren frei · 3–11 Jahre 50 %“ */
export function alterText(regeln: Altersregel[]): string {
  return regeln
    .map((r) => {
      const wert =
        r.art === 'frei' ? 'frei' : r.art === 'prozent' ? `${r.wert} %` : euroText(r.wert);
      return `${altersText(r)} ${wert}`;
    })
    .join(' · ');
}

/** „−5,00 € pro Person, bei Anmeldung bis 31.10.2026“ */
export function anpassungText(a: Anpassung): string {
  const hoehe = a.einheit === 'euro' ? euroText(a.wert) : `${a.wert} %`;
  const wann = a.bedingung === 'immer' ? '' : `, ${bedingungText(a)}`;
  return `${a.art === 'rabatt' ? '−' : '+'}${hoehe} ${JE[a.gilt]}${wann}`;
}

/**
 * **Was ChurchTools nach dem Eintragen durchs Team schickt** (A9-1) – eine Stelle für Nachrücken, Von Hand und Zurückholen.
 * `mitBestaetigung`: Die Abläufe sind eingerichtet (Karte „Mails“) – dann trifft die Routine jeden, der auf „aktiv“ oder
 * „wartend“ kommt (gemessen 24.10.2026). Sonst schickt ChurchTools beim Nachrücken nur „war erfolgreich“, beim Eintragen
 * von Hand nichts.
 */
export function mailHinweis(
  art: 'nachruecken' | 'eintragen',
  mitBestaetigung: boolean,
  vor: string,
): string {
  if (art === 'nachruecken')
    return mitBestaetigung
      ? `ChurchTools schickt ${vor} die Bestätigung mit Betrag und Bankdaten.`
      : 'ChurchTools schickt nur „Deine Anmeldung war erfolgreich“ – ohne Betrag. Danach gibt es hier „Mail schreiben“.';
  return mitBestaetigung
    ? 'ChurchTools schickt die Bestätigung an die E-Mail-Adresse (auf der Warteliste die Mitteilung mit dem Platz) – ohne Link zu „Deine Anmeldung“.'
    : 'ChurchTools schickt dabei keine Mail – danach gibt es „Mail schreiben“.';
}

/**
 * **„Mail schreiben“ anbieten?** (A9-2b) – nach Nachrücken, Von Hand, Person dazu und Zurückholen nur ohne eingerichtete
 * Abläufe; mit ihnen schickt ChurchTools die Bestätigung selbst. Nach einer Absage immer: Sie hat keinen Ablauf.
 */
export function mailAnbieten<T>(
  art: 'nachruecken' | 'eintragen' | 'absage',
  mitBestaetigung: boolean,
  mail: T,
): T | null {
  return art === 'absage' || !mitBestaetigung ? mail : null;
}
