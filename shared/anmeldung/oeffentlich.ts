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

/** „Deine Anmeldung“ (A6-4): wo die Anmeldung liegt und mit welchem Schlüssel aus der Mail. */
export interface AbmeldeOrt extends AnmeldeOrt {
  token: string;
}

/**
 * **Wohin „Austreten“ in der Mail von ChurchTools führt** (A6-4, gemessen 16.10.2026): ChurchTools nimmt beim Anmelden
 * `signOutUrlTemplate` mit und ersetzt darin `$groupId` und `$token`. So landet der Link auf unserer Seite
 * „Deine Anmeldung“ statt auf der von ChurchTools. `formularBasis`: Adresse der Formular-Seite ohne `#`.
 */
export function abmeldeVorlage(formularBasis: string, instanz: string): string {
  return `${formularBasis.split('#')[0]}#${instanz}/$groupId/abmelden/$token`;
}

/** **Den Link aus der Mail lesen** – das Gegenstück zu `abmeldeVorlage`. `null`, wenn es keiner ist. */
export function abmeldeOrtAusLink(hash: string): AbmeldeOrt | null {
  const m = /^#?([^/]+)\/(\d{1,9})\/abmelden\/([A-Za-z0-9_-]{8,64})\/?$/.exec(hash.trim());
  if (!m) return null;
  const ort = ortAusLink(`${m[1]}/${m[2]}`);
  return ort ? { ...ort, token: m[3] } : null;
}

/** Was ChurchTools zum Link aus der Mail herausgibt (ohne Login) – keine Antworten, kein Betrag (gemessen). */
export interface AbmeldeDaten {
  /** Name der Veranstaltung (aus ChurchTools – falls die Veranstaltung selbst nicht mehr lesbar ist). */
  veranstaltung: string;
  /** Wer angemeldet hat (bei „Nur Kinder“ das Kind, an das die Mail ging). */
  anmelder: string;
  /** Sein Nachname – für den Verwendungszweck. */
  nachname: string;
  mail: string;
  /** Wen man mit diesem Link abmelden darf. Leer, wenn schon abgesagt. */
  personen: { id: number; name: string }[];
}

/** Die Antwort von `GET /publicgroups/{id}/signoutdata?token=` lesen. `null`, wenn sie anders aussieht. */
export function abmeldeDatenAus(json: unknown): AbmeldeDaten | null {
  const d = (json as { data?: Record<string, unknown> } | null)?.data;
  if (!d || typeof d !== 'object') return null;
  const person = (p: unknown) => {
    const x = p as { domainIdentifier?: string | number; title?: string } | null;
    const id = Number(x?.domainIdentifier);
    return Number.isInteger(id) && id > 0 && typeof x?.title === 'string'
      ? { id, name: x.title }
      : null;
  };
  const liste = Array.isArray(d.selfSignOutPersons) ? d.selfSignOutPersons : [];
  const requester = d.requester as {
    title?: string;
    domainAttributes?: { lastName?: string };
  } | null;
  const text = (x: unknown) => (typeof x === 'string' ? x : '');
  return {
    veranstaltung: text((d.group as { title?: string } | null)?.title),
    anmelder: text(requester?.title),
    nachname: text(requester?.domainAttributes?.lastName),
    mail: typeof d.requesterEmail === 'string' ? d.requesterEmail : '',
    personen: liste.map(person).filter((p): p is { id: number; name: string } => p !== null),
  };
}

/**
 * Zum Testen (Alwin, 14.10.2026: bis die eigene Adresse steht): das Formular auf dem eigenen Rechner
 * (`npm run dev -w formular` → `http://localhost:5177`). Nur mit ausdrücklichem `http://` – und ChurchTools muss
 * die Herkunft ohnehin erlauben, für Gäste ist so ein Link nutzlos.
 */
const LOKAL = /^(localhost|127\.0\.0\.1)$/;

/**
 * **Die Adresse der Formular-Seite aus einer Eingabe** – nur `https` (zum Testen auch `http://localhost`), ohne `#` und `?`, mit `/` am Ende (so hängt
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
  if (u.username || u.password || u.search || u.hash) return null;
  if (u.protocol === 'http:') {
    if (!LOKAL.test(u.hostname)) return null;
  } else if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null;
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
  | 'abmeldelink' // „Deine Anmeldung“: der Schlüssel aus der Mail passt nicht (404, A6-4)
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
  abmeldelink: {
    titel: 'Dieser Link gilt nicht',
    text: 'Der Link aus der Bestätigungsmail passt zu keiner Anmeldung (mehr). Bei Fragen hilft die Gemeinde weiter.',
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
