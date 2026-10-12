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
 *  - Die öffentlichen Einstellungen (Preise, Aufbau, Gestaltung) liegen als JSON in der
 *    **Beschreibung der Anmeldegruppe** – die ist ohne Login lesbar, fasst aber höchstens
 *    **5.000 Zeichen**. Der Erweiterungs-Speicher ist ohne Login nicht lesbar.
 */
import { z } from 'zod';
import type { PreisRegeln } from './preis';

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
  | 'privacy'
  | 'price';

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
}

export interface Formular {
  /** Einmal pro Anmeldung (bei Kinder-Events: Kontakt der Eltern). */
  anmeldung: Feld[];
  /** Wiederholt sich für jede angemeldete Person. */
  person: Feld[];
}

/** Bausteine des Baukastens (ohne die festen und vorgegebenen Felder). */
export const BAUSTEINE: { typ: Feldtyp; name: string }[] = [
  { typ: 'text', name: 'Kurzer Text' },
  { typ: 'textarea', name: 'Langer Text' },
  { typ: 'janein', name: 'Ja / Nein' },
  { typ: 'check', name: 'Ankreuzen' },
  { typ: 'radio', name: 'Eine Antwort' },
  { typ: 'select', name: 'Auswahlliste' },
  { typ: 'multi', name: 'Mehrere Antworten' },
  { typ: 'date', name: 'Datum' },
  { typ: 'number', name: 'Zahl' },
  { typ: 'info', name: 'Hinweistext' },
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

/** Antwort eines Feldes: Text, Ja/Nein, angekreuzt, gewählte Antworten. */
export type Antwort = string | boolean | string[] | { vor: string; nach: string } | undefined;

export interface Antworten {
  anmeldung: Record<string, Antwort>;
  personen: Record<string, Antwort>[];
}

const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * **Welche Pflichtangaben fehlen** – Schlüssel wie `anmeldung.mail`, `personen.1.birth`,
 * `anmeldung.name.vor`. Leer = alles da. Dieselbe Prüfung im Formular und in der Nachprüfung.
 */
export function pruefeAntworten(f: Formular, a: Antworten): string[] {
  const fehlt: string[] = [];
  const pruefe = (x: Feld, wert: Antwort, pfad: string) => {
    if (x.typ === 'info' || x.typ === 'price' || x.zustand === 'aus') return;
    if (x.typ === 'email' && typeof wert === 'string' && wert.trim() && !MAIL.test(wert.trim())) {
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
    if (typeof wert !== 'string' || !wert.trim()) fehlt.push(pfad);
  };
  for (const x of f.anmeldung) pruefe(x, a.anmeldung[x.id], `anmeldung.${x.id}`);
  if (a.personen.length === 0) fehlt.push('personen');
  a.personen.forEach((p, i) => {
    for (const x of f.person) pruefe(x, p[x.id], `personen.${i}.${x.id}`);
  });
  return fehlt;
}

/** Was an einem Formular nicht stimmt – beim Speichern im Baukasten. */
export function pruefeFormular(f: Formular): string[] {
  const fehler: string[] = [];
  const ids = alleFelder(f).map((x) => x.id);
  if (new Set(ids).size !== ids.length) fehler.push('Zwei Felder haben dieselbe Kennung.');
  for (const x of alleFelder(f)) {
    if (x.art === 'eigen' && !x.frage.trim()) fehler.push('Ein Feld hat keine Frage.');
    if (
      (x.typ === 'radio' || x.typ === 'select' || x.typ === 'multi') &&
      x.antworten.filter((s) => s.trim()).length < 2
    )
      fehler.push(`„${x.frage}“ braucht mindestens zwei Antworten.`);
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
    case 'textarea':
      return { ort: 'gruppenfeld', fieldTypeCode: 'textarea', optionen: [] };
    case 'number':
      return { ort: 'gruppenfeld', fieldTypeCode: 'number', optionen: [] };
  }
}

/**
 * Gruppenfelder, die jede Anmeldegruppe zusätzlich bekommt. Betrag und Aufschlüsselung als **Text**
 * (A0: Zahlen erscheinen in Mails als „180.8“). Alle beim Anmelden befüllten Felder müssen im
 * ChurchTools-Anmeldeformular freigegeben sein – auch wenn unsere Seite sie nicht als Eingabe zeigt.
 */
export const SYSTEMFELDER = [
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
] as const;

// ── Öffentliche Einstellungen in der Gruppen-Beschreibung ──────────────────────────────────────

/** Höchstlänge der Gruppen-Beschreibung (gemessen A0: 5.000 geht, 20.000 → 400). */
export const BESCHREIBUNG_MAX = 5000;
/**
 * Erkennungszeichen am Anfang der Beschreibung, damit eine normale Beschreibung nie als Einstellung gilt.
 *
 * **Neue Angaben im Format brauchen einen Standardwert (`.default(…)`)** – sonst werden alle Einstellungen,
 * die vorher geschrieben wurden, unlesbar und die Veranstaltungen fallen aus der Liste (an der Test-Instanz
 * am 12.10.2026 mit `loeschfristMonate` passiert). Erst eine Änderung, die alte Werte anders DEUTET,
 * braucht `anmeldung:v2:` und eine Umwandlung.
 */
export const EINSTELLUNGEN_KENNUNG = 'anmeldung:v1:';

export interface Gestaltung {
  vorlage: 'klassisch' | 'foto' | 'karte' | 'bunt' | 'geteilt' | 'gross';
  farbe: string;
  feldstil: 'kasten' | 'linie' | 'gefuellt';
  knoepfe: 'eckig' | 'rund';
  text: string;
  gemeindename: boolean;
}

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
    'privacy',
    'price',
  ]),
  frage: z.string().max(200),
  hilfe: z.string().max(400),
  zustand: z.enum(['aus', 'freiwillig', 'pflicht']),
  antworten: z.array(z.string().max(80)).max(20),
});
const zeitpunkt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const einstellungenSchema = z.object({
  termin: z
    .object({
      beginn: zeitpunkt,
      ende: zeitpunkt.nullable(),
      ort: z.string().max(200),
      terminId: z.number().int().positive().nullable(),
    })
    .nullable()
    // Seit A2 (#480); fehlt es in älteren Einstellungen, gibt es eben noch kein Datum.
    .default(null),
  preis: preisSchema,
  formular: z.object({
    anmeldung: z.array(feldSchema).max(30),
    person: z.array(feldSchema).max(30),
  }),
  gestaltung: z.object({
    vorlage: z.enum(['klassisch', 'foto', 'karte', 'bunt', 'geteilt', 'gross']),
    // Nur eine Farbe in Hex-Schreibweise – der Wert landet in einem style-Attribut.
    farbe: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    feldstil: z.enum(['kasten', 'linie', 'gefuellt']),
    knoepfe: z.enum(['eckig', 'rund']),
    text: z.string().max(1200),
    gemeindename: z.boolean(),
  }),
  ctFelder: z.record(z.string(), z.number().int().positive()),
  wer: z.enum(['familie', 'einzeln', 'kinder']),
  plaetze: z.object({
    zeigen: z.enum(['immer', 'knapp', 'nie']),
    knappUnter: z.number().int().min(1),
  }),
  // Seit A3 (#486). Mit Standardwert: Einstellungen, die vor dem Feld geschrieben wurden, bleiben lesbar.
  loeschfristMonate: z.number().int().min(1).max(36).default(3),
});

