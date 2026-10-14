/**
 * **Das öffentliche Formular – was es aus ChurchTools liest** (A6-1, #542). Ohne Oberfläche, damit Seite und
 * Tests dieselben Regeln benutzen.
 *
 * Gemessen an der Test-Instanz (14.10.2026):
 * - `GET /api/publicgroups/{id}` geht ohne Login erst mit `visibility: 'public'` – sonst 403, auch bei einer
 *   freigegebenen Gruppe. Eine Liste aller öffentlichen Gruppen gibt es nicht (`/publicgroups` → 404); eine
 *   Anmeldung ist also nur über ihren Link zu finden.
 * - Es liefert Name, Beschreibung (`information.note` mit unseren Einstellungen), Bild, `maxMemberCount`,
 *   `currentMemberCount`, `allowWaitinglist` und `canSignUp` samt `signUpConditions` – aber keine
 *   Felddefinitionen; die Fragen stehen deshalb in unseren Einstellungen.
 * - `GET /api/info` liefert ohne Login den Namen der Gemeinde (`siteName`).
 */
import { einstellungenLesen, type OeffentlicheEinstellungen } from './formular';

/** Wo die Anmeldung liegt: Instanz (Rechnername, ohne `https://`) und Gruppe. */
export interface AnmeldeOrt {
  instanz: string;
  gruppeId: number;
}

// Nur ein Rechnername (Buchstaben, Ziffern, Bindestrich, Punkte) – kein Pfad, kein Port, keine Zugangsdaten.
const RECHNER =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * **Den Link lesen** – das Gegenstück zu `anmeldeLink` (`…/#test-ecg-donrath.church.tools/165`). `null`, wenn
 * der Teil hinter `#` keine Instanz mit Gruppennummer ist.
 */
export function ortAusLink(hash: string): AnmeldeOrt | null {
  const m = /^#?([^/]+)\/(\d{1,9})\/?$/.exec(hash.trim());
  if (!m) return null;
  const instanz = m[1].toLowerCase();
  if (!RECHNER.test(instanz)) return null;
  const gruppeId = Number(m[2]);
  return gruppeId > 0 ? { instanz, gruppeId } : null;
}

/**
 * **Die Adresse der Formular-Seite aus einer Eingabe** – nur `https`, ohne `#` und `?`, mit `/` am Ende (so hängt
 * `anmeldeLink` den Teil hinter `#` an). `null`, wenn es keine solche Adresse ist. „anmeldung.beispiel.de“ ohne
 * `https://` wird ergänzt.
 */
export function formularAdresseAus(eingabe: string): string | null {
  const t = eingabe.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) return null;
  if (!u.hostname.includes('.')) return null;
  const pfad = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
  return `${u.origin}${pfad}`;
}

/** Die Herkunft (`https://host[:port]`), die in ChurchTools als erlaubt eingetragen sein muss. */
export function herkunftVon(formularAdresse: string): string {
  return new URL(formularAdresse).origin;
}

/** Die Adresse der Schnittstelle einer Instanz. */
export function apiBasis(ort: AnmeldeOrt): string {
  return `https://${ort.instanz}/api`;
}

/** Was `/publicgroups/{id}` liefert (soweit wir es brauchen). */
export interface OeffentlicheGruppeRoh {
  id?: number;
  name?: string;
  information?: { note?: string | null; imageUrl?: string | null; groupStatusId?: number };
  maxMemberCount?: number | null;
  currentMemberCount?: number | null;
  allowWaitinglist?: boolean;
  canSignUp?: boolean;
}

/** Alles, was die Seite zum Zeigen braucht. */
export interface OeffentlicheVeranstaltung {
  name: string;
  einstellungen: OeffentlicheEinstellungen;
  bildUrl: string | null;
  /** Freie Plätze, `null` ohne Platzgrenze. Nie unter 0. */
  freiePlaetze: number | null;
  warteliste: boolean;
  /** Nimmt ChurchTools gerade Anmeldungen an? */
  offen: boolean;
}

