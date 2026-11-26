/**
 * **Ja / Vielleicht – der Speicher-Kern** (Bauplan E5c-1b, „Verfügbarkeit“). Nur Regeln, keine Oberfläche, keine
 * Netzwerk-Technik: Der Aufrufer reicht einen `EntwurfPort` herein (derselbe Anschluss wie bei den Entwürfen).
 *
 * Wo es liegt: im Speicher der Erweiterung, **eine Kategorie je Dienstgruppe** (`antwortenSchublade`), darin
 * **ein Wert je Person** mit ihren Antworten je Termin. „Nein“ gehört nicht hierher – das ist eine
 * ChurchTools-Abwesenheit (E5c-0).
 *
 * Wie bei den Entwürfen (`entwuerfe.ts`, dort die Messungen):
 * - Ein Wert hat kein Änderungsdatum, zwei gleichzeitige `POST` → zwei Werte. Darum steht `stand` im Wert; beim
 *   Lesen gewinnt der **neueste** (bei Gleichstand die höhere Wert-ID), die übrigen sind Doppel und werden beim
 *   Schreiben entfernt.
 * - Eine Person schreibt in **alle ihre Dienstgruppen dasselbe**. Beim Lesen über mehrere Kategorien gilt der
 *   neueste `stand` (bei Gleichstand die Kategorie mit der kleineren ID).
 * - **Kein Schreibvorgang wird automatisch wiederholt.** Erfolg ist erst, was nachgelesen dasteht – nicht der
 *   Statuscode (Lehre vom 11.08.2026). Vorübergehende Fehler sind nicht „kein Recht“ (`grundAus` aus den
 *   Entwürfen, eine Regel).
 */
import {
  inhaltAus,
  MAX_ZEICHEN,
  wertAendern,
  wertAnlegen,
  werteLesen,
  wertLoeschen,
  type KategorieAngabe,
  type Wert,
} from '../ct/modulDaten';
import { grundAus, type EntwurfPort } from './entwuerfe';

const ART = 'dienstplaner-verfuegbarkeit';
const FASSUNG = 1;

/** „Tag“ als `YYYY-MM-DD` – Zeichenketten lassen sich so ordnen. */
const TAG = /^\d{4}-\d{2}-\d{2}$/;

export type Zusage = 'ja' | 'vielleicht';

/** So lang darf ein Name in einer gesuchten Vertretung sein (länger wird gekürzt). */
const MAX_NAME = 80;

/** So lang darf die Notiz zu einer Antwort sein (E5c-2) – länger wird beim Lesen und Schreiben gekürzt. */
export const MAX_NOTIZ = 140;

/**
 * Eine Antwort auf einen Termin. `tag` = Tag des Termins (daran erkennt man Vergangenes).
 * **E5c-2, beides optional und abwärtskompatibel** (`fassung` bleibt 1; alte Werte ohne die Felder gelten weiter):
 * - `notiz`: Kommentar der Person („nur bis 12 Uhr“), höchstens `MAX_NOTIZ` Zeichen.
 * - `dienste`: die Dienste (ChurchTools-Dienst-IDs), für die die Antwort gilt; **fehlt = alle**. Nie leer, aufsteigend.
 */
export interface Antwort {
  a: Zusage;
  tag: string;
  notiz?: string;
  dienste?: number[];
}

/** Je Termin (ID als Text) die Antwort. */
export type Antworten = Record<string, Antwort>;

