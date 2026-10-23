/**
 * **Formular-Modell der Anmeldungen** (#474, Bauplan Anmeldungen A1 Teil 2).
 *
 * EIN Feldmodell für den Baukasten der Erweiterung, die Vorschau, das öffentliche Formular und die
 * Nachprüfung. Dazu die Regeln, die an ChurchTools hängen und an der Test-Instanz gemessen sind
 * (A0, 09.10.2026):
 *
 *  - Jedes Formularfeld wird ein **Gruppenfeld** (Spalte der Mitgliedertabelle). Felder, die beim
 *    Anmelden befüllt werden, müssen im Anmeldeformular von ChurchTools freigegeben sein
 *    (`useInRegistrationForm`) – ein ausgeblendetes Feld lehnt ChurchTools ab.
 *  - **Mehrfachauswahl** nimmt ChurchTools bei der anonymen Anmeldung nur mit EINEM Wert an → wir
 *    speichern „Mehrere Antworten“ als Text.
 *  - Die öffentlichen Einstellungen (Preise, Aufbau, Gestaltung) liegen in der **Beschreibung der
 *    Anmeldegruppe** – die ist ohne Login lesbar, fasst aber höchstens **5.000 Zeichen**. Der
 *    Erweiterungs-Speicher ist ohne Login nicht lesbar. Seit A5 **gepackt und unsichtbar** (siehe
 *    `einstellungenAlsText`).
 */
import { z } from 'zod';
import { ausBase64url, base64url } from '../ct/packen';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { PreisRegeln } from './preis';
import { STANDARD_BEZAHLUNG, ZWECK_MAX, type Bezahlung } from './bezahlung';
import { mitVorgaben, vorlageVon } from './gestaltung';

export type Feldtyp =
  | 'name'
  | 'email'
  | 'tel'
  | 'text'
  | 'textarea'
  | 'janein'
  | 'check'
  | 'radio'
  | 'select'
  | 'multi'
  | 'date'
  | 'number'
  | 'info'
  | 'ueberschrift'
  | 'trenner'
  | 'privacy'
  | 'price'
  // A6-2b: zusammengesetzte Bausteine (Alwin, 14./15.10.2026, Entwurf `a6-2b-entwurf-v2`).
  | 'erziehungsberechtigte'
  | 'unterschrift';

/**
 * **Nur Text, keine Frage** – Hinweistext, Zwischenüberschrift, Trennlinie (A5). Keine Antwort, keine Spalte in
 * ChurchTools, kein „Pflicht“. Die EINE Stelle für diese Regel (Prüfung, Ablage, Darstellung, Baukasten).
 */
export function nurText(typ: Feldtyp): boolean {
  return typ === 'info' || typ === 'ueberschrift' || typ === 'trenner';
}

/** `fest` = immer dabei, `standard` = vorgegeben, an/aus; `eigen` = aus dem Baukasten; `preis` = aus den Preisen. */
export type Feldart = 'fest' | 'standard' | 'eigen' | 'preis';
export type Feldzustand = 'aus' | 'freiwillig' | 'pflicht';

export interface Feld {
  id: string;
  art: Feldart;
  typ: Feldtyp;
  /** Frage bzw. Beschriftung; bei `check` der Text neben dem Kästchen, bei `info` die Überschrift. */
  frage: string;
  hilfe: string;
  zustand: Feldzustand;
  /** Antworten bei `radio`, `select`, `multi`. */
  antworten: string[];
  /**
   * Antworten, die aus dem Formular entfernt wurden, die aber schon jemand gewählt hat (A5, Alwin:
   * „ausblenden“). Sie bleiben in ChurchTools stehen – sonst wäre die Wahl der Person still weg (gemessen) –,
   * das Formular bietet sie nicht mehr an.
   */
  verborgen?: string[];
}

export interface Formular {
  /** Einmal pro Anmeldung (bei Kinder-Events: Kontakt der Eltern). */
  anmeldung: Feld[];
  /** Wiederholt sich für jede angemeldete Person. */
  person: Feld[];
}

/**
 * Bausteine des Baukastens (ohne die festen und vorgegebenen Felder): eigene Fragen und Gestaltung. Die
 * empfohlenen Bausteine (Telefon, Geburtsdatum …) stehen in `baukasten.ts` (`EMPFOHLEN`).
 */
export const BAUSTEINE: { typ: Feldtyp; name: string; gruppe: 'frage' | 'gestaltung' }[] = [
  { typ: 'text', name: 'Kurzer Text', gruppe: 'frage' },
  { typ: 'textarea', name: 'Langer Text', gruppe: 'frage' },
  { typ: 'janein', name: 'Ja / Nein', gruppe: 'frage' },
  { typ: 'check', name: 'Ankreuzen', gruppe: 'frage' },
  { typ: 'radio', name: 'Eine Antwort', gruppe: 'frage' },
  { typ: 'select', name: 'Auswahlliste', gruppe: 'frage' },
  { typ: 'multi', name: 'Mehrere Antworten', gruppe: 'frage' },
  { typ: 'date', name: 'Datum', gruppe: 'frage' },
  { typ: 'number', name: 'Zahl', gruppe: 'frage' },
  { typ: 'ueberschrift', name: 'Überschrift', gruppe: 'gestaltung' },
  { typ: 'info', name: 'Hinweistext', gruppe: 'gestaltung' },
  { typ: 'trenner', name: 'Trennlinie', gruppe: 'gestaltung' },
];

export interface Vorgaben {
  /** Geburtsdatum abfragen (Pflicht) – nötig für Preise nach Alter und den Check-in. */
  geburtsdatum?: boolean;
  telefon?: Feldzustand;
  foto?: Feldzustand;
}

