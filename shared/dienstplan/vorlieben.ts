/**
 * **Vorlieben einer Person je Dienstgruppe – der Stift** (Bauplan E5-3, Entwurf `e5-entwurf.html`). Genau die drei
 * Einstellungen, die ChurchTools beim Zauberstab nutzt (Alwin, 16.10.2026: keine eigenen Vorlieben). Nur über die
 * **alte** Schnittstelle (`getServiceGroupPersonWeight` / `editServiceGroupPersonWeight`, gemessen E0 und E5-3-0) –
 * deshalb steht das Lesen und Schreiben **nur hier**; geholt wird über einen Anschluss (Browser: `ctAltAnfrage`).
 *
 * **Gemessen 16.10.2026 (E5-3-0):** Ohne Recht auf die Gruppe meldet das Schreiben trotzdem `success` und schreibt
 * **nichts**; das Lesen liefert dann `null` (lesbar ohne Zeilen: `[]`). Ein Erfolg zählt deshalb erst, wenn das
 * Nachlesen genau die neuen Werte zeigt. Werte kommen als Zeichenketten.
 */

/** `max_per_month`: 0 = nie … 4 = viermal (Vorgabe). */
export type Hoechstens = 0 | 1 | 2 | 3 | 4;
/** `relation_weight`: 0 egal, 1 bevorzugt zusammen, 2 immer getrennt (wirkt nur bei Ehepaar, E0 §4). */
export type Beziehung = 0 | 1 | 2;
/** `morning_weight`: 0 egal, 1 eher morgens, 2 nur morgens, 3 eher abends, 4 nur abends. */
export type Tageszeit = 0 | 1 | 2 | 3 | 4;

export interface Vorliebe {
  hoechstens: Hoechstens;
  beziehung: Beziehung;
  tageszeit: Tageszeit;
}

/** Ohne gespeicherte Zeile zeigt ChurchTools diese Werte (und rechnet nichts ab, E0). */
export const STANDARD: Vorliebe = { hoechstens: 4, beziehung: 0, tageszeit: 0 };

export const HOECHSTENS_TEXTE = [
  'nie',
  '1× pro Monat',
  '2× pro Monat',
  '3× pro Monat',
  '4× pro Monat (Vorgabe)',
] as const;
export const BEZIEHUNG_TEXTE = ['egal', 'bevorzugt zusammen', 'immer getrennt'] as const;
export const TAGESZEIT_TEXTE = [
  'egal',
  'eher morgens',
  'nur morgens',
  'eher abends',
  'nur abends',
] as const;

/** Der Anschluss an die alte Schnittstelle: ein Aufruf und der HTTP-Status eines Fehlers (`null` = Netz). */
export interface VorliebenPort {
  anfrage(func: string, felder: Record<string, string>): Promise<unknown>;
  status(e: unknown): number | null;
}

export type VorliebenGrund =
  /** Niemand mehr angemeldet (401 – fehlendes Recht kommt im Browser als 403, `fehlerAus`). Nichts ist passiert. */
  | 'abgemeldet'
  /** ChurchTools verweigert (403) – oder hat stumm nichts übernommen und lässt die Gruppe nicht lesen. */
  | 'kein-recht'
  /** Gespeichert gemeldet, nachgelesen steht aber etwas anderes da. */
  | 'nicht-angekommen'
  /** Netz, Zeitüberschreitung, 5xx, unlesbare Antwort – nichts ist verloren, die Eingabe bleibt. */
  | 'voruebergehend';

const zahl = (x: unknown, max: number): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

/**
 * Die Antwort von `getServiceGroupPersonWeight` lesen: `null` → nicht lesbar (kein Recht, gemessen); sonst je Person
 * ihre Vorliebe in dieser Gruppe. Unbrauchbare Zeilen fallen weg (dann gilt dort der Standard).
 */
export function vorliebenAus(
  roh: unknown,
  gruppeId: number,
): { lesbar: false } | { lesbar: true; je: Map<number, Vorliebe> } {
  if (roh === null || roh === undefined) return { lesbar: false };
  const je = new Map<number, Vorliebe>();
  if (typeof roh !== 'object' || Array.isArray(roh)) return { lesbar: true, je };
  for (const [pid, gruppen] of Object.entries(roh as Record<string, unknown>)) {
    const z = (gruppen as Record<string, Record<string, unknown> | undefined> | null)?.[
      String(gruppeId)
    ];
    const personId = Number(pid);
    if (!z || !Number.isInteger(personId)) continue;
    const hoechstens = zahl(z.max_per_month, 4);
    const beziehung = zahl(z.relation_weight, 2);
    const tageszeit = zahl(z.morning_weight, 4);
    if (hoechstens === null || beziehung === null || tageszeit === null) continue;
    je.set(personId, {
      hoechstens: hoechstens as Hoechstens,
      beziehung: beziehung as Beziehung,
      tageszeit: tageszeit as Tageszeit,
    });
  }
  return { lesbar: true, je };
}

const gleich = (a: Vorliebe, b: Vorliebe) =>
  a.hoechstens === b.hoechstens && a.beziehung === b.beziehung && a.tageszeit === b.tageszeit;

function grundAus(p: VorliebenPort, e: unknown): VorliebenGrund {
  const s = p.status(e);
  if (s === 401) return 'abgemeldet';
  return s === 403 ? 'kein-recht' : 'voruebergehend';
}

/** Die Vorliebe einer Person lesen – ohne Zeile der Standard. */
export async function vorliebeLesen(
  p: VorliebenPort,
  gruppeId: number,
  personId: number,
): Promise<{ ok: true; vorliebe: Vorliebe } | { ok: false; grund: VorliebenGrund }> {
  let roh: unknown;
  try {
    roh = await p.anfrage('getServiceGroupPersonWeight', { servicegroup_id: String(gruppeId) });
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  const l = vorliebenAus(roh, gruppeId);
  if (!l.lesbar) return { ok: false, grund: 'kein-recht' };
  return { ok: true, vorliebe: l.je.get(personId) ?? STANDARD };
}

/**
 * **Speichern – sofort in ChurchTools** (wie die Plätze, kein Entwurf). Schreiben, dann **nachlesen**: Erst wenn dort
 * genau die neuen Werte stehen, ist es ein Erfolg (stille Ablehnung ohne Recht, gemessen E5-3-0). Geschrieben wird
 * nie zweimal; ein Fehler beim Nachlesen ist „vorübergehend“ (ob es ankam, weiß dann niemand – die Eingabe bleibt).
 */
export async function vorliebeSpeichern(
  p: VorliebenPort,
  gruppeId: number,
  personId: number,
  v: Vorliebe,
): Promise<{ ok: true } | { ok: false; grund: VorliebenGrund }> {
  try {
    await p.anfrage('editServiceGroupPersonWeight', {
      servicegroup_id: String(gruppeId),
      person_id: String(personId),
      max_per_month: String(v.hoechstens),
      relation_weight: String(v.beziehung),
      morning_weight: String(v.tageszeit),
    });
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  const l = await vorliebeLesen(p, gruppeId, personId);
  if (!l.ok) return l;
  return gleich(l.vorliebe, v) ? { ok: true } : { ok: false, grund: 'nicht-angekommen' };
}