/**
 * **„Vertretung gesucht“** (Bauplan E5c-6): Wer seinen zugesagten Dienst abgibt und eine Vertretung sucht, merkt es sich hier –
 * im **eigenen** Wert der Ablage (das Team darf sie lesen, der Absage-Kommentar am Platz ist für Mitarbeitende unlesbar).
 * Optional und abwärtskompatibel wie `notiz`/`dienste` (`fassung` bleibt 1; alte Werte ohne das Feld gelten weiter).
 * - `dienst`: der Dienst (ChurchTools-Dienst-ID), für den eine Vertretung gesucht wird,
 * - `gefragt`: die Personen, die gefragt wurden (IDs in der Reihenfolge der Auswahl; leer = niemand gefragt, nur das Schild),
 * - `seit`: ISO-Zeitpunkt der Suche,
 * - `tag`: Tag des Termins (daran erkennt man Vergangenes – es fällt beim Schreiben heraus, wie bei den Antworten),
 * - `index` (optional, später ergänzt): der `index` des abgesagten Platzes (`null` bei einem Dienst mit nur einem Platz). Er bleibt über alle
 *   Ersetzungen gleich (gemessen 21.11.2026: Dienst 1224 → 1227 → 1230, immer `index: 1`) – die Suche gilt für **genau diesen** Platz. **Fehlt er**
 *   (alte Werte), gilt die alte Regel „irgendein Platz des Dienstes“.
 * - `name`: Name der Person, die eine Vertretung sucht – damit das Team ihn ohne weitere Abfrage zeigen kann („Anna sucht …“),
 * - `gefragtNamen`: die Namen der Gefragten (parallel zu `gefragt`) – fürs Schild in „Planen“ („gefragt: Ben, Finn“).
 */
export interface Vertretung {
  dienst: number;
  gefragt: number[];
  seit: string;
  tag: string;
  index?: number | null;
  name: string;
  gefragtNamen: string[];
}

/** Je Termin **und Dienst** (`vertretungsSchluessel`) die gesuchte Vertretung. */
export type Vertretungen = Record<string, Vertretung>;

/** Der Schlüssel in `Vertretungen`: Termin und Dienst (an einem Termin kann man zwei Dienste haben). */
export const vertretungsSchluessel = (terminId: number, dienstId: number): string =>
  `${terminId}:${dienstId}`;

interface Ablage {
  art: typeof ART;
  fassung: typeof FASSUNG;
  person: number;
  antworten: Antworten;
  /** Nur, wenn eine Vertretung gesucht wird (E5c-6) – sonst fehlt das Feld ganz. */
  vertretungen?: Vertretungen;
  /** ISO-Zeitpunkt des Speicherns. */
  stand: string;
}

/** Ein gültiger Wert einer Person, mit der Wert-ID dahinter. */
export interface PersonenWert {
  wert: Wert;
  person: number;
  antworten: Antworten;
  vertretungen: Vertretungen;
  stand: string;
}

export type VerfuegbarkeitGrund =
  /** Niemand mehr angemeldet. Nichts ist passiert. */
  | 'abgemeldet'
  /** ChurchTools verweigert den Speicher dieser Gruppe. */
  | 'kein-recht'
  /** Netz, Zeitüberschreitung, Drosselung, 5xx – nicht bestätigt; die Eingabe bleibt beim Aufrufer. */
  | 'voruebergehend'
  /** ChurchTools hat das Schreiben angenommen, nachgelesen steht es aber nicht da. */
  | 'nicht-angekommen'
  /** Die Antworten wären zu lang für einen Wert – nichts wurde geschrieben. */
  | 'zu-gross';

export type KategorieErgebnis =
  | { kategorie: number; ok: true }
  | { kategorie: number; ok: false; grund: VerfuegbarkeitGrund };

const VERWEIGERT =
  'ChurchTools erlaubt dir nicht, die Antworten dieser Dienstgruppe zu ändern. Bitte die Verantwortlichen ' +
  'nach den Rechten für die Antworten der Gruppe fragen.';

// ── Schublade je Dienstgruppe ────────────────────────────────────────────────

/**
 * Die Kategorie für die Ja/Vielleicht-Antworten einer Dienstgruppe. Das Kürzel hängt an der ID, nicht am
 * (änderbaren) Namen. Stand und Einrichten: `schubladenStand` (`entwuerfe.ts`) und `kategorieSicherstellen`.
 */
export function antwortenSchublade(gruppe: { id: number; name: string }): KategorieAngabe {
  return {
    kuerzel: `dienstplaner-antworten-${gruppe.id}`,
    name: `Antworten ${gruppe.name}`.slice(0, 50),
    beschreibung:
      `Ja/Vielleicht-Antworten der Dienstgruppe „${gruppe.name}“ aus „Verfügbarkeit“ – vom ` +
      'Dienstplaner angelegt, bitte nicht löschen.',
  };
}

