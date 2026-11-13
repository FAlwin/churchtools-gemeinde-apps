/**
 * **Die Einrichtung des Gruppenwechsels im Speicher der Erweiterung** (Bauplan O9-2, O9-F5 entschieden 12.11.2026): EIN
 * Wert in der Kategorie „Gruppenwechsel“ – welche Gruppen die Stufen sind, wessen Leitung die Übersicht sieht und welche
 * Wechsel-Gruppen „Einrichten“ (O9-5) angelegt hat. Die Wechseltage stehen NICHT hier: Sie kommen live aus dem
 * Ferienkalender (O9-F5).
 *
 * Lesen dürfen alle mit dem Reiter „Kinder & Jugend“, ändern nur Admins – das schützt ChurchTools über die Rechte der
 * Kategorie (setzt Alwin).
 */
import {
  einstellungFehler,
  uebergaenge,
  type GruppenwechselEinstellung,
  type Stufe,
} from './gruppenwechsel';

export const GW_ART = { art: 'organigramm-gruppenwechsel', fassung: 1 };

/** Die Wechsel-Gruppe eines Übergangs, z. B. „Fische → Jungschar“. */
export interface WechselGruppe {
  vonGruppeId: number;
  nachGruppeId: number;
  gruppeId: number;
}

export interface Einrichtung {
  einstellung: GruppenwechselEinstellung;
  /** Gruppe der Bereichsleitung (bei uns „Kinder & Jugend“): Ihre Leitung sieht die Übersicht über alle Stufen. */
  bereichGruppeId: number;
  /** Je Übergang höchstens eine. Fehlt eine, gibt es für diesen Übergang (noch) keine Ausnahmen und keine Ankündigung. */
  wechselGruppen: WechselGruppe[];
}

const id = (x: unknown): number | null =>
  Number.isInteger(x) && (x as number) > 0 ? (x as number) : null;
const text = (x: unknown): string | null => (typeof x === 'string' ? x : null);
const zahl = (x: unknown): number | null => (Number.isInteger(x) ? (x as number) : null);

function stufeAus(roh: unknown): Stufe | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  const gruppeId = id(r.gruppeId);
  const name = text(r.name);
  const abAlter = zahl(r.abAlter);
  return gruppeId !== null && name !== null && abAlter !== null
    ? { gruppeId, name, abAlter }
    : null;
}

function einstellungAus(roh: unknown): GruppenwechselEinstellung | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  if (!Array.isArray(r.stufen)) return null;
  const stufen = r.stufen.map(stufeAus);
  if (stufen.some((s) => s === null)) return null;
  const e = {
    stufen: stufen as Stufe[],
    stichtag: text(r.stichtag),
    ankuendigungTage: zahl(r.ankuendigungTage),
    aufnahmeTage: zahl(r.aufnahmeTage),
    aufraeumenTage: zahl(r.aufraeumenTage),
    ferienkalender: text(r.ferienkalender),
    ferienStichwort: text(r.ferienStichwort),
  };
  if (Object.values(e).some((v) => v === null)) return null;
  const fertig = e as GruppenwechselEinstellung;
  // Eine Einstellung, nach der die Regeln falsch wären, zeigt der Reiter nicht an – sie stammt dann nicht von „Einrichten“.
  return einstellungFehler(fertig).length === 0 ? fertig : null;
}

/**
 * Ein gespeicherter Wert – `null`, wenn er nicht dieses Format hat. Eine Wechsel-Gruppe muss zu einem Übergang der
 * Stufen passen (von einer Stufe zur nächsten) und darf je Übergang nur einmal vorkommen.
 */
export function einrichtungAus(roh: unknown): Einrichtung | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  const einstellung = einstellungAus(r.einstellung);
  const bereichGruppeId = id(r.bereichGruppeId);
  if (!einstellung || bereichGruppeId === null || !Array.isArray(r.wechselGruppen)) return null;
  const erlaubt = new Set(
    uebergaenge(einstellung).map((u) => `${u.von.gruppeId}>${u.nach.gruppeId}`),
  );
  const gesehen = new Set<string>();
  const wechselGruppen: WechselGruppe[] = [];
  for (const w of r.wechselGruppen as unknown[]) {
    if (!w || typeof w !== 'object') return null;
    const x = w as Record<string, unknown>;
    const vonGruppeId = id(x.vonGruppeId);
    const nachGruppeId = id(x.nachGruppeId);
    const gruppeId = id(x.gruppeId);
    if (vonGruppeId === null || nachGruppeId === null || gruppeId === null) return null;
    const schluessel = `${vonGruppeId}>${nachGruppeId}`;
    if (!erlaubt.has(schluessel) || gesehen.has(schluessel)) return null;
    gesehen.add(schluessel);
    wechselGruppen.push({ vonGruppeId, nachGruppeId, gruppeId });
  }
  return { einstellung, bereichGruppeId, wechselGruppen };
}

/** Die Wechsel-Gruppe, in die Kinder AUS dieser Stufe kommen – `null`, wenn sie fehlt (oder die Stufe die letzte ist). */
export const wechselGruppeAb = (e: Einrichtung, stufeId: number): WechselGruppe | null =>
  e.wechselGruppen.find((w) => w.vonGruppeId === stufeId) ?? null;

/** Die Wechsel-Gruppe, aus der Kinder IN diese Stufe kommen – `null`, wenn sie fehlt (oder die Stufe die erste ist). */
export const wechselGruppeNach = (e: Einrichtung, stufeId: number): WechselGruppe | null =>
  e.wechselGruppen.find((w) => w.nachGruppeId === stufeId) ?? null;