function feld(
  id: string,
  art: Feldart,
  typ: Feldtyp,
  frage: string,
  zustand: Feldzustand,
  hilfe = '',
): Feld {
  return { id, art, typ, frage, hilfe, zustand, antworten: [] };
}

/** **Das Grundformular** einer neuen Veranstaltung. Name, E-Mail und Datenschutz sind immer dabei. */
export function standardFormular(v: Vorgaben = {}): Formular {
  return {
    anmeldung: [
      feld('name', 'fest', 'name', 'Name', 'pflicht'),
      feld('mail', 'fest', 'email', 'E-Mail', 'pflicht'),
      feld('tel', 'standard', 'tel', 'Telefon', v.telefon ?? 'freiwillig', 'für Rückfragen'),
      feld('note', 'standard', 'textarea', 'Bemerkungen', 'freiwillig'),
      feld('price', 'preis', 'price', 'Auswahl und Extras', 'pflicht'),
      feld('priv', 'fest', 'privacy', 'Datenschutz', 'pflicht'),
    ],
    person: [
      feld('pname', 'fest', 'name', 'Name', 'pflicht'),
      feld('birth', 'standard', 'date', 'Geburtsdatum', v.geburtsdatum ? 'pflicht' : 'aus'),
      feld(
        'allergy',
        'standard',
        'text',
        'Allergien oder Unverträglichkeiten',
        'freiwillig',
        'z. B. Laktose, Nüsse',
      ),
      feld('foto', 'standard', 'janein', 'Dürfen Fotos veröffentlicht werden?', v.foto ?? 'aus'),
    ],
  };
}

function alleFelder(f: Formular): Feld[] {
  return [...f.anmeldung, ...f.person];
}

/** Wird das Geburtsdatum abgefragt? Die EINE Stelle – „Wer meldet sich an?“ und der Baukasten lesen hier. */
export function geburtsdatumAn(f: Formular): boolean {
  const b = alleFelder(f).find((x) => x.id === 'birth');
  return !!b && b.zustand !== 'aus';
}

/** Geburtsdatum an (Pflicht) oder aus – ohne „freiwillig“, weil die Preise nach Alter es brauchen. */
export function setzeGeburtsdatum(f: Formular, an: boolean): Formular {
  const neu = (liste: Feld[]) =>
    liste.map((x) =>
      x.id === 'birth' ? { ...x, zustand: an ? ('pflicht' as const) : ('aus' as const) } : x,
    );
  return { anmeldung: neu(f.anmeldung), person: neu(f.person) };
}

/**
 * **„Wer meldet sich an?“ ändern** – und ob das Geburtsdatum abgefragt wird. Die EINE Stelle für das Fenster
 * im Reiter Veranstaltung und die Leiste im Baukasten.
 */
export function mitWer(
  e: OeffentlicheEinstellungen,
  wer: OeffentlicheEinstellungen['wer'],
  geburtsdatum: boolean,
): OeffentlicheEinstellungen {
  return { ...e, wer, formular: setzeGeburtsdatum(e.formular, geburtsdatum) };
}

/** **Alter am Stichtag** (erster Tag der Veranstaltung), beides `YYYY-MM-DD`. `null`, wenn kein Geburtsdatum. */
export function alterAm(geburt: string, stichtag: string): number | null {
  const g = /^(\d{4})-(\d{2})-(\d{2})$/.exec(geburt);
  const s = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stichtag);
  if (!g || !s) return null;
  const [gj, gm, gt] = g.slice(1).map(Number);
  const [sj, sm, st] = s.slice(1).map(Number);
  let alter = sj - gj;
  if (sm < gm || (sm === gm && st < gt)) alter--;
  return alter < 0 ? null : alter;
}

/** Eine erziehungsberechtigte Person (Baustein „Erziehungsberechtigte“). */
export interface Erziehungsberechtigter {
  vor: string;
  nach: string;
  tel: string;
}

/** Antwort des Bausteins „Erziehungsberechtigte“: eine Person Pflicht, eine zweite freiwillig, dazu das Häkchen. */
export interface ErziehungsAntwort {
  personen: Erziehungsberechtigter[];
  einverstanden: boolean;
}

/** Antwort des Bausteins „Unterschrift“: die Striche als Text (`unterschrift.ts`). */
export interface UnterschriftAntwort {
  striche: string;
}

/** Antwort eines Feldes: Text, Ja/Nein, angekreuzt, gewählte Antworten, Name, zusammengesetzte Bausteine. */
export type Antwort =
  | string
  | boolean
  | string[]
  | { vor: string; nach: string }
  | ErziehungsAntwort
  | UnterschriftAntwort
  | undefined;

/** Die Antwort als „Erziehungsberechtigte“ – oder leer, wenn sie etwas anderes ist. */
export function erziehungAus(w: Antwort): ErziehungsAntwort {
  const x = w as Partial<ErziehungsAntwort> | undefined;
  return {
    personen: Array.isArray(x?.personen) ? x.personen : [],
    einverstanden: x?.einverstanden === true,
  };
}

/** Die Striche der Unterschrift – `''`, wenn (noch) nicht unterschrieben. */
export function unterschriftAus(w: Antwort): string {
  const x = w as Partial<UnterschriftAntwort> | undefined;
  return typeof x?.striche === 'string' ? x.striche : '';
}

export interface Antworten {
  anmeldung: Record<string, Antwort>;
  personen: Record<string, Antwort>[];
}

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Sieht wie eine E-Mail-Adresse aus – dieselbe Prüfung für das Formular und den Kontakt der Veranstaltung. */
export function mailGueltig(s: string): boolean {
  return MAIL.test(s.trim());
}