// ── Lesen ────────────────────────────────────────────────────────────────────

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const istText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';
const istGanzeZahl = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/**
 * **Die eine Stelle, die eine Antwort in ihre Form bringt** – beim Lesen UND beim Schreiben (sonst läse das Nachlesen
 * etwas anderes zurück, als geschrieben wurde): Notiz getrimmt und auf `MAX_NOTIZ` gekürzt, leer → weglassen; Dienste nur
 * ganze Zahlen, ohne Doppel, aufsteigend, leer → weglassen (= alle). Ein falscher Typ lässt nur das Feld weg.
 */
export function antwortBereinigt(e: {
  a: Zusage;
  tag: string;
  notiz?: unknown;
  dienste?: unknown;
}): Antwort {
  const aus: Antwort = { a: e.a, tag: e.tag };
  if (typeof e.notiz === 'string') {
    const notiz = e.notiz.trim().slice(0, MAX_NOTIZ).trim();
    if (notiz !== '') aus.notiz = notiz;
  }
  if (Array.isArray(e.dienste)) {
    const dienste = [...new Set((e.dienste as unknown[]).filter(istGanzeZahl))].sort(
      (x, y) => x - y,
    );
    if (dienste.length > 0) aus.dienste = dienste;
  }
  return aus;
}

/**
 * **Die eine Stelle, die eine gesuchte Vertretung in ihre Form bringt** – beim Lesen UND beim Schreiben: `dienst` ganze Zahl,
 * `gefragt` nur ganze Zahlen ohne Doppel aufsteigend, `seit` Text, `tag` ein Tag. Unbrauchbar → `null` (der Eintrag fällt weg).
 */
export function vertretungBereinigt(
  v: Partial<Record<keyof Vertretung, unknown>> | null,
): Vertretung | null {
  if (!v || !istGanzeZahl(v.dienst) || typeof v.tag !== 'string' || !TAG.test(v.tag)) return null;
  if (!istText(v.seit)) return null;
  const gefragt = Array.isArray(v.gefragt)
    ? [...new Set((v.gefragt as unknown[]).filter(istGanzeZahl))]
    : [];
  const text = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, MAX_NAME) : '');
  const gefragtNamen = Array.isArray(v.gefragtNamen)
    ? (v.gefragtNamen as unknown[]).map(text).filter((n) => n !== '')
    : [];
  const index = v.index === null ? null : istGanzeZahl(v.index) ? v.index : undefined;
  return {
    dienst: v.dienst,
    gefragt,
    seit: v.seit,
    tag: v.tag,
    // Fehlt der Platz-Index, bleibt das Feld weg (alte Regel) – `null` heißt „Dienst mit nur einem Platz“.
    ...(index !== undefined ? { index } : {}),
    name: text(v.name) || 'Jemand',
    gefragtNamen,
  };
}

/** Ein Wert → Antworten einer Person, wenn er von uns ist und vollständig; sonst `null`. Einzelne kaputte Einträge fallen weg. */
export function personenWertAus(w: Wert): PersonenWert | null {
  const a = inhaltAus<Partial<Ablage>>(w, ART, FASSUNG);
  if (!a || !istZahl(a.person) || !istText(a.stand)) return null;
  if (!a.antworten || typeof a.antworten !== 'object' || Array.isArray(a.antworten)) return null;
  const antworten: Antworten = {};
  for (const [termin, e] of Object.entries(a.antworten)) {
    const v = e as Partial<Record<keyof Antwort, unknown>> | null;
    if (v && (v.a === 'ja' || v.a === 'vielleicht') && typeof v.tag === 'string' && TAG.test(v.tag))
      antworten[termin] = antwortBereinigt({
        a: v.a,
        tag: v.tag,
        notiz: v.notiz,
        dienste: v.dienste,
      });
  }
  const vertretungen: Vertretungen = {};
  if (a.vertretungen && typeof a.vertretungen === 'object' && !Array.isArray(a.vertretungen)) {
    for (const [schluessel, e] of Object.entries(a.vertretungen)) {
      const v = vertretungBereinigt(e);
      if (v) vertretungen[schluessel] = v;
    }
  }
  return { wert: w, person: a.person, antworten, vertretungen, stand: a.stand };
}

