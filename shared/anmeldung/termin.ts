/**
 * **Termine zwischen ChurchTools und unseren Einstellungen** (A3, #486). ChurchTools rechnet in UTC
 * (`2026-11-14T08:30:00Z` = 9:30 Uhr in Deutschland, gemessen), unsere `TerminAngabe` in Ortszeit der
 * Gemeinde (`2026-11-14T09:30`) – so, wie es auf der Einladung steht. Hier wird umgerechnet, an EINER
 * Stelle, auch über die Zeitumstellung hinweg.
 *
 * Der Termin wird nicht mit der Gruppe verknüpft (A0 #4: Termin löschen löscht sonst die Anmeldungen).
 * Datum und Ort sind eine Kopie, `terminId` merkt sich die Herkunft.
 */
import type { OeffentlicheEinstellungen, TerminAngabe } from './formular';
import { datumText, letzterTag, monatPlus } from '../ct/datum';
import { ortszeitAus, utcAus } from '../ct/zeit';

// Die Umrechnung UTC ↔ Ortszeit steht für alle Apps in `shared/ct/zeit.ts` (Dienstplaner E3-2).
export { ortszeitAus, utcAus };

/** Was wir von einem ChurchTools-Termin brauchen (`base` aus `/calendars/appointments`, gemessen). */
export interface CtTermin {
  id: number;
  title?: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  address?: { name?: string | null; city?: string | null } | null;
}

/** Ein ChurchTools-Termin als Kopie für unsere Einstellungen. Ganztägig: von 0:00 bis 23:59. */
export function terminAusCt(
  t: CtTermin,
  zeitzone: string,
  kalenderId?: number | null,
): TerminAngabe {
  const nurTag = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const beginn = nurTag(t.startDate) ? `${t.startDate}T00:00` : ortszeitAus(t.startDate, zeitzone);
  const ende = nurTag(t.endDate) ? `${t.endDate}T23:59` : ortszeitAus(t.endDate, zeitzone);
  const ort = [t.address?.name, t.address?.city]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
  return {
    beginn,
    ende: ende === beginn ? null : ende,
    ort,
    terminId: t.id,
    ...(kalenderId ? { kalenderId } : {}),
  };
}

/**
 * **Wann, in Worten** – „Mo, 31.08.2026, 10:00 Uhr bis 12:00 Uhr“ (mehrtägig mit dem Endtag). Die eine Schreibweise für
 * die Karte „Termin“ und den Hinweis „im Kalender verschoben“ (K1).
 */
export function terminWann(t: Pick<TerminAngabe, 'beginn' | 'ende'>): string {
  const tag = (x: string) => datumText(x.slice(0, 10));
  const bis = !t.ende
    ? ''
    : t.ende.slice(0, 10) === t.beginn.slice(0, 10)
      ? ` bis ${t.ende.slice(11)} Uhr`
      : ` bis ${tag(t.ende)}, ${t.ende.slice(11)} Uhr`;
  return `${tag(t.beginn)}, ${t.beginn.slice(11)} Uhr${bis}`;
}

/**
 * **Einen Termin von Hand wählen** (K1) – im Termin-Fenster und beim Kopieren. „Im Kalender verschoben“ gehört zur
 * alten Wahl: Bliebe es stehen, meldete der Hinweis eine Verschiebung zum neu gewählten Termin. Die eine Stelle dafür.
 */
export function mitGewaehltemTermin(
  e: OeffentlicheEinstellungen,
  termin: TerminAngabe | null,
): OeffentlicheEinstellungen {
  const { terminVerschoben: _alt, ...rest } = e;
  return { ...rest, termin };
}

/** Ein Termin, wie ChurchTools ihn einzeln liefert (`GET /calendars/{k}/appointments/{id}`, gemessen 05.11.2026). */
export interface CtTerminEinzeln {
  appointment: CtTermin & { repeatId?: number | null; calendar?: { id?: number } | null };
  /** Bei Serien: je Tag (`JJJJ-MM-TT`) Beginn und Ende; ein einzeln verschobener oder abgesagter Tag fehlt. */
  calculatedDates?: Record<string, { startDate: string; endDate: string }> | null;
}

export type KalenderVergleich =
  | { art: 'gleich' }
  /** `sichtbar`: Datum oder Ort sind anders – nicht nur der Kalender (der zieht still mit). */
  | { art: 'geaendert'; neu: TerminAngabe; sichtbar: boolean }
  /** Gelöscht, oder bei einer Serie die Wiederholung verschoben/abgesagt – den neuen Tag kennt ChurchTools nur als
   *  fremden Einzeltermin (gemessen 05.11.2026). Das Datum bleibt dann stehen. */
  | { art: 'weg' };