/**
 * **Welche Pflichtangaben fehlen** – Schlüssel wie `anmeldung.mail`, `personen.1.birth`,
 * `anmeldung.name.vor`. Leer = alles da. Dieselbe Prüfung im Formular und in der Nachprüfung.
 */
export function pruefeAntworten(f: Formular, a: Antworten): string[] {
  const fehlt: string[] = [];
  const pruefe = (x: Feld, wert: Antwort, pfad: string) => {
    if (nurText(x.typ) || x.typ === 'price' || x.zustand === 'aus') return;
    if (x.typ === 'email' && typeof wert === 'string' && wert.trim() && !mailGueltig(wert)) {
      fehlt.push(pfad);
      return;
    }
    if (x.zustand !== 'pflicht') return;
    if (x.typ === 'name') {
      const n = (wert ?? {}) as { vor?: string; nach?: string };
      if (!n.vor?.trim()) fehlt.push(`${pfad}.vor`);
      if (!n.nach?.trim()) fehlt.push(`${pfad}.nach`);
      return;
    }
    if (x.typ === 'check' || x.typ === 'privacy') {
      if (wert !== true) fehlt.push(pfad);
      return;
    }
    if (x.typ === 'multi') {
      if (!Array.isArray(wert) || wert.length === 0) fehlt.push(pfad);
      return;
    }
    // Erziehungsberechtigte: die erste Person ganz (Name, Telefon) und das Häkchen; die zweite ist freiwillig.
    if (x.typ === 'erziehungsberechtigte') {
      const e = erziehungAus(wert);
      const erste = e.personen[0];
      for (const teil of ['vor', 'nach', 'tel'] as const)
        if (!erste?.[teil]?.trim()) fehlt.push(`${pfad}.0.${teil}`);
      if (!e.einverstanden) fehlt.push(`${pfad}.ok`);
      return;
    }
    if (x.typ === 'unterschrift') {
      if (!unterschriftAus(wert)) fehlt.push(pfad);
      return;
    }
    if (typeof wert !== 'string' || !wert.trim()) fehlt.push(pfad);
  };
  for (const x of f.anmeldung) pruefe(x, a.anmeldung[x.id], `anmeldung.${x.id}`);
  if (a.personen.length === 0) fehlt.push('personen');
  a.personen.forEach((p, i) => {
    for (const x of f.person) pruefe(x, p[x.id], `personen.${i}.${x.id}`);
  });
  return fehlt;
}

/**
 * **Was an einem Feld nicht stimmt** – die EINE Regel für den Baukasten (Anzeige direkt am Feld, bevor
 * gespeichert wird) und `pruefeFormular` (beim Speichern). `null` = in Ordnung.
 */
export function feldFehler(x: Feld): string | null {
  if (x.art === 'eigen' && x.typ !== 'trenner' && !x.frage.trim())
    return nurText(x.typ) ? 'Bitte einen Text eintragen.' : 'Bitte eine Frage eintragen.';
  if (
    (x.typ === 'radio' || x.typ === 'select' || x.typ === 'multi') &&
    x.antworten.filter((s) => s.trim()).length < 2
  )
    return 'Bitte mindestens zwei Antworten eintragen.';
  return null;
}

/** Was an einem Formular nicht stimmt – beim Speichern im Baukasten. */
export function pruefeFormular(f: Formular): string[] {
  const fehler: string[] = [];
  const ids = alleFelder(f).map((x) => x.id);
  if (new Set(ids).size !== ids.length) fehler.push('Zwei Felder haben dieselbe Kennung.');
  for (const x of alleFelder(f)) {
    const fehlt = feldFehler(x);
    if (fehlt) fehler.push(x.frage.trim() ? `„${x.frage}“: ${fehlt}` : fehlt);
  }
  for (const id of ['name', 'mail', 'priv'])
    if (!f.anmeldung.some((x) => x.id === id && x.zustand === 'pflicht'))
      fehler.push('Name, E-Mail und Datenschutz müssen dabei sein.');
  return [...new Set(fehler)];
}

// ── Ablage in ChurchTools ──────────────────────────────────────────────────────────────────────

/** Wo ein Feld in ChurchTools liegt. `fieldTypeCode` wie bei `POST /groups/{id}/memberfields/group`. */
export type CtAblage =
  | { ort: 'person'; feld: 'firstName/lastName' | 'email' | 'birthday' }
  | {
      ort: 'gruppenfeld';
      fieldTypeCode:
        | 'text'
        | 'textarea'
        | 'checkbox'
        | 'radioselect'
        | 'select'
        | 'date'
        | 'number';
      optionen: string[];
    }
  | { ort: 'keins' };

/**
 * **Wo ein Feld in ChurchTools gespeichert wird.** Name, E-Mail und Geburtsdatum sind Personenfelder;
 * Hinweistext, Preisbereich und Datenschutz haben kein eigenes Gruppenfeld (Preis: siehe `SYSTEMFELDER`).
 */