/** Neuer als: späterer `stand`, bei Gleichstand die höhere Wert-ID. */
function neuerAls(a: PersonenWert, b: PersonenWert): boolean {
  if (a.stand !== b.stand) return a.stand > b.stand;
  return a.wert.id > b.wert.id;
}

/** Je Person der neueste Wert; die übrigen (Doppel) getrennt. */
function jePerson(werte: Wert[]): {
  je: Map<number, PersonenWert>;
  doppelt: Map<number, Wert[]>;
} {
  const je = new Map<number, PersonenWert>();
  const doppelt = new Map<number, Wert[]>();
  for (const w of werte) {
    const neu = personenWertAus(w);
    if (!neu) continue;
    const da = je.get(neu.person);
    let verlierer: Wert | null = null;
    if (!da) je.set(neu.person, neu);
    else if (neuerAls(neu, da)) {
      je.set(neu.person, neu);
      verlierer = da.wert;
    } else verlierer = w;
    if (verlierer) doppelt.set(neu.person, [...(doppelt.get(neu.person) ?? []), verlierer]);
  }
  return { je, doppelt };
}

export type LesenErgebnis<T> = { ok: true; wert: T } | { ok: false; grund: VerfuegbarkeitGrund };

/** Die Antworten einer Person samt dem Zeitpunkt, an dem sie geschrieben wurden (`stand`). */
export interface StandAntworten {
  antworten: Antworten;
  /** Gesuchte Vertretungen (E5c-6); fehlt = keine. */
  vertretungen?: Vertretungen;
  stand: string;
}

/**
 * **Die eine Regel, welche Antworten gelten, wenn eine Person in mehreren Kategorien (Dienstgruppen) welche hat**
 * (E5c-3 aus `eigeneAntwortenLesen` herausgezogen – die Ansicht „Personen“ braucht sie für alle Personen): Eine Person
 * schreibt in alle ihre Dienstgruppen dasselbe, es gilt der **neueste `stand`**; bei Gleichstand die Kategorie mit der
 * **kleineren ID**. `null`, wenn es keinen Kandidaten gibt.
 */
export function neuesterStand<T extends { stand: string }>(
  kandidaten: readonly { kategorie: number; wert: T }[],
): T | null {
  let beste: T | null = null;
  for (const k of [...kandidaten].sort((a, b) => a.kategorie - b.kategorie)) {
    // Strikt neuer: bei Gleichstand bleibt die Kategorie mit der kleineren ID.
    if (!beste || k.wert.stand > beste.stand) beste = k.wert;
  }
  return beste;
}

/**
 * Die Antworten aller Personen aus mehreren Kategorien zusammenführen: je Person gilt `neuesterStand`. Eingang: je
 * Kategorie das Ergebnis von `alleAntwortenLesen`.
 */
export function antwortenZusammen(
  jeKategorie: ReadonlyMap<number, ReadonlyMap<number, StandAntworten>>,
): Map<number, Antworten> {
  const kandidaten = new Map<number, { kategorie: number; wert: StandAntworten }[]>();
  for (const [kategorie, personen] of jeKategorie)
    for (const [person, wert] of personen)
      kandidaten.set(person, [...(kandidaten.get(person) ?? []), { kategorie, wert }]);
  const zusammen = new Map<number, Antworten>();
  for (const [person, liste] of kandidaten) {
    const beste = neuesterStand(liste);
    if (beste) zusammen.set(person, beste.antworten);
  }
  return zusammen;
}

/**
 * Die gesuchten Vertretungen aller Personen aus mehreren Kategorien: je Person gilt **derselbe** Wert wie bei den Antworten
 * (`neuesterStand`) – eine Regel, damit beides aus demselben Schreibvorgang stammt.
 */
