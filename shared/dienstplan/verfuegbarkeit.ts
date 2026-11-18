/**
 * **Ja / Vielleicht – der Speicher-Kern** (Bauplan E5c-1b, „Wann kann ich?“). Nur Regeln, keine Oberfläche, keine
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

/** Je Termin (ID als Text) die Antwort und der Tag des Termins – an `tag` erkennt man Vergangenes. */
export type Antworten = Record<string, { a: Zusage; tag: string }>;

interface Ablage {
  art: typeof ART;
  fassung: typeof FASSUNG;
  person: number;
  antworten: Antworten;
  /** ISO-Zeitpunkt des Speicherns. */
  stand: string;
}

/** Ein gültiger Wert einer Person, mit der Wert-ID dahinter. */
export interface PersonenWert {
  wert: Wert;
  person: number;
  antworten: Antworten;
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
      `Ja/Vielleicht-Antworten der Dienstgruppe „${gruppe.name}“ aus „Wann kann ich?“ – vom ` +
      'Dienstplaner angelegt, bitte nicht löschen.',
  };
}

// ── Lesen ────────────────────────────────────────────────────────────────────

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const istText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

/** Ein Wert → Antworten einer Person, wenn er von uns ist und vollständig; sonst `null`. Einzelne kaputte Einträge fallen weg. */
export function personenWertAus(w: Wert): PersonenWert | null {
  const a = inhaltAus<Partial<Ablage>>(w, ART, FASSUNG);
  if (!a || !istZahl(a.person) || !istText(a.stand)) return null;
  if (!a.antworten || typeof a.antworten !== 'object' || Array.isArray(a.antworten)) return null;
  const antworten: Antworten = {};
  for (const [termin, e] of Object.entries(a.antworten)) {
    const v = e as Partial<Antworten[string]> | null;
    if (v && (v.a === 'ja' || v.a === 'vielleicht') && typeof v.tag === 'string' && TAG.test(v.tag))
      antworten[termin] = { a: v.a, tag: v.tag };
  }
  return { wert: w, person: a.person, antworten, stand: a.stand };
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

/** Alle Antworten einer Kategorie, je Person der neueste Wert – **frisch**, nie aus einem Cache. */
export async function alleAntwortenLesen(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
): Promise<LesenErgebnis<Map<number, Antworten>>> {
  try {
    const { je } = jePerson(await werteLesen(p, modul, kategorie));
    return { ok: true, wert: new Map([...je].map(([person, v]) => [person, v.antworten])) };
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
}

/**
 * Die eigenen Antworten – aus allen Kategorien der Person der Wert mit dem **neuesten `stand`** (bei
 * Gleichstand die kleinere Kategorie-ID). Nacheinander gelesen (ChurchTools drosselt). Ist eine Kategorie nicht
 * lesbar, zählen die übrigen; **keine** lesbar → Fehler (nicht „keine Antworten“). `stand` ist `null`, wenn
 * noch nichts gespeichert ist.
 */
export async function eigeneAntwortenLesen(
  p: EntwurfPort,
  modul: number,
  kategorien: number[],
  person: number,
): Promise<LesenErgebnis<{ antworten: Antworten; stand: string | null }>> {
  let beste: PersonenWert | null = null;
  let gelesen = 0;
  let fehler: VerfuegbarkeitGrund | null = null;
  for (const kat of [...kategorien].sort((a, b) => a - b)) {
    try {
      const eigener = jePerson(await werteLesen(p, modul, kat)).je.get(person);
      gelesen++;
      // Strikt neuer: bei Gleichstand bleibt die Kategorie mit der kleineren ID.
      if (eigener && (!beste || eigener.stand > beste.stand)) beste = eigener;
    } catch (e) {
      fehler ??= grundAus(p, e);
    }
  }
  if (gelesen === 0 && fehler) return { ok: false, grund: fehler };
  return { ok: true, wert: { antworten: beste?.antworten ?? {}, stand: beste?.stand ?? null } };
}

// ── Schreiben ────────────────────────────────────────────────────────────────

/** Gleiche Antworten – unabhängig von der Reihenfolge der Schlüssel. */
export function gleicheAntworten(a: Antworten, b: Antworten): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return (
    ka.length === kb.length &&
    ka.every((k, i) => k === kb[i] && a[k].a === b[k].a && a[k].tag === b[k].tag)
  );
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
): Promise<KategorieErgebnis> {
  const fehl = (grund: VerfuegbarkeitGrund): KategorieErgebnis => ({
    kategorie,
    ok: false,
    grund,
  });
  const leer = Object.keys(antworten).length === 0;
  const stand = p.jetzt();
  const text = JSON.stringify({
    art: ART,
    fassung: FASSUNG,
    person,
    antworten,
    stand,
  } satisfies Ablage);
  if (!leer && text.length > MAX_ZEICHEN) return fehl('zu-gross');

  // 1. Frisch lesen.
  let eigene: PersonenWert[];
  try {
    eigene = eigeneWerte(await werteLesen(p, modul, kategorie), person);
  } catch (e) {
    return fehl(grundAus(p, e));
  }

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
    : !!da && da.stand === stand && gleicheAntworten(da.antworten, antworten);
  if (angekommen) return { kategorie, ok: true };
  return fehl(abgebrochen ? 'voruebergehend' : 'nicht-angekommen');
}

/**
 * **Die eigenen Antworten speichern** – in jede übergebene Kategorie dasselbe, **nacheinander** (ChurchTools
 * drosselt). Einträge mit `tag < heute` fallen raus; bleibt nichts übrig, wird der eigene Wert gelöscht statt
 * ein leerer geschrieben. Je Kategorie ein Ergebnis; eine gescheiterte bricht die anderen nicht ab, und nichts
 * wird wiederholt.
 */
export async function eigeneAntwortenSchreiben(
  p: EntwurfPort,
  modul: number,
  kategorien: number[],
  person: number,
  antworten: Antworten,
  heute: string,
): Promise<KategorieErgebnis[]> {
  const bleibt: Antworten = {};
  for (const [termin, e] of Object.entries(antworten)) if (e.tag >= heute) bleibt[termin] = e;
  const ergebnisse: KategorieErgebnis[] = [];
  for (const kat of kategorien)
    ergebnisse.push(await eineKategorieSchreiben(p, modul, kat, person, bleibt));
  return ergebnisse;
}