export function ctAblage(x: Feld): CtAblage {
  switch (x.typ) {
    case 'name':
      return { ort: 'person', feld: 'firstName/lastName' };
    case 'email':
      return { ort: 'person', feld: 'email' };
    case 'info':
    case 'ueberschrift':
    case 'trenner':
    case 'price':
    case 'privacy':
      return { ort: 'keins' };
    case 'date':
      return x.id === 'birth'
        ? { ort: 'person', feld: 'birthday' }
        : { ort: 'gruppenfeld', fieldTypeCode: 'date', optionen: [] };
    case 'janein':
      return { ort: 'gruppenfeld', fieldTypeCode: 'radioselect', optionen: ['Ja', 'Nein'] };
    case 'check':
      return { ort: 'gruppenfeld', fieldTypeCode: 'checkbox', optionen: [] };
    case 'radio':
      return { ort: 'gruppenfeld', fieldTypeCode: 'radioselect', optionen: x.antworten };
    case 'select':
      return { ort: 'gruppenfeld', fieldTypeCode: 'select', optionen: x.antworten };
    // A0: Mehrfachauswahl nimmt ChurchTools anonym nur mit einem Wert an → als Text („Wandern, Spiele“).
    case 'multi':
    case 'tel':
    case 'text':
      return { ort: 'gruppenfeld', fieldTypeCode: 'text', optionen: [] };
    // A6-2b: Erziehungsberechtigte lesbar als Text („Erna Muster, 0151 …“); bei der Unterschrift „✓ Erna Muster,
    // 15.10.2026“ – die Striche liegen in einer zweiten Spalte (`ctZusatzSpalten`).
    case 'textarea':
    case 'erziehungsberechtigte':
      return { ort: 'gruppenfeld', fieldTypeCode: 'textarea', optionen: [] };
    case 'unterschrift':
      return { ort: 'gruppenfeld', fieldTypeCode: 'text', optionen: [] };
    case 'number':
      return { ort: 'gruppenfeld', fieldTypeCode: 'number', optionen: [] };
  }
}

/**
 * **Weitere Spalten eines Felds** – bisher nur die Striche der Unterschrift (Alwin, 15.10.2026: „zwei Spalten“):
 * In der ersten steht lesbar, wer wann unterschrieben hat, in dieser die Striche (höchstens 4.000 Zeichen, gemessen).
 * Ihre Nummer steht in `ctFelder` unter `<Feld-ID>.<schluessel>`.
 */
export function ctZusatzSpalten(
  x: Feld,
): { schluessel: string; name: string; fieldTypeCode: 'textarea' }[] {
  return x.typ === 'unterschrift'
    ? [{ schluessel: `${x.id}.daten`, name: `${x.frage} (Daten)`, fieldTypeCode: 'textarea' }]
    : [];
}

/**
 * Gruppenfelder, die jede Anmeldegruppe zusätzlich bekommt. Betrag und Aufschlüsselung als **Text**
 * (A0: Zahlen erscheinen in Mails als „180.8“). Alle beim Anmelden befüllten Felder müssen im
 * ChurchTools-Anmeldeformular freigegeben sein – auch wenn unsere Seite sie nicht als Eingabe zeigt.
 */
export const SYSTEMFELDER = [
  // Variante A (A6-2, #548): Mitglied werden nur die Teilnehmenden – der Name der Kontaktperson steht hier.
  { id: 'kontakt', name: 'Angemeldet von', fieldTypeCode: 'text', beimAnmelden: true },
  // A6-5a (#612): jede Person wird einzeln angemeldet (#602) – die Nummer hält eine Anmeldung zusammen.
  { id: 'nr', name: 'Anmelde-Nr.', fieldTypeCode: 'text', beimAnmelden: true },
  { id: 'betrag', name: 'Betrag', fieldTypeCode: 'text', beimAnmelden: true },
  {
    id: 'aufschluesselung',
    name: 'Aufschlüsselung',
    fieldTypeCode: 'textarea',
    beimAnmelden: true,
  },
  { id: 'auswahl', name: 'Auswahl', fieldTypeCode: 'text', beimAnmelden: true },
  { id: 'extras', name: 'Extras', fieldTypeCode: 'text', beimAnmelden: true },
  { id: 'bezahlt', name: 'Bezahlt', fieldTypeCode: 'checkbox', beimAnmelden: false },
  { id: 'bezahltAm', name: 'Bezahlt am', fieldTypeCode: 'date', beimAnmelden: false },
  // A7-2: Ältere Veranstaltungen bekommen das Feld beim ersten „bezahlt“ (`zahlungSpeichern`). Ans Ende: Die Reihenfolge
  // bestimmt die Plätze der Sicherung (`sicherungSchreiben`).
  { id: 'zahlart', name: 'Zahlart', fieldTypeCode: 'text', beimAnmelden: false },
] as const;

// ── Öffentliche Einstellungen in der Gruppen-Beschreibung ──────────────────────────────────────

/** Höchstlänge der Gruppen-Beschreibung (gemessen A0: 5.000 geht, 20.000 → 400). */
export const BESCHREIBUNG_MAX = 5000;
/**
 * Erkennungszeichen des **alten** Formats (bis A4): JSON sichtbar am Anfang der Beschreibung. Wird weiter
 * gelesen; geschrieben wird seit A5 das unsichtbare, gepackte Format (`VERWEIS`).
 *
 * **Neue Angaben im Format brauchen einen Standardwert (`.default(…)`)** – sonst werden alle Einstellungen,
 * die vorher geschrieben wurden, unlesbar und die Veranstaltungen fallen aus der Liste (an der Test-Instanz
 * am 12.10.2026 mit `loeschfristMonate` passiert). Das gilt für beide Formate: Sie teilen das Schema.
 */
export const EINSTELLUNGEN_KENNUNG = 'anmeldung:v1:';

export type Schrift = 'standard' | 'rund' | 'serif' | 'klassisch' | 'lesbar';
export type VorlageId = 'klassisch' | 'foto' | 'karte' | 'bunt' | 'geteilt' | 'gross';

/**
 * **Die Gestaltung des Formulars** (A5, Entwurf v3 vom 13.10.2026 – Alwin: „Diese Vorlagen sollten nicht so
 * starr sein … entweder rauslassen oder änderbar machen“). Eine Vorlage ist nur der **Startpunkt**: Sie füllt
 * alle Werte (`VORLAGEN_GESTALTUNG` in `gestaltung.ts`), danach ist jeder einzeln änderbar.
 */
