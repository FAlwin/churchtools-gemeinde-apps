/**
 * **Die Personenliste einer Dienstgruppe** (Bauplan „Wunsch 19.11.2026: Ansicht Personen – Reihenfolge und Tags“, Scheibe
 * PL-1): die Reihenfolge der Personen, Tags (z. B. „Begleitung“, Kürzel „B“) je Person UND Dienst und die Pause je Person.
 * Nur Regeln, keine Netzwerk-Technik – **die eine Stelle** für Sortierung, Tags und Pause. „Personen“, „Wer kann?“ und das
 * PDF rufen sie auf; wer hier eine Regel ändert, ändert sie für alle.
 *
 * Gespeichert (Alwin, 20.11.2026): **ein Wert je Dienstgruppe in der Entwurfs-Schublade** (`schublade()` in `entwuerfe.ts`),
 * erkennbar an `art`. Die Leser der Entwürfe ignorieren ihn (`inhaltAus` prüft die `art`), und umgekehrt liest hier nur,
 * was `art: 'dienstplaner-personenliste'` trägt. Gemessen: ein Wert fasst höchstens 10.000 Zeichen (`MAX_ZEICHEN`), eine
 * Liste mit 40 Personen, 10 Tags und ~100 Zuordnungen braucht grob 3.000. PL-1 liest nur – geschrieben wird erst in PL-2.
 *
 * **Eine leere oder fehlende Liste ändert nichts:** Reihenfolge fehlt → alphabetisch wie bisher, keine Tags, keine Pause.
 */
import { inhaltAus, type Wert } from '../ct/modulDaten';

/** Die Art des Werts in der Schublade – daran erkennen die Leser, was von ihnen ist. */
export const PERSONENLISTE_ART = 'dienstplaner-personenliste';
export const PERSONENLISTE_FASSUNG = 1;

/** Ein Tag aus der festen Liste der Dienstgruppe: voller Name, Kürzel (1–2 Zeichen) am Personenbild. */
export interface PersonenTag {
  id: string;
  name: string;
  kuerzel: string;
}

/** Eine Pause: `bis` einschließlich (`YYYY-MM-DD`); ohne `bis` ohne Ende. */
export interface Pause {
  bis?: string;
}

export interface Personenliste {
  /** Zählt bei jedem Speichern hoch – wie bei den Entwürfen (PL-2 vergleicht damit). */
  version: number;
  /** ISO-Zeitpunkt des letzten Speicherns. */
  zeit: string;
  /** Die Reihenfolge: Personen-IDs, wer zuerst steht, steht ganz oben. */
  reihe: number[];
  tags: PersonenTag[];
  /** `"<dienstId>|<personId>"` → Tag-IDs. Ein Tag gilt je Person UND Dienst. */
  tagsVon: Record<string, string[]>;
  /** `"<personId>"` → Pause. */
  pause: Record<string, Pause>;
}

// ── Lesen ────────────────────────────────────────────────────────────────────

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const istText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const istObjekt = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** Der Schlüssel in `tagsVon`. Eine Stelle, damit Lesen und (später) Schreiben ihn gleich bauen. */
export const tagsSchluessel = (dienstId: number, personId: number): string =>
  `${dienstId}|${personId}`;

/**
 * Ein Wert → Personenliste, wenn er von uns ist und **vollständig und in sich stimmig**; sonst `null` (fremd, kaputt,
 * andere Fassung). Bewusst streng: Eine halb gelesene Liste (etwa eine Pause mit kaputtem Datum, die dann „ohne Ende“
 * hieße) wäre schlimmer als keine – dann gilt alles wie vor der Liste.
 */
export function personenlisteAus(wert: Wert): Personenliste | null {
  const a = inhaltAus<Record<string, unknown>>(wert, PERSONENLISTE_ART, PERSONENLISTE_FASSUNG);
  if (!a) return null;
  if (!istZahl(a.version) || !istText(a.zeit)) return null;
  if (!Array.isArray(a.reihe) || !a.reihe.every(istZahl)) return null;
  if (!Array.isArray(a.tags)) return null;
  const tags: PersonenTag[] = [];
  for (const t of a.tags as unknown[]) {
    if (!istObjekt(t) || !istText(t.id) || !istText(t.name) || !istText(t.kuerzel)) return null;
    tags.push({ id: t.id, name: t.name.trim(), kuerzel: t.kuerzel.trim() });
  }
  if (!istObjekt(a.tagsVon) || !istObjekt(a.pause)) return null;
  const tagsVon: Record<string, string[]> = {};
  for (const [k, ids] of Object.entries(a.tagsVon)) {
    if (!Array.isArray(ids)) return null;
    const idListe: string[] = [];
    for (const i of ids as unknown[]) {
      if (typeof i !== 'string') return null;
      idListe.push(i);
    }
    tagsVon[k] = idListe;
  }
  const pause: Record<string, Pause> = {};
  for (const [k, p] of Object.entries(a.pause)) {
    if (!istObjekt(p)) return null;
    if (p.bis === undefined) pause[k] = {};
    else if (typeof p.bis === 'string' && TAG.test(p.bis)) pause[k] = { bis: p.bis };
    else return null;
  }
  return { version: a.version, zeit: a.zeit, reihe: a.reihe, tags, tagsVon, pause };
}