export function vertretungenZusammen(
  jeKategorie: ReadonlyMap<number, ReadonlyMap<number, StandAntworten>>,
): Map<number, Vertretungen> {
  const kandidaten = new Map<number, { kategorie: number; wert: StandAntworten }[]>();
  for (const [kategorie, personen] of jeKategorie)
    for (const [person, wert] of personen)
      kandidaten.set(person, [...(kandidaten.get(person) ?? []), { kategorie, wert }]);
  const zusammen = new Map<number, Vertretungen>();
  for (const [person, liste] of kandidaten) {
    const beste = neuesterStand(liste);
    if (beste?.vertretungen && Object.keys(beste.vertretungen).length > 0)
      zusammen.set(person, beste.vertretungen);
  }
  return zusammen;
}

/** Alle Antworten einer Kategorie, je Person der neueste Wert (mit `stand`) – **frisch**, nie aus einem Cache. */
export async function alleAntwortenLesen(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
): Promise<LesenErgebnis<Map<number, StandAntworten>>> {
  try {
    const { je } = jePerson(await werteLesen(p, modul, kategorie));
    return {
      ok: true,
      wert: new Map(
        [...je].map(([person, v]) => [
          person,
          { antworten: v.antworten, vertretungen: v.vertretungen, stand: v.stand },
        ]),
      ),
    };
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
}

/**
 * Die eigenen Antworten – aus allen Kategorien der Person der Wert mit dem **neuesten `stand`** (bei
 * Gleichstand die kleinere Kategorie-ID, `neuesterStand`). Nacheinander gelesen (ChurchTools drosselt). Ist eine
 * Kategorie nicht lesbar, zählen die übrigen; **keine** lesbar → Fehler (nicht „keine Antworten“). `stand` ist `null`,
 * wenn noch nichts gespeichert ist.
 */
export async function eigeneAntwortenLesen(
  p: EntwurfPort,
  modul: number,
  kategorien: number[],
  person: number,
): Promise<
  LesenErgebnis<{ antworten: Antworten; vertretungen: Vertretungen; stand: string | null }>
> {
  const kandidaten: { kategorie: number; wert: PersonenWert }[] = [];
  let gelesen = 0;
  let fehler: VerfuegbarkeitGrund | null = null;
  for (const kat of [...kategorien].sort((a, b) => a - b)) {
    try {
      const eigener = jePerson(await werteLesen(p, modul, kat)).je.get(person);
      gelesen++;
      if (eigener) kandidaten.push({ kategorie: kat, wert: eigener });
    } catch (e) {
      fehler ??= grundAus(p, e);
    }
  }
  if (gelesen === 0 && fehler) return { ok: false, grund: fehler };
  const beste = neuesterStand(kandidaten);
  return {
    ok: true,
    wert: {
      antworten: beste?.antworten ?? {},
      vertretungen: beste?.vertretungen ?? {},
      stand: beste?.stand ?? null,
    },
  };
}

// ── Schreiben ────────────────────────────────────────────────────────────────

/** Dieselbe Antwort – **alle** Felder (Antwort, Tag, Notiz, Dienste), nach der Bereinigung verglichen. */
export function gleicheAntwort(x: Antwort, y: Antwort): boolean {
  const a = antwortBereinigt(x);
  const b = antwortBereinigt(y);
  const da = a.dienste ?? [];
  const db = b.dienste ?? [];
  return (
    a.a === b.a &&
    a.tag === b.tag &&
    (a.notiz ?? '') === (b.notiz ?? '') &&
    da.length === db.length &&
    da.every((d, i) => d === db[i])
  );
}

/** Gleiche Antworten – unabhängig von der Reihenfolge der Schlüssel. Der Maßstab für „angekommen“ UND „unverändert“. */
export function gleicheAntworten(a: Antworten, b: Antworten): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && gleicheAntwort(a[k], b[k]));
}