export interface Gestaltung {
  /** Der Startpunkt, aus dem die Werte stammen. */
  vorlage: VorlageId;
  /** Kopfband oben, Bild über die ganze Seite, zweigeteilt (Kopf links) oder Karte in der Mitte. */
  aufbau: 'kopfband' | 'seite' | 'geteilt' | 'karte';
  kopfHoehe: 'klein' | 'mittel' | 'gross';
  kopfAusrichtung: 'links' | 'mitte';
  /** Gemeindelogo aus ChurchTools, eigenes oder keins. */
  logo: 'ct' | 'eigen' | 'keins';
  /** Die Bildadresse des Logos (ChurchTools-Bilddienst, ohne Login abrufbar) – `null`, solange keins gefunden ist. */
  logoUrl: string | null;
  /** Logo oben in der Mitte über dem Titel (Alwin) oder links daneben. */
  logoOrt: 'oben' | 'links';
  /** Seite: einfarbig, mit Muster oder mit dem Titelbild. */
  hintergrund: 'farbe' | 'muster' | 'bild';
  muster: 'punkte' | 'konfetti' | 'sterne' | 'wellen' | 'raster';
  musterfarbe: string;
  /** Hauptfarbe (Kopf, Knöpfe, Häkchen). */
  farbe: string;
  seitenfarbe: string;
  kartenfarbe: string;
  schriftfarbe: string;
  /** Schriften – nur Systemschriften, nichts wird von Google geladen (Datenschutz). */
  kopfSchrift: Schrift;
  textSchrift: Schrift;
  /** Größere Schrift (z. B. für Senioren). */
  gross: boolean;
  ecken: 'eckig' | 'rund' | 'sehrrund';
  schatten: boolean;
  rahmen: boolean;
  /** Jeder Abschnitt in einer eigenen hellen Farbe (wie die alte Vorlage „Bunt“). */
  bunt: boolean;
  feldstil: 'kasten' | 'linie' | 'gefuellt';
  knoepfe: 'eckig' | 'leicht' | 'rund';
  knopfVoll: boolean;
  breite: 'schmal' | 'normal' | 'breit';
  /** Begrüßungstext unter dem Kopf. */
  text: string;
}

/** Alles, was eine Vorlage als Startwert setzt (nicht: Logo, Begrüßung, Breite – die bleiben beim Wechsel). */
export type GestaltungWerte = Omit<
  Gestaltung,
  'vorlage' | 'logo' | 'logoUrl' | 'logoOrt' | 'text' | 'breite'
>;

/**
 * **Wann und wo** (A2, #480). Der ChurchTools-Termin wird bewusst NICHT mit der Gruppe verknüpft (A0 #4:
 * Termin löschen löscht sonst die Gruppe samt Anmeldungen), und der Kalender ist ohne Login nicht lesbar.
 * Das öffentliche Formular braucht Datum und Ort aber – deshalb stehen sie hier, als Kopie; `terminId`
 * merkt sich den Termin, damit die Erweiterung Abweichungen erkennen kann.
 *
 * Zeiten in **Ortszeit der Gemeinde**, ohne Zone (`2026-11-15T12:00`) – so, wie sie auf der Einladung
 * stehen. Verglichen wird nur mit dem heutigen Tag, nie auf die Minute.
 */
export interface TerminAngabe {
  beginn: string;
  ende: string | null;
  ort: string;
  terminId: number | null;
  /** Der Kalender des Termins (A5) – damit das Termin-Fenster dort beginnt. Fehlt bei älteren Einstellungen. */
  kalenderId?: number | null;
}

export interface OeffentlicheEinstellungen {
  /** `null`, solange ein Entwurf noch kein Datum hat. */
  termin: TerminAngabe | null;
  preis: PreisRegeln;
  formular: Formular;
  gestaltung: Gestaltung;
  /** Gruppenfeld-ID in ChurchTools je Formularfeld bzw. Systemfeld. */
  ctFelder: Record<string, number>;
  /** Wer sich anmeldet: Familien, Einzelpersonen, nur Kinder (Eltern = Kontakt). */
  wer: 'familie' | 'einzeln' | 'kinder';
  /** Freie Plätze im Formular zeigen. */
  plaetze: { zeigen: 'immer' | 'knapp' | 'nie'; knappUnter: number };
  /** Monate nach dem Ende, nach denen die Anmeldungen gelöscht werden (A3; die Routine dazu baut A9). */
  loeschfristMonate: number;
  /** Konto, Zahlungsfrist, Verwendungszweck (A4) – öffentlich lesbar, siehe `bezahlung.ts`. */
  bezahlung: Bezahlung;
  /**
   * **Kontakt für Rückfragen** (A6-4, Alwin 16.10.2026: „je Veranstaltung“) – E-Mail-Adresse, steht auf „Deine
   * Anmeldung“. Die Mail von ChurchTools kommt von noreply; Antworten darauf landen nirgends. Leer = keine Angabe.
   */
  kontakt: string;
  /**
   * **Wann die Preise zuletzt geändert wurden** (`YYYY-MM-DD`, A6-5c #623) – damit die Nachprüfung erkennt, dass ein
   * abweichender Betrag nur an einer späteren Preisänderung liegt. `null` = nicht bekannt (vor dem 17.10.2026).
   */
  preiseGeaendert: string | null;
  /** Die gemerkte Wahl der Teilnehmerliste (A8-1) – Spalten und Sortierung; fehlt = Standard (`druckliste.ts`). */
  druck?: { spalten: string[]; sortierung: 'nachname' | 'alter' | 'anmeldung' };
}