// ── Reihenfolge ──────────────────────────────────────────────────────────────

/** Hat die Dienstgruppe eine gespeicherte Reihenfolge? Erst dann ändern sich „Personen“, „Wer kann?“ und das PDF. */
export const hatReihenfolge = (liste: Personenliste | null | undefined): boolean =>
  !!liste && liste.reihe.length > 0;

/** Die Stelle einer Person in der Reihenfolge (0 = ganz oben); `null`, wenn sie dort nicht steht. */
export function rangVon(liste: Personenliste | null | undefined, personId: number): number | null {
  const i = liste ? liste.reihe.indexOf(personId) : -1;
  return i < 0 ? null : i;
}

/**
 * **Nach der Liste sortieren:** wer in der gespeicherten Reihenfolge steht, zuerst – in dieser Reihenfolge; wer fehlt
 * (neue Mitglieder, Gäste), danach alphabetisch („deutsch“ sortiert), dann nach ID. Ohne Reihenfolge: genau so
 * alphabetisch, wie bisher. Gibt eine neue Liste zurück.
 */
export function sortiereNachListe<T extends { personId: number | null; name: string }>(
  liste: Personenliste | null | undefined,
  items: readonly T[],
): T[] {
  const raenge = new Map<number, number>();
  if (liste) liste.reihe.forEach((id, i) => raenge.has(id) || raenge.set(id, i));
  const rang = (x: T): number | null =>
    x.personId === null ? null : (raenge.get(x.personId) ?? null);
  return [...items].sort((a, b) => {
    const ra = rang(a);
    const rb = rang(b);
    if (ra !== null && rb !== null) return ra - rb;
    if (ra !== null) return -1;
    if (rb !== null) return 1;
    return (
      a.name.localeCompare(b.name, 'de') ||
      (a.personId ?? Number.MAX_SAFE_INTEGER) - (b.personId ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

// ── Tags ─────────────────────────────────────────────────────────────────────

/** Die Tags dieser Person in diesem Dienst, in der Reihenfolge der Tag-Liste; unbekannte Tag-IDs fallen weg. */
export function tagsFuer(
  liste: Personenliste | null | undefined,
  dienstId: number,
  personId: number,
): PersonenTag[] {
  const ids = liste?.tagsVon[tagsSchluessel(dienstId, personId)];
  if (!liste || !ids || ids.length === 0) return [];
  return liste.tags.filter((t) => ids.includes(t.id));
}

// ── Pause ────────────────────────────────────────────────────────────────────

/**
 * Die Pause der Person **an diesem Tag** (`YYYY-MM-DD`) – `null`, wenn sie nicht pausiert. „Bis“ gilt einschließlich;
 * ohne `bis` ist die Pause unbefristet. Ohne Tag (alte Aufrufe) zählt nur die unbefristete.
 */
export function pauseAm(
  liste: Personenliste | null | undefined,
  personId: number,
  tag: string | undefined,
): Pause | null {
  const p = liste?.pause[String(personId)];
  if (!p) return null;
  if (p.bis === undefined) return p;
  return tag !== undefined && tag <= p.bis ? p : null;
}

export const istPausiert = (
  liste: Personenliste | null | undefined,
  personId: number,
  tag: string | undefined,
): boolean => pauseAm(liste, personId, tag) !== null;

/** Gilt die Pause an **allen** diesen Tagen? Ohne Tage: nein. Dieselbe Frage wie „ganz abwesend“ in „Personen“. */
export const pausiertAnAllen = (
  liste: Personenliste | null | undefined,
  personId: number,
  tage: readonly string[],
): boolean => tage.length > 0 && tage.every((t) => istPausiert(liste, personId, t));

/** „Pause bis 31.01.27“ – ohne Ende nur „Pause“. */
export function pauseText(p: Pause): string {
  if (!p.bis) return 'Pause';
  return `Pause bis ${p.bis.slice(8, 10)}.${p.bis.slice(5, 7)}.${p.bis.slice(2, 4)}`;
}