/** Gleiche gesuchte Vertretungen – unabhängig von der Reihenfolge der Schlüssel, nach der Bereinigung verglichen. */
export function gleicheVertretungen(x: Vertretungen, y: Vertretungen): boolean {
  const ka = Object.keys(x).sort();
  const kb = Object.keys(y).sort();
  return (
    ka.length === kb.length &&
    ka.every((k, i) => {
      if (k !== kb[i]) return false;
      const a = vertretungBereinigt(x[k]);
      const b = vertretungBereinigt(y[k]);
      return (
        !!a &&
        !!b &&
        a.dienst === b.dienst &&
        a.tag === b.tag &&
        a.index === b.index &&
        a.seit === b.seit &&
        a.name === b.name &&
        a.gefragt.length === b.gefragt.length &&
        a.gefragt.every((id, j) => id === b.gefragt[j]) &&
        a.gefragtNamen.length === b.gefragtNamen.length &&
        a.gefragtNamen.every((n, j) => n === b.gefragtNamen[j])
      );
    })
  );
}

/** Nur die Vertretungen, deren Termin nicht vergangen ist (`tag >= heute`), bereinigt wie beim Lesen. */
function vertretungenAb(v: Vertretungen, heute: string): Vertretungen {
  const aus: Vertretungen = {};
  for (const [k, e] of Object.entries(v)) {
    const b = vertretungBereinigt(e);
    if (b && b.tag >= heute) aus[k] = b;
  }
  return aus;
}

/** Die eigenen Werte einer Kategorie, neueste zuerst. */
function eigeneWerte(werte: Wert[], person: number): PersonenWert[] {
  return werte
    .map(personenWertAus)
    .filter((v): v is PersonenWert => v !== null && v.person === person)
    .sort((a, b) => (neuerAls(a, b) ? -1 : 1));
}

async function eineKategorieSchreiben(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
  person: number,
  antworten: Antworten,
  vertretungen: Vertretungen | undefined,
  heute: string,
): Promise<KategorieErgebnis> {
  const fehl = (grund: VerfuegbarkeitGrund): KategorieErgebnis => ({
    kategorie,
    ok: false,
    grund,
  });
  const stand = p.jetzt();

  // 1. Frisch lesen.
  let eigene: PersonenWert[];
  try {
    eigene = eigeneWerte(await werteLesen(p, modul, kategorie), person);
  } catch (e) {
    return fehl(grundAus(p, e));
  }

  // Die gesuchten Vertretungen (E5c-6) gehören zum Wert der Person: Wer nur die Antworten speichert („Verfügbarkeit“),
  // gibt `undefined` mit – dann bleibt, was FRISCH gelesen dasteht (nicht, was die Seite beim Öffnen sah). Sonst löschte
  // jedes Speichern in „Verfügbarkeit“ die Markierung. Vergangenes fällt auch hier heraus.
  const vertretungenZiel = vertretungenAb(vertretungen ?? eigene[0]?.vertretungen ?? {}, heute);
  const hatVertretung = Object.keys(vertretungenZiel).length > 0;
  const leer = Object.keys(antworten).length === 0 && !hatVertretung;
  const text = JSON.stringify({
    art: ART,
    fassung: FASSUNG,
    person,
    antworten,
    // Ohne Vertretung fehlt das Feld ganz (alte Leser kennen es nicht, der Wert bleibt wie vor E5c-6).
    ...(hatVertretung ? { vertretungen: vertretungenZiel } : {}),
    stand,
  } satisfies Ablage);
  if (!leer && text.length > MAX_ZEICHEN) return fehl('zu-gross');

  // 2. Schreiben – nie wiederholt. Den neuesten eigenen Wert ändern, die Doppel löschen.
  let abgebrochen = false;
  try {
    if (leer) {
      for (const v of eigene) await wertLoeschen(p, modul, kategorie, v.wert.id, VERWEIGERT);
    } else {
      if (eigene[0]) await wertAendern(p, modul, kategorie, eigene[0].wert.id, text, VERWEIGERT);
      else await wertAnlegen(p, modul, kategorie, text, VERWEIGERT);
      for (const v of eigene.slice(1))
        await wertLoeschen(p, modul, kategorie, v.wert.id, VERWEIGERT);
    }
  } catch (e) {
    const g = grundAus(p, e);
    if (g !== 'voruebergehend') return fehl(g);
    abgebrochen = true; // Nicht bestätigt – nachlesen, ob es doch angekommen ist.
  }

  // 3. Nachlesen – erst was dasteht, ist der Erfolg.
  let jetzt: PersonenWert[];
  try {
    jetzt = eigeneWerte(await werteLesen(p, modul, kategorie), person);
  } catch (e) {
    return fehl(grundAus(p, e));
  }
  const da = jetzt[0];
  const angekommen = leer
    ? !da
    : !!da &&
      da.stand === stand &&
      gleicheAntworten(da.antworten, antworten) &&
      gleicheVertretungen(da.vertretungen, vertretungenZiel);
  if (angekommen) return { kategorie, ok: true };
  return fehl(abgebrochen ? 'voruebergehend' : 'nicht-angekommen');
}