const geltung = z.enum(['person', 'anmeldung']);
const cent = z.number().int().min(0).max(10_000_000);
const preisSchema = z.object({
  grundpreis: z.object({
    art: z.enum(['fest', 'auswahl']),
    betragCent: cent,
    gilt: geltung,
    auswahlName: z.string().max(60),
    optionen: z
      .array(
        z.object({
          name: z.string().max(80),
          preisCent: cent,
          kontingent: z.number().int().min(0),
          belegt: z.number().int().min(0),
          personenJe: z.number().int().min(0).default(0),
        }),
      )
      .max(30),
  }),
  alter: z
    .array(
      z.object({
        von: z.number().int().min(0),
        bis: z.number().int().min(0).nullable(),
        art: z.enum(['frei', 'prozent', 'fest']),
        wert: z.number().min(0),
      }),
    )
    .max(10),
  anpassungen: z
    .array(
      z.object({
        art: z.enum(['rabatt', 'zuschlag']),
        bezeichnung: z.string().max(80),
        bedingung: z.enum(['immer', 'fruehbucher', 'abKind']),
        bis: z.string().max(10),
        abKind: z.number().int().min(0),
        einheit: z.enum(['euro', 'prozent']),
        wert: z.number().min(0),
        gilt: geltung,
      }),
    )
    .max(10),
  extras: z
    .array(z.object({ bezeichnung: z.string().max(80), preisCent: cent, gilt: geltung }))
    .max(10),
});
const feldSchema = z.object({
  id: z.string().min(1).max(20),
  art: z.enum(['fest', 'standard', 'eigen', 'preis']),
  typ: z.enum([
    'name',
    'email',
    'tel',
    'text',
    'textarea',
    'janein',
    'check',
    'radio',
    'select',
    'multi',
    'date',
    'number',
    'info',
    // Seit A5 (Baukasten). Neue Werte im enum lassen ältere Einstellungen lesbar.
    'ueberschrift',
    'trenner',
    'privacy',
    'price',
    // Seit A6-2b. Ein älteres Formular-Paket kennt sie nicht und kann solche Formulare nicht lesen – das Paket
    // deshalb immer zusammen mit der Erweiterung aktualisieren (docs/betrieb/ANMELDUNGEN.md).
    'erziehungsberechtigte',
    'unterschrift',
  ]),
  frage: z.string().max(200),
  hilfe: z.string().max(400),
  zustand: z.enum(['aus', 'freiwillig', 'pflicht']),
  antworten: z.array(z.string().max(80)).max(20),
  verborgen: z.array(z.string().max(80)).max(20).optional(),
});
// Farben nur in Hex-Schreibweise – sie landen in einem style-Attribut.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const hexOderNull = hex.nullable();
const schrift = z.enum(['standard', 'rund', 'serif', 'klassisch', 'lesbar']);
const zeitpunkt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const einstellungenSchema = z.object({
  termin: z
    .object({
      beginn: zeitpunkt,
      ende: zeitpunkt.nullable(),
      ort: z.string().max(200),
      terminId: z.number().int().positive().nullable(),
      kalenderId: z.number().int().positive().nullable().optional(),
    })
    .nullable()
    // Seit A2 (#480); fehlt es in älteren Einstellungen, gibt es eben noch kein Datum.
    .default(null),
  preis: preisSchema,
  formular: z.object({
    anmeldung: z.array(feldSchema).max(30),
    person: z.array(feldSchema).max(30),
  }),
  // Seit dem Entwurf v3 (A5) ist jede Angabe einzeln einstellbar. Ältere Einstellungen (nur Vorlage, Farbe,
  // Feldstil, Knöpfe, Text) bleiben lesbar: Was fehlt, kommt aus ihrer Vorlage (`mitVorgaben`). Unbekannte
  // Angaben (gemeindename, schrift … aus Zwischenständen) lässt zod weg.
  gestaltung: z
    .object({
      vorlage: z.enum(['klassisch', 'foto', 'karte', 'bunt', 'geteilt', 'gross']),
      farbe: hex,
      feldstil: z.enum(['kasten', 'linie', 'gefuellt']),
      knoepfe: z.enum(['eckig', 'leicht', 'rund']),
      text: z.string().max(1200),
      aufbau: z.enum(['kopfband', 'seite', 'geteilt', 'karte']).optional(),
      kopfHoehe: z.enum(['klein', 'mittel', 'gross']).optional(),
      kopfAusrichtung: z.enum(['links', 'mitte']).optional(),
      logo: z.enum(['ct', 'eigen', 'keins']).optional(),
      // Nur Adressen des ChurchTools-Bilddiensts – der Wert landet in einem style-/src-Attribut.
      logoUrl: z
        .string()
        .max(300)
        .regex(/^https:\/\/[^\s"'()<>]+$/)
        .nullable()
        .optional(),
      logoOrt: z.enum(['oben', 'links']).optional(),
      hintergrund: z.enum(['farbe', 'muster', 'bild']).optional(),
      muster: z.enum(['punkte', 'konfetti', 'sterne', 'wellen', 'raster']).optional(),
      musterfarbe: hexOderNull.optional(),
      seitenfarbe: hexOderNull.optional(),
      kartenfarbe: hexOderNull.optional(),
      schriftfarbe: hexOderNull.optional(),
      kopfSchrift: schrift.optional(),
      textSchrift: schrift.optional(),
      gross: z.boolean().optional(),
      ecken: z.enum(['eckig', 'rund', 'sehrrund']).optional(),
      schatten: z.boolean().optional(),
      rahmen: z.boolean().optional(),
      bunt: z.boolean().optional(),
      knopfVoll: z.boolean().optional(),
      breite: z.enum(['schmal', 'normal', 'breit']).optional(),
    })
    .transform((g): Gestaltung => mitVorgaben(g)),
  ctFelder: z.record(z.string(), z.number().int().positive()),
  wer: z.enum(['familie', 'einzeln', 'kinder']),
  plaetze: z.object({
    zeigen: z.enum(['immer', 'knapp', 'nie']),
    knappUnter: z.number().int().min(1),
  }),
  // Seit A3 (#486). Mit Standardwert: Einstellungen, die vor dem Feld geschrieben wurden, bleiben lesbar.
  loeschfristMonate: z.number().int().min(1).max(36).default(3),
  // Seit A4. Mit Standardwert, damit ältere Einstellungen lesbar bleiben. (Zod gibt beim Lesen ohnehin ein
  // neues Objekt zurück – getestet in formular.test.ts –, die Funktion macht das nur ausdrücklich.)
  bezahlung: z
    .object({
      kontoinhaber: z.string().max(70),
      iban: z.string().max(34),
      bic: z.string().max(11),
      fristTage: z.number().int().min(0).max(365),
      zweck: z.string().max(ZWECK_MAX),
      // Seit A7-2: abgewählte Zahlarten der Gemeinde – nur, wenn welche abgewählt sind (hält die Einstellungen kurz).
      ohneZahlarten: z.array(z.string().max(40)).max(20).optional(),
    })
    .default(() => ({ ...STANDARD_BEZAHLUNG })),
  // Seit A6-4. Mit Standardwert, damit ältere Einstellungen lesbar bleiben.
  kontakt: z.string().max(120).default(''),
  preiseGeaendert: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  // Seit A8-1: nur, wenn jemand eine Liste mit eigener Wahl gedruckt hat (hält die Einstellungen kurz).
  druck: z
    .object({
      spalten: z.array(z.string().max(60)).max(40),
      sortierung: z.enum(['nachname', 'alter', 'anmeldung']),
    })
    .optional(),
});

// ── Speicherformat v2 (A5): unsichtbar, gepackt, mit Sicherung ──────────────────────────────────

/**
 * Der Satz, der in ChurchTools in „Infos“ der Gruppe steht (Alwin, 13.10.2026: der sichtbare Datenblock
 * „sieht nicht gut aus“). Darunter stehen die Einstellungen als **Markdown-Link-Definition** – ChurchTools
 * zeigt die Beschreibung als Markdown und eine Link-Definition gar nicht an (gemessen, Übersicht, Infos-Seite
 * und Editor). Die Schnittstelle liefert sie unverändert, auch `/publicgroups` ohne Login.
 */
export const HINWEIS_SATZ =
  'Diese Anmeldung wird mit der Erweiterung **Anmeldungen** verwaltet. Einstellungen bitte dort ändern.';

/** Beginn der unsichtbaren Zeile; dahinter der gepackte Code (deflate, Base64url). */
export const VERWEIS = '[anmeldung]: #v2:';
const VERWEIS_ZEILE = /^\[anmeldung\]: #v2:([A-Za-z0-9_-]+)[ \t]*$/m;

/**
 * **Die Einstellungen als gepackter Code** – geprüft (zod), als JSON, gepackt (deflate), Base64url. Packen
 * schrumpft den Block auf rund ein Drittel; damit passen auch große Freizeiten in die 5.000 Zeichen (A5-Messung:
 * eine volle Freizeit mit 10 Fragen braucht ungepackt 5.532).
 */
export function einstellungenPacken(e: OeffentlicheEinstellungen): string {
  const geprueft = einstellungenSchema.parse(e);
  const kurz = { ...geprueft, gestaltung: nurAbweichungen(geprueft.gestaltung) };
  return base64url(deflateSync(strToU8(JSON.stringify(kurz)), { level: 9 }));
}

/**
 * Von der Gestaltung nur, was vom Startpunkt abweicht (Entwurf v3: über zwanzig Angaben). Beim Lesen ergänzt
 * `mitVorgaben` den Rest aus der Vorlage – derselbe Weg wie für ältere Einstellungen. Ohne das wuchs der Code
 * auf über 1.000 Zeichen (gemessen) und brauchte für die Sicherung zwei Felder statt einem.
 */
function nurAbweichungen(g: Gestaltung): Partial<Gestaltung> {
  const start = vorlageVon(g.vorlage).werte as Partial<Gestaltung>;
  const pflicht = new Set<keyof Gestaltung>(['vorlage', 'farbe', 'feldstil', 'knoepfe', 'text']);
  return Object.fromEntries(
    Object.entries(g).filter(
      ([k, v]) => pflicht.has(k as keyof Gestaltung) || start[k as keyof Gestaltung] !== v,
    ),
  );
}

/** Gegenstück zu `einstellungenPacken`; `null` bei kaputtem oder ungültigem Code – nie eine Ausnahme. */
export function einstellungenEntpacken(code: string): OeffentlicheEinstellungen | null {
  try {
    const r = einstellungenSchema.safeParse(JSON.parse(strFromU8(inflateSync(ausBase64url(code)))));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/**
 * **Was in ChurchTools sichtbar bleibt** – die Beschreibung ohne unsere Zeile. Hat jemand dort eigenen Text
 * geschrieben, bleibt er stehen; ist sie leer (oder noch im alten Format), steht der Hinweissatz da.
 */
export function sichtbarerText(beschreibung: string | null | undefined): string {
  if (!beschreibung || beschreibung.startsWith(EINSTELLUNGEN_KENNUNG)) return HINWEIS_SATZ;
  const ohne = beschreibung.replace(VERWEIS_ZEILE, '').trim();
  return ohne || HINWEIS_SATZ;
}

/**
 * **Einstellungen als Text für die Gruppen-Beschreibung** – der sichtbare Text (Standard: `HINWEIS_SATZ`),
 * darunter unsichtbar der gepackte Code. Wirft, wenn es die Höchstlänge sprengt – dann darf nichts
 * gespeichert werden, sonst lehnt ChurchTools ab (400) oder es geht ein Teil verloren.
 */
export function einstellungenAlsText(
  e: OeffentlicheEinstellungen,
  sichtbar: string = HINWEIS_SATZ,
): string {
  const text = `${sichtbar.trim()}\n\n${VERWEIS}${einstellungenPacken(e)}`;
  if (text.length > BESCHREIBUNG_MAX)
    throw new Error(
      `Die Einstellungen sind ${text.length} Zeichen lang, erlaubt sind ${BESCHREIBUNG_MAX}. Bitte Begrüßungstext oder Hinweise kürzen.`,
    );
  return text;
}

/** Wie voll die Beschreibung ist (0–1) – für die Platzanzeige im Baukasten. */
export function platzBelegt(e: OeffentlicheEinstellungen, sichtbar: string = HINWEIS_SATZ): number {
  const laenge = `${sichtbar.trim()}\n\n${VERWEIS}${einstellungenPacken(e)}`.length;
  return laenge / BESCHREIBUNG_MAX;
}

/**
 * **Trägt die Beschreibung Einstellungen der Anmeldungen?** – altes oder neues Format, ob lesbar oder nicht.
 * Die EINE Stelle, an der eine Veranstaltung an ihrer Beschreibung erkannt wird (Übersicht, „Deine Gruppen“).
 */
export function traegtEinstellungen(beschreibung: string | null | undefined): boolean {
  return (
    !!beschreibung &&
    (beschreibung.startsWith(EINSTELLUNGEN_KENNUNG) || VERWEIS_ZEILE.test(beschreibung))
  );
}

/** Steht die Beschreibung noch im alten, sichtbaren Format (v1)? Dann schreibt die Erweiterung sie neu. */
export function istAltesFormat(beschreibung: string | null | undefined): boolean {
  return !!beschreibung && beschreibung.startsWith(EINSTELLUNGEN_KENNUNG);
}

/**
 * **Einstellungen aus der Gruppen-Beschreibung lesen** – das neue Format (unsichtbare Zeile, irgendwo im Text)
 * und das alte (`anmeldung:v1:` + JSON am Anfang). `null`, wenn keine oder keine gültigen Einstellungen
 * darin stehen – nie eine Ausnahme: Die öffentliche Seite zeigt dann „Diese Anmeldung ist gerade nicht
 * verfügbar“ statt eines halben Formulars.
 */
export function einstellungenLesen(
  beschreibung: string | null | undefined,
): OeffentlicheEinstellungen | null {
  if (!beschreibung) return null;
  const v2 = VERWEIS_ZEILE.exec(beschreibung);
  if (v2) return einstellungenEntpacken(v2[1]);
  if (!beschreibung.startsWith(EINSTELLUNGEN_KENNUNG)) return null;
  try {
    const roh: unknown = JSON.parse(beschreibung.slice(EINSTELLUNGEN_KENNUNG.length));
    const r = einstellungenSchema.safeParse(roh);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

// ── Sicherung in den Beschreibungen der Systemfelder ────────────────────────────────────────────

/**
 * **Die Sicherung** (Alwin, 13.10.2026: „versteckt + Sicherung“). Wer die Beschreibung in ChurchTools
 * bearbeitet und speichert, verliert die unsichtbare Zeile – der Editor speichert nur, was er zeigt
 * (gemessen). Deshalb steht derselbe Code zusätzlich in den Beschreibungen der Systemfelder (Betrag,
 * Bezahlt …): je höchstens 1.024 Zeichen (gemessen), Organisatoren dürfen dort schreiben, öffentlich ist es
 * nicht. Jeder Teil trägt Nummer und Anzahl, damit ein unvollständiger Satz erkannt wird.
 */
export const SICHERUNG_MAX = 1024;
const SICHERUNG_KOPF = 'anmeldung-sicherung:';
const SICHERUNG_TEIL = /^anmeldung-sicherung:(\d+)\/(\d+):([A-Za-z0-9_-]*)$/;

/** Den Code einer Beschreibung in Teile für die Systemfelder zerlegen; `null`, wenn kein Code darin steht. */
export function sicherungTeile(beschreibung: string): string[] | null {
  const v2 = VERWEIS_ZEILE.exec(beschreibung);
  if (!v2) return null;
  const code = v2[1];
  // Platz je Teil: 1.024 minus Kopf mit zwei bis zu zweistelligen Zahlen.
  const groesse = SICHERUNG_MAX - SICHERUNG_KOPF.length - 6;
  const anzahl = Math.max(1, Math.ceil(code.length / groesse));
  return Array.from(
    { length: anzahl },
    (_, i) => `${SICHERUNG_KOPF}${i + 1}/${anzahl}:${code.slice(i * groesse, (i + 1) * groesse)}`,
  );
}

/**
 * Die Sicherung wieder zusammensetzen; `null`, wenn Teile fehlen oder der Code nicht lesbar ist. (Fehlt ein Teil,
 * scheitert auch schon das Entpacken – die Zählung ist die zweite Sicherung dahinter; die Gegenprobe zeigte, dass
 * sie allein keinen Test fallen lässt.)
 */
export function sicherungLesen(
  notizen: (string | null | undefined)[],
): OeffentlicheEinstellungen | null {
  const teile = new Map<number, string>();
  let anzahl = 0;
  for (const n of notizen) {
    const m = n ? SICHERUNG_TEIL.exec(n.trim()) : null;
    if (!m) continue;
    anzahl = Number(m[2]);
    teile.set(Number(m[1]), m[3]);
  }
  if (anzahl === 0 || teile.size !== anzahl) return null;
  const code = Array.from({ length: anzahl }, (_, i) => teile.get(i + 1) ?? '').join('');
  return einstellungenEntpacken(code);
}