/**
 * **Die Veranstaltung aus der öffentlichen Gruppe** – `null`, wenn die Beschreibung keine Einstellungen der
 * Anmeldungen trägt (dann ist es keine Anmeldung dieser Erweiterung, oder jemand hat sie zerstört).
 */
export function veranstaltungAus(g: OeffentlicheGruppeRoh): OeffentlicheVeranstaltung | null {
  const einstellungen = einstellungenLesen(g.information?.note);
  if (!einstellungen) return null;
  return {
    name: (g.name ?? '').trim(),
    einstellungen,
    bildUrl: g.information?.imageUrl || null,
    freiePlaetze: freiePlaetzeAus(g.maxMemberCount, g.currentMemberCount),
    warteliste: g.allowWaitinglist === true,
    offen: g.canSignUp === true,
  };
}

/** Freie Plätze aus Grenze und Belegung – `null` ohne Grenze. */
export function freiePlaetzeAus(
  max: number | null | undefined,
  aktuell: number | null | undefined,
): number | null {
  if (typeof max !== 'number' || max <= 0) return null;
  return Math.max(0, max - (aktuell ?? 0));
}

/** Warum die Seite nichts zeigen kann – je Fall eine eigene Meldung. */
export type LadeFehler =
  | 'link' // kein gültiger Link
  | 'nicht-freigegeben' // 403
  | 'nicht-gefunden' // 404
  | 'keine-anmeldung' // Gruppe ohne unsere Einstellungen
  | 'voruebergehend' // 429, 5xx, Zeitüberschreitung
  | 'keine-verbindung'; // Netz weg oder die Instanz erlaubt diese Seite nicht (beides sieht gleich aus)

/**
 * **Welcher Fehler ist es?** Ein HTTP-Status oder `'zeit'` (Zeitüberschreitung) bzw. `'netz'` (gar keine
 * Antwort). Vorübergehendes ist nicht endgültig: Dafür gibt es „Nochmal“, die Eingaben bleiben.
 */
export function ladeFehlerAus(grund: number | 'zeit' | 'netz'): LadeFehler {
  if (grund === 'netz') return 'keine-verbindung';
  if (grund === 401 || grund === 403) return 'nicht-freigegeben';
  if (grund === 404) return 'nicht-gefunden';
  // Alles andere ist vorübergehend: Zeitüberschreitung, 429, 5xx.
  return 'voruebergehend';
}

export const LADE_FEHLER_TEXT: Record<
  LadeFehler,
  { titel: string; text: string; nochmal: boolean }
> = {
  link: {
    titel: 'Dieser Link ist unvollständig',
    text: 'Bitte den Link zur Anmeldung noch einmal vollständig aus der Einladung kopieren.',
    nochmal: false,
  },
  'nicht-freigegeben': {
    titel: 'Diese Anmeldung ist nicht geöffnet',
    text: 'Sie ist noch nicht freigegeben oder schon beendet. Bei Fragen hilft die Gemeinde weiter.',
    nochmal: false,
  },
  'nicht-gefunden': {
    titel: 'Diese Anmeldung gibt es nicht',
    text: 'Vielleicht wurde sie gelöscht, oder der Link ist nicht vollständig.',
    nochmal: false,
  },
  'keine-anmeldung': {
    titel: 'Hier ist kein Anmeldeformular hinterlegt',
    text: 'Die Gemeinde muss die Anmeldung noch einrichten.',
    nochmal: false,
  },
  voruebergehend: {
    titel: 'ChurchTools antwortet gerade nicht',
    text: 'Bitte gleich noch einmal versuchen.',
    nochmal: true,
  },
  'keine-verbindung': {
    titel: 'Keine Verbindung zur Gemeinde',
    text: 'Bitte die Internetverbindung prüfen und noch einmal versuchen. Bleibt es dabei, ist das Formular für diese Gemeinde noch nicht freigeschaltet – bitte der Gemeinde Bescheid geben.',
    nochmal: true,
  },
};
