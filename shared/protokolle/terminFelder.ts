/**
 * **Die Felder des Reiters „Kalender“ als Teil der Anfrage an ChurchTools** (W15-1) – Untertitel, Beschreibung, Link, intern,
 * Wiederholung, weitere Termine, Ausnahmen, Im Auftrag von, Tags, Ort und „Ersteller informieren“. Eine Stelle, die das
 * Fenster (`Eintrag`) in diese Felder übersetzt; den Rumpf für `POST /calendars/{id}/appointments` baut
 * `protokolle/src/terminAnlegen.ts` daraus, die Termin-Vorlage (`terminVorlagen.ts`) benutzt dieselbe Adresse.
 */
import type { Eintrag } from './termine';
import type { Buchung } from './terminRessourcen';
import { istAutomatisch, WIEDERHOLUNG } from './terminWiederholung';

/** Die Adresse eines Termins, wie ChurchTools sie annimmt (`address`) – nur die gefüllten Felder. */
export interface TerminAdresse {
  /** „Name“ im Dialog – hieß in der Anmeldungs-Erweiterung früher `meetingAt` (veraltet, gemessen 23.11.2026: `name`). */
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  /** „Zusatz“ (nicht gemessen – der Handtest TF-PROT-32 prüft, ob ChurchTools ihn so annimmt). */
  addition?: string;
}

/** Was zusätzlich zu Kalender, Titel und Zeitraum an ChurchTools geht. Alles optional – leer lässt es weg. */
export interface TerminZusatz {
  untertitel?: string;
  beschreibung?: string;
  link?: string;
  /** „Nur für eingeloggte Personen sichtbar“. */
  intern?: boolean;
  /** Nur bei einer Wiederholung (Art ≠ 0). */
  wiederholung?: { art: number; frequenz?: number; option?: number; bis?: string };
  /** `JJJJ-MM-TT`. */
  weitere?: readonly string[];
  ausnahmen?: readonly string[];
  imAuftrag?: number | null;
  /** Nummern (vorhandene Tags) oder Texte (neue Tags). */
  tags?: readonly (number | string)[];
  informieren?: boolean;
  adresse?: TerminAdresse;
  /** Ressourcen-Buchungen (W15-2) – leer lässt `bookings` weg. */
  buchungen?: readonly Buchung[];
  /** Events (W15-3): je Einzeltermin mit gewählter Vorlage – `startDate` ist der exakte UTC-Beginn des Einzeltermins. */
  events?: readonly { startDate: string; eventTemplateId: number }[];
}

/** Die Adresse aus den Feldern des Fensters – ohne Leerzeichen am Rand, `null` ohne jede Angabe. */
export function eintragAdresse(
  e: Pick<Eintrag, 'ort' | 'ortStrasse' | 'ortPlz' | 'ortStadt' | 'ortZusatz'>,
): TerminAdresse | null {
  const a: TerminAdresse = {};
  if (e.ort.trim()) a.name = e.ort.trim();
  if (e.ortStrasse.trim()) a.street = e.ortStrasse.trim();
  if (e.ortPlz.trim()) a.zip = e.ortPlz.trim();
  if (e.ortStadt.trim()) a.city = e.ortStadt.trim();
  if (e.ortZusatz.trim()) a.addition = e.ortZusatz.trim();
  return Object.keys(a).length ? a : null;
}

/** Hat der Eintrag eine Ortsangabe (Name, Straße, PLZ, Ort oder Zusatz)? */
export const hatOrt = (
  e: Pick<Eintrag, 'ort' | 'ortStrasse' | 'ortPlz' | 'ortStadt' | 'ortZusatz'>,
): boolean => eintragAdresse(e) !== null;

/**
 * **Das Fenster als Zusatzfelder.** Eine Wiederholung nur mit Art ≠ „Keine“; „Bis“ und „Alle x“ nur bei den automatischen
 * Arten, `repeatOption` nur bei „Monatlich nach Wochentag“, bei „Manuell“ gar nichts davon. Neue Tags (Texte) gehen nur mit,
 * wenn die Person Tags verwalten darf (`neueTagsErlaubt`) – sonst lehnt ChurchTools das ganze Anlegen ab.
 */
export function eintragZusatz(e: Eintrag, neueTagsErlaubt: boolean): TerminZusatz {
  const z: TerminZusatz = { intern: e.intern, informieren: e.informieren };
  if (e.untertitel.trim()) z.untertitel = e.untertitel.trim();
  if (e.beschreibung.trim()) z.beschreibung = e.beschreibung.trim();
  if (e.link.trim()) z.link = e.link.trim();
  if (e.imAuftrag !== null) z.imAuftrag = e.imAuftrag;
  const tags = e.tags.filter((t) => typeof t === 'number' || (neueTagsErlaubt && t.trim() !== ''));
  if (tags.length) z.tags = tags;
  const adresse = eintragAdresse(e);
  if (adresse) z.adresse = adresse;
  if (e.buchungen.length) z.buchungen = e.buchungen;
  if (e.art !== WIEDERHOLUNG.keine) {
    z.wiederholung = { art: e.art };
    if (istAutomatisch(e.art)) {
      z.wiederholung.frequenz = e.frequenz;
      z.wiederholung.bis = e.wiederBis;
      if (e.art === WIEDERHOLUNG.monatlichWochentag) z.wiederholung.option = e.option;
    }
    if (e.weitere.length) z.weitere = e.weitere;
    if (e.ausnahmen.length) z.ausnahmen = e.ausnahmen;
  }
  return z;
}
