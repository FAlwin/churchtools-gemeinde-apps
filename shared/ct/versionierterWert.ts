/**
 * **Ein Dokument im Speicher der Erweiterung – mit Versionsnummer** (Organigramm O7, 24.10.2026). Für alles, was als
 * EIN Wert in einer Kategorie liegt und von mehreren Leuten geändert wird (der Plan „neue Gliederung“).
 *
 * ChurchTools prüft beim Schreiben keine Version (gemessen Dienstplaner E0 §6, Organigramm O0 §6): Zwei gleichzeitige
 * Schreiber → einer geht still verloren. Deshalb dieselbe Regel wie bei den Dienstplaner-Entwürfen
 * (`shared/dienstplan/entwuerfe.ts`, dort viele Werte je Platz – das Vorbild für diesen Baustein):
 * 1. frisch lesen; steht eine andere Version da als die gesehene → **Konflikt**, nichts überschrieben;
 * 2. schreiben – nie automatisch wiederholt;
 * 3. **nachlesen** – erst was dasteht, ist der Erfolg (Lehre vom 11.08.2026).
 *
 * Doppelte Werte (zwei gleichzeitige Erst-Anleger) werden beim Lesen erkannt: Es gilt die höchste Version; beim
 * Entfernen gehen alle.
 */
import {
  inhaltAus,
  MAX_ZEICHEN,
  werteLesen,
  wertAendern,
  wertAnlegen,
  wertLoeschen,
} from './modulDaten';
import type { ModulPort, Wert } from './modulDaten';

export interface VersionPort extends ModulPort {
  /** Ist niemand mehr angemeldet? (Ein 401 allein heißt das nicht – ChurchTools sagt es auch bei fehlendem Recht.) */
  istAbgemeldet(e: unknown): boolean;
  /** Jetzt, als ISO-Zeitpunkt (für Tests austauschbar). */
  jetzt(): string;
}

export interface Versioniert<T> {
  version: number;
  zeit: string;
  von: { personId: number; name: string };
  inhalt: T;
}

export type SpeicherGrund =
  /** Niemand mehr angemeldet. Nichts ist passiert. */
  | 'abgemeldet'
  /** ChurchTools verweigert den Speicher. */
  | 'kein-recht'
  /** Ein anderer hat inzwischen gespeichert – nichts überschrieben, `jetzt` sagt, was dasteht. */
  | 'konflikt'
  /** Netz, Zeitüberschreitung, Drosselung, 5xx – nicht bestätigt; die Eingabe bleibt beim Aufrufer. */
  | 'voruebergehend'
  /** ChurchTools hat das Schreiben angenommen, nachgelesen steht es aber nicht da. */
  | 'nicht-angekommen'
  /** Größer als ChurchTools in einem Wert annimmt (`MAX_ZEICHEN`). */
  | 'zu-gross';

export type LeseErgebnis<T> =
  | { ok: true; daten: Versioniert<T> | null }
  | { ok: false; grund: SpeicherGrund };

export type SpeicherErgebnis<T> =
  | { ok: true; daten: Versioniert<T> | null }
  | { ok: false; grund: SpeicherGrund; jetzt?: Versioniert<T> | null };

/** Woran ein Wert als „unser“ Dokument erkannt wird (wie `inhaltAus`). */
export interface Dokumentart {
  art: string;
  fassung: number;
}

type Ablage<T> = Dokumentart & Versioniert<T>;

function grundAus(p: VersionPort, e: unknown): SpeicherGrund {
  if (p.istAbgemeldet(e)) return 'abgemeldet';
  if (p.istKeinRecht(e)) return 'kein-recht';
  return 'voruebergehend';
}

/** Alle Werte dieser Art, der gültige (höchste Version) zuerst. */
async function alle<T>(
  p: VersionPort,
  modul: number,
  kategorie: number,
  d: Dokumentart,
): Promise<{ wert: Wert; daten: Versioniert<T> }[]> {
  const werte = await werteLesen(p, modul, kategorie);
  return werte
    .flatMap((wert) => {
      const a = inhaltAus<Ablage<T>>(wert, d.art, d.fassung);
      return a && typeof a.version === 'number'
        ? [{ wert, daten: { version: a.version, zeit: a.zeit, von: a.von, inhalt: a.inhalt } }]
        : [];
    })
    .sort((x, y) => y.daten.version - x.daten.version || y.wert.id - x.wert.id);
}