/**
 * **Steht der Termin im Kalender noch so?** (K1, gemessen 05.11.2026, Zehnte Runde) – Datum und Ort sind eine Kopie;
 * wer den Termin nur im Kalender verschiebt, ändert sie nicht. Ein Einzeltermin behält dabei seine Nummer. `gelesen`:
 * `null` = nicht gefunden (404). Verglichen wird, was `terminAusCt` daraus macht – dieselbe Umrechnung wie beim Wählen.
 */
export function terminImKalender(
  gespeichert: TerminAngabe,
  gelesen: CtTerminEinzeln | null,
  zeitzone: string,
): KalenderVergleich {
  if (!gelesen) return { art: 'weg' };
  const a = gelesen.appointment;
  let basis: CtTermin = a;
  if ((a.repeatId ?? 0) > 0) {
    // Serie: Die gewählte Wiederholung ist der Tag des Beginns.
    const tag = gelesen.calculatedDates?.[gespeichert.beginn.slice(0, 10)];
    if (!tag) return { art: 'weg' };
    basis = { ...a, startDate: tag.startDate, endDate: tag.endDate };
  }
  const neu = terminAusCt(basis, zeitzone, a.calendar?.id ?? gespeichert.kalenderId ?? null);
  const sichtbar =
    neu.beginn !== gespeichert.beginn ||
    neu.ende !== gespeichert.ende ||
    neu.ort !== gespeichert.ort;
  const kalender = (neu.kalenderId ?? null) !== (gespeichert.kalenderId ?? null);
  return sichtbar || kalender ? { art: 'geaendert', neu, sichtbar } : { art: 'gleich' };
}

/**
 * **Der Link zur Anmeldung**: Formular-Seite der Gemeinde + Instanz + Gruppe. Die Formular-Seite legt jede Gemeinde
 * selbst auf ihren Webspace (Alwin, 14.10.2026: „Voraussetzung für diese Extension – auf keinen Fall soll unsere
 * Domain da sichtbar werden“); die Adresse steht in den Einstellungen der Gemeinde (`formularAdresseAus`).
 */
export function anmeldeLink(formularAdresse: string, ctBasis: string, gruppeId: number): string {
  return `${formularAdresse}#${new URL(ctBasis).host}/${gruppeId}`;
}

/**
 * **Termin in einer Zeile** – „Sa, 21.11.2026 · Gemeindehaus“ (mehrtägig mit „–“), sonst „Termin folgt“. So steht er im
 * Formular und auf dem Aushang (A8-4).
 */
export function terminZeile(e: Pick<OeffentlicheEinstellungen, 'termin'>): string {
  const t = e.termin;
  return t
    ? `${datumText(t.beginn.slice(0, 10))}${t.ende && t.ende.slice(0, 10) !== t.beginn.slice(0, 10) ? ` – ${datumText(t.ende.slice(0, 10))}` : ''}${t.ort ? ` · ${t.ort}` : ''}`
    : 'Termin folgt';
}

/**
 * **Das Löschdatum** (A9-3a): Ende des Termins (ohne Ende: der Beginn) plus die Frist in Monaten, als `JJJJ-MM-TT` –
 * nur so nimmt ChurchTools es im Warte-Schritt (gemessen 28.10.2026). Gibt es den Tag im Zielmonat nicht (31.01. + 1),
 * gilt der letzte. Ohne Termin: `null` – dann wird nicht gelöscht. Steht hier (nicht in `ablaeufe.ts`), damit das
 * öffentliche Formular Gästen denselben Tag nennt, an dem ChurchTools löscht – es rechnete vorher selbst nach und
 * nannte an Monatsenden einen späteren (30.11. + 3 → 02.03. statt 28.02.).
 */
export function loeschDatum(
  e: Pick<OeffentlicheEinstellungen, 'termin' | 'loeschfristMonate'>,
): string | null {
  if (!e.termin) return null;
  const tag = (e.termin.ende ?? e.termin.beginn).slice(0, 10);
  const ziel = monatPlus(tag.slice(0, 7), e.loeschfristMonate);
  const gleicherTag = `${ziel}-${tag.slice(8, 10)}`;
  const letzter = letzterTag(ziel);
  return gleicherTag < letzter ? gleicherTag : letzter;
}