/**
 * **Die eigenen Antworten speichern** – in jede übergebene Kategorie dasselbe, **nacheinander** (ChurchTools
 * drosselt). Einträge mit `tag < heute` fallen raus; bleibt nichts übrig, wird der eigene Wert gelöscht statt
 * ein leerer geschrieben. Je Kategorie ein Ergebnis; eine gescheiterte bricht die anderen nicht ab, und nichts
 * wird wiederholt.
 *
 * **`vertretungen` (E5c-6):** `undefined` = **erhalten, was in der Kategorie frisch gelesen dasteht** (der Weg von „Wann kann
 * ich?“ – sonst löschte das Speichern die Markierung „Vertretung gesucht“); ein Wert = genau diese (der Weg von „Vertretung
 * suchen“). Vergangene Termine fallen in beiden Fällen heraus. Ein Wert ohne Antworten **und** ohne Vertretung wird gelöscht.
 */
export async function eigeneAntwortenSchreiben(
  p: EntwurfPort,
  modul: number,
  kategorien: number[],
  person: number,
  antworten: Antworten,
  heute: string,
  vertretungen?: Vertretungen,
): Promise<KategorieErgebnis[]> {
  const bleibt: Antworten = {};
  // Bereinigt wie beim Lesen: Was hier geschrieben wird, ist genau das, was das Nachlesen zurückgibt.
  for (const [termin, e] of Object.entries(antworten))
    if (e.tag >= heute) bleibt[termin] = antwortBereinigt(e);
  const ergebnisse: KategorieErgebnis[] = [];
  for (const kat of kategorien)
    ergebnisse.push(
      await eineKategorieSchreiben(p, modul, kat, person, bleibt, vertretungen, heute),
    );
  return ergebnisse;
}

/**
 * **„Vertretung gesucht“ in den eigenen Wert schreiben** (E5c-6, Schritt a des Ablaufs): erst die eigenen Werte **frisch** aus
 * allen Kategorien lesen (die Antworten und bisherigen Markierungen bleiben, wie sie sind – nicht, was die Seite einmal sah),
 * die Markierung dazutun und überall hineinschreiben, **nacheinander**, nachgelesen. Ist das Lesen nicht möglich, wird
 * **nichts** geschrieben (ein unbekannter Stand würde die Antworten überschreiben). Nichts wird wiederholt.
 *
 * Eine bestehende Markierung zu **demselben Termin und Dienst** wird ersetzt (die neue Suche gilt).
 */
export async function vertretungMarkieren(
  p: EntwurfPort,
  modul: number,
  kategorien: number[],
  person: number,
  neu: { terminId: number; vertretung: Vertretung },
  heute: string,
): Promise<
  { ok: true; ergebnisse: KategorieErgebnis[] } | { ok: false; grund: VerfuegbarkeitGrund }
> {
  const gelesen = await eigeneAntwortenLesen(p, modul, kategorien, person);
  if (!gelesen.ok) return { ok: false, grund: gelesen.grund };
  const bereinigt = vertretungBereinigt(neu.vertretung);
  if (!bereinigt) return { ok: false, grund: 'nicht-angekommen' };
  const vertretungen: Vertretungen = {
    ...gelesen.wert.vertretungen,
    [vertretungsSchluessel(neu.terminId, bereinigt.dienst)]: bereinigt,
  };
  const ergebnisse = await eigeneAntwortenSchreiben(
    p,
    modul,
    kategorien,
    person,
    gelesen.wert.antworten,
    heute,
    vertretungen,
  );
  return { ok: true, ergebnisse };
}