/** Das Dokument – **frisch**, nie aus einem Cache. `null` = es gibt keins. */
export async function dokumentLesen<T>(
  p: VersionPort,
  modul: number,
  kategorie: number,
  d: Dokumentart,
): Promise<LeseErgebnis<T>> {
  try {
    return { ok: true, daten: (await alle<T>(p, modul, kategorie, d))[0]?.daten ?? null };
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
}

const gleich = <T>(a: Versioniert<T>, b: Versioniert<T>) =>
  a.version === b.version && a.zeit === b.zeit && a.von.personId === b.von.personId;

/**
 * **Speichern.** `erwartet` ist die Version, die man gesehen hat (`null` = es gab keins). Steht inzwischen eine andere
 * da, wird **nicht** überschrieben (`konflikt`, mit `jetzt`).
 */
export async function dokumentSpeichern<T>(
  p: VersionPort,
  modul: number,
  kategorie: number,
  d: Dokumentart,
  inhalt: T,
  von: { personId: number; name: string },
  erwartet: number | null,
  verweigert: string,
): Promise<SpeicherErgebnis<T>> {
  let da: { wert: Wert; daten: Versioniert<T> } | undefined;
  try {
    da = (await alle<T>(p, modul, kategorie, d))[0];
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  if ((da?.daten.version ?? null) !== erwartet) {
    return { ok: false, grund: 'konflikt', jetzt: da?.daten ?? null };
  }
  const neu: Versioniert<T> = {
    version: (da?.daten.version ?? 0) + 1,
    zeit: p.jetzt(),
    von,
    inhalt,
  };
  const text = JSON.stringify({ ...d, ...neu } satisfies Ablage<T>);
  if (text.length > MAX_ZEICHEN) return { ok: false, grund: 'zu-gross' };
  try {
    if (da) await wertAendern(p, modul, kategorie, da.wert.id, text, verweigert);
    else await wertAnlegen(p, modul, kategorie, text, verweigert);
  } catch (e) {
    const g = grundAus(p, e);
    if (g !== 'voruebergehend') return { ok: false, grund: g };
    // Gelöscht, während wir ändern wollten (404) – ein anderer war schneller.
    return nachlesen(p, modul, kategorie, d, neu, p.istNichtGefunden(e) ? 'konflikt' : g);
  }
  return nachlesen(p, modul, kategorie, d, neu, 'nicht-angekommen');
}

async function nachlesen<T>(
  p: VersionPort,
  modul: number,
  kategorie: number,
  d: Dokumentart,
  neu: Versioniert<T>,
  sonst: SpeicherGrund,
): Promise<SpeicherErgebnis<T>> {
  const l = await dokumentLesen<T>(p, modul, kategorie, d);
  if (!l.ok) return { ok: false, grund: l.grund };
  const jetzt = l.daten;
  if (jetzt && gleich(jetzt, neu)) return { ok: true, daten: jetzt };
  // Steht ein anderes Dokument auf mindestens unserem Stand, war ein anderer gleichzeitig dran.
  if (jetzt && jetzt.version >= neu.version) return { ok: false, grund: 'konflikt', jetzt };
  return { ok: false, grund: sonst, jetzt };
}

/** **Entfernen** – nur, wenn noch die gesehene Version dasteht; auch Doppelte gehen. „Schon weg“ ist ein Erfolg. */
export async function dokumentEntfernen<T>(
  p: VersionPort,
  modul: number,
  kategorie: number,
  d: Dokumentart,
  erwartet: number,
  verweigert: string,
): Promise<SpeicherErgebnis<T>> {
  let liste: { wert: Wert; daten: Versioniert<T> }[];
  try {
    liste = await alle<T>(p, modul, kategorie, d);
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  if (liste.length === 0) return { ok: true, daten: null };
  if (liste[0].daten.version !== erwartet) {
    return { ok: false, grund: 'konflikt', jetzt: liste[0].daten };
  }
  try {
    for (const x of liste) await wertLoeschen(p, modul, kategorie, x.wert.id, verweigert);
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  const l = await dokumentLesen<T>(p, modul, kategorie, d);
  if (!l.ok) return { ok: false, grund: l.grund };
  return l.daten === null
    ? { ok: true, daten: null }
    : { ok: false, grund: 'nicht-angekommen', jetzt: l.daten };
}