/**
 * **Einstellungen als Text für die Gruppen-Beschreibung.** Wirft, wenn der Text die Höchstlänge
 * sprengt – dann darf nichts gespeichert werden, sonst lehnt ChurchTools ab (400) oder es geht ein
 * Teil verloren. Die Erweiterung zeigt die Meldung und nennt, was zu kürzen ist.
 */
export function einstellungenAlsText(e: OeffentlicheEinstellungen): string {
  const text = EINSTELLUNGEN_KENNUNG + JSON.stringify(einstellungenSchema.parse(e));
  if (text.length > BESCHREIBUNG_MAX)
    throw new Error(
      `Die Einstellungen sind ${text.length} Zeichen lang, erlaubt sind ${BESCHREIBUNG_MAX}. Bitte Begrüßungstext oder Hinweise kürzen.`,
    );
  return text;
}

/**
 * **Einstellungen aus der Gruppen-Beschreibung lesen.** `null`, wenn die Beschreibung keine
 * Einstellungen enthält oder sie nicht gültig sind – nie eine Ausnahme: Die öffentliche Seite zeigt
 * dann „Diese Anmeldung ist gerade nicht verfügbar“ statt eines halben Formulars.
 */
export function einstellungenLesen(
  beschreibung: string | null | undefined,
): OeffentlicheEinstellungen | null {
  if (!beschreibung || !beschreibung.startsWith(EINSTELLUNGEN_KENNUNG)) return null;
  try {
    const roh: unknown = JSON.parse(beschreibung.slice(EINSTELLUNGEN_KENNUNG.length));
    const r = einstellungenSchema.safeParse(roh);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
