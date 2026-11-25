/**
 * **Der Live-Verlauf im Speicher der Erweiterung** (Live-Ansicht 2, L4-3, Alwin 23.11.2026, T4): ein Wert je Termin in der
 * Kategorie `dienstplaner-live-verlauf` („Live-Verlauf“) des Dienstplaner-Moduls, darin die Wechsel (`Wechsel` in
 * `shared/ct/liveVerlauf.ts` – dort steht auch, was daraus gerechnet wird). Die Kategorie wird **über ihr Kürzel** gefunden,
 * nie über eine feste ID. Die Rechte setzt Alwin an der Kategorie in ChurchTools: sehen = alle, die den Ablauf sehen,
 * ändern = wer die Live-Agenda steuern darf (Empfehlung `messung-live-2.md`).
 *
 * Hausregeln:
 *  - **Zusammenführen, nie ersetzen:** Vor jedem Schreiben wird frisch gelesen und der neue Wechsel mit dem Gelesenen
 *    zusammengeführt (`zusammenfuehren`: gleicher `switchdate` + Stelle = kein Doppel). Zwei Geräte, die gleichzeitig
 *    schreiben, schreiben sich so keinen Wechsel weg; danach wird **nachgelesen** – fehlt etwas (ein anderer war
 *    zwischen Lesen und Schreiben dran), wird mit dem frisch Gelesenen noch einmal zusammengeführt (höchstens dreimal).
 *  - **Ein Fehler zerstört nichts:** Netz, Zeitüberschreitung, 5xx → `voruebergehend`, nichts ist verloren (das Schreiben
 *    ist wiederholbar, weil Zusammenführen dasselbe Ergebnis liefert). Nur ein Fehler beim LESEN ist nie „leer“.
 *  - **Ohne Kategorie oder ohne Leserecht** liefert ChurchTools eine leere Liste – dann gibt es schlicht keinen Verlauf
 *    (`vorhanden: false`), die Anzeige lässt ± und „Warum“ leise weg.
 *  - Ein Wert fasst höchstens 10.000 Zeichen (`MAX_ZEICHEN`): Wird es knapp, entfallen die Titel (die Punkt-ID reicht).
 *  - **Aus dem Schnitt nehmen** (L4-4, A9): Die Markierungen (`Ausnahme`) stehen im selben Wert (`x`) und werden genauso
 *    zusammengeführt, nie ersetzt – je Punkt gilt die neuere Markierung, die Rücknahme ist eine Markierung mit `aus: false`.
 *  - **Alle Verläufe auf einmal** (`verlaufAlleLesen`) liest der Schnitt „Ø bisher“ (T5): ein Lesen der Kategorie, danach
 *    wird gerechnet.
 */
import { z } from 'zod';
import {
  ausnahmenEnthalten,
  ausnahmenZusammenfuehren,
  enthaelt,
  zusammenfuehren,
  type Ausnahme,
  type Wechsel,
} from '../ct/liveVerlauf';
import type { VerlaufTermin } from '../ct/liveRueckblick';
import {
  inhaltAus,
  kategorieSicherstellen,
  kategorieSuchen,
  MAX_ZEICHEN,
  wertAendern,
  wertAnlegen,
  werteLesen,
  type KategorieAngabe,
  type Wert,
} from '../ct/modulDaten';
import type { VersionPort } from '../ct/versionierterWert';

export const VERLAUF_ART = { art: 'dienstplaner-live-verlauf', fassung: 1 } as const;

export const VERLAUF_KATEGORIE: KategorieAngabe = {
  kuerzel: 'dienstplaner-live-verlauf',
  name: 'Live-Verlauf',
  beschreibung:
    'Angelegt vom Dienstplaner – lesen: alle, die den Ablauf sehen; ändern: wer die Live-Agenda steuert, und die Planer. Ein Wert je Termin mit den Wechseln der Live-Ansicht (für Plus/Minus, Prognose und Rückblick).',
};

export const VERLAUF_VERWEIGERT =
  'Den Live-Verlauf dürfen nur Personen ändern, die in ChurchTools die Ablage „Live-Verlauf“ des Dienstplaners bearbeiten dürfen.';

/** Wie oft nach dem Nachlesen noch einmal zusammengeführt wird, wenn jemand dazwischen geschrieben hat. */
export const VERLAUF_VERSUCHE = 3;

export type VerlaufGrund =
  | 'abgemeldet'
  | 'kein-recht'
  | 'voruebergehend'
  /** ChurchTools hat das Schreiben angenommen, nachgelesen fehlt aber, was geschrieben wurde. */
  | 'nicht-angekommen'
  /** Auch ohne Titel größer als ChurchTools in einem Wert annimmt. */
  | 'zu-gross';

export type VerlaufLesen =
  | {
      ok: true;
      wechsel: Wechsel[];
      /** Die Markierungen „nicht im Schnitt“ dieses Termins (L4-4). */
      ausnahmen: Ausnahme[];
      /** Es gibt zu diesem Termin einen Wert (sonst: kein Verlauf, keine Kategorie oder kein Recht, ihn zu sehen). */
      vorhanden: boolean;
    }
  | { ok: false; grund: VerlaufGrund };

export type VerlaufSchreiben =
  | { ok: true; wechsel: Wechsel[]; ausnahmen: Ausnahme[] }
  | { ok: false; grund: VerlaufGrund };

/** Alle Verläufe der Kategorie, je Termin – für den Schnitt „Ø bisher“. */
export type VerlaufAlle =
  | { ok: true; termine: Map<number, VerlaufTermin> }
  | { ok: false; grund: VerlaufGrund };

/**
 * Ein Wechsel, wie er im Wert steht – mit kurzen Schlüsseln, damit viele Wechsel in die 10.000 Zeichen eines Werts passen:
 * `s` Stelle, `p` Punkt-ID, `t` Titel, `z` Zeit, `d` Zusatzzeit davor, `a` Ausgleich, `n` neu gestartet, `l` Lied.
 */
const ablageSchema = z.object({
  s: z.number().int().min(0),
  p: z.number().int().nullable(),
  t: z.string(),
  z: z.number().int(),
  d: z.number().int().optional(),
  a: z.number().int().optional(),
  n: z.literal(true).optional(),
  l: z.literal(true).optional(),
});

/** Eine Markierung „nicht im Schnitt“, wie sie im Wert steht: `p` Punkt-ID (`null` = ganzer Termin), `z` Zeit, `a` heraus. */
const ausnahmeSchema = z.object({
  p: z.number().int().nullable(),
  z: z.number().int(),
  a: z.boolean(),
});

const schema = z.object({
  art: z.literal(VERLAUF_ART.art),
  fassung: z.literal(VERLAUF_ART.fassung),
  terminId: z.number().int(),
  wechsel: z.array(z.unknown()),
  x: z.array(z.unknown()).optional(),
});

/** Ein Wechsel für die Ablage. */
const zuAblage = (w: Wechsel): z.infer<typeof ablageSchema> => ({
  s: w.stelle,
  p: w.punktId,
  t: w.titel,
  z: w.zeit,
  ...(w.zusatzDavor === undefined ? {} : { d: w.zusatzDavor }),
  ...(w.ausgleich === undefined ? {} : { a: w.ausgleich }),
  ...(w.neu === true ? { n: true as const } : {}),
  ...(w.lied === true ? { l: true as const } : {}),
});

/**
 * Der Inhalt eines gespeicherten Werts – `null`, wenn er nicht von uns ist. Einzelne unlesbare Wechsel oder Markierungen
 * werden übersprungen (von Hand geändert, beschädigt), die anderen bleiben.
 */
function inhaltVon(
  wert: Wert,
): { terminId: number; wechsel: Wechsel[]; ausnahmen: Ausnahme[] } | null {
  const roh = inhaltAus<unknown>(wert, VERLAUF_ART.art, VERLAUF_ART.fassung);
  const s = schema.safeParse(roh);
  if (!s.success) return null;
  const wechsel = s.data.wechsel.flatMap((x): Wechsel[] => {
    const r = ablageSchema.safeParse(x);
    if (!r.success) return [];
    const a = r.data;
    return [
      {
        stelle: a.s,
        punktId: a.p,
        titel: a.t,
        zeit: a.z,
        ...(a.d === undefined ? {} : { zusatzDavor: a.d }),
        ...(a.a === undefined ? {} : { ausgleich: a.a }),
        ...(a.n === true ? { neu: true as const } : {}),
        ...(a.l === true ? { lied: true as const } : {}),
      },
    ];
  });
  const ausnahmen = (s.data.x ?? []).flatMap((x): Ausnahme[] => {
    const r = ausnahmeSchema.safeParse(x);
    return r.success ? [{ punkt: r.data.p, zeit: r.data.z, aus: r.data.a }] : [];
  });
  return { terminId: s.data.terminId, wechsel, ausnahmen };
}

/**
 * Die Wechsel eines gespeicherten Werts für diesen Termin – `null`, wenn er nicht von uns ist oder zu einem anderen Termin
 * gehört.
 */
export function wechselAusWert(wert: Wert, terminId: number): Wechsel[] | null {
  const inhalt = inhaltVon(wert);
  return inhalt && inhalt.terminId === terminId ? inhalt.wechsel : null;
}

/** Der Text des Werts: mit Titeln, und wenn er so zu lang wird, ohne. `null`, wenn auch das nicht passt. */
export function verlaufText(
  terminId: number,
  wechsel: readonly Wechsel[],
  ausnahmen: readonly Ausnahme[] = [],
): string | null {
  const x = ausnahmen.map((a) => ({ p: a.punkt, z: a.zeit, a: a.aus }));
  const text = (w: readonly Wechsel[]) =>
    JSON.stringify({
      ...VERLAUF_ART,
      terminId,
      wechsel: w.map(zuAblage),
      ...(x.length > 0 ? { x } : {}),
    });
  const voll = text(wechsel);
  if (voll.length <= MAX_ZEICHEN) return voll;
  const kurz = text(wechsel.map((w) => ({ ...w, titel: '' })));
  return kurz.length <= MAX_ZEICHEN ? kurz : null;
}

function grundAus(p: VersionPort, e: unknown): VerlaufGrund {
  if (p.istAbgemeldet(e)) return 'abgemeldet';
  if (p.istKeinRecht(e)) return 'kein-recht';
  return 'voruebergehend';
}

/** Alle Werte dieses Termins (ein Wert je Termin – zwei, wenn zwei Geräte gleichzeitig den ersten angelegt haben), kleinste ID zuerst. */
function werteVon(
  werte: readonly Wert[],
  terminId: number,
): { wert: Wert; wechsel: Wechsel[]; ausnahmen: Ausnahme[] }[] {
  return werte
    .flatMap((wert) => {
      const inhalt = inhaltVon(wert);
      return inhalt && inhalt.terminId === terminId
        ? [{ wert, wechsel: inhalt.wechsel, ausnahmen: inhalt.ausnahmen }]
        : [];
    })
    .sort((a, b) => a.wert.id - b.wert.id);
}

const vereint = (liste: readonly { wechsel: Wechsel[] }[]): Wechsel[] =>
  liste.reduce<Wechsel[]>((acc, x) => zusammenfuehren(acc, x.wechsel), []);
const vereinteAusnahmen = (liste: readonly { ausnahmen: Ausnahme[] }[]): Ausnahme[] =>
  liste.reduce<Ausnahme[]>((acc, x) => ausnahmenZusammenfuehren(acc, x.ausnahmen), []);

/**
 * **Lesen** – frisch, nie aus einem Zwischenspeicher. Keine Kategorie (noch nie ein Live-Termin – oder ChurchTools zeigt sie
 * einem nicht) heißt: kein Verlauf. Ein Fehler ist ein eigenes Ergebnis, kein „leer“.
 */
export async function verlaufLesen(
  p: VersionPort,
  modul: () => Promise<number>,
  terminId: number,
): Promise<VerlaufLesen> {
  try {
    const modulId = await modul();
    const kategorie = await kategorieSuchen(p, modulId, VERLAUF_KATEGORIE.kuerzel);
    if (kategorie === null) return { ok: true, wechsel: [], ausnahmen: [], vorhanden: false };
    const da = werteVon(await werteLesen(p, modulId, kategorie), terminId);
    return {
      ok: true,
      wechsel: vereint(da),
      ausnahmen: vereinteAusnahmen(da),
      vorhanden: da.length > 0,
    };
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
}

/**
 * **Alle Verläufe auf einmal lesen** – für den Schnitt „Ø bisher“ (T5): ein Lesen der Kategorie (alle Werte), je Termin
 * zusammengeführt. Auch der Verlauf des gerade offenen Termins steckt darin, der Rückblick braucht kein zweites Lesen. Ohne
 * Kategorie oder ohne Leserecht: leer. Ein Fehler ist ein eigenes Ergebnis, nie „leer“.
 */
export async function verlaufAlleLesen(
  p: VersionPort,
  modul: () => Promise<number>,
): Promise<VerlaufAlle> {
  try {
    const modulId = await modul();
    const kategorie = await kategorieSuchen(p, modulId, VERLAUF_KATEGORIE.kuerzel);
    const termine = new Map<number, VerlaufTermin>();
    if (kategorie === null) return { ok: true, termine };
    for (const wert of await werteLesen(p, modulId, kategorie)) {
      const inhalt = inhaltVon(wert);
      if (!inhalt) continue;
      const da = termine.get(inhalt.terminId);
      termine.set(inhalt.terminId, {
        wechsel: zusammenfuehren(da?.wechsel ?? [], inhalt.wechsel),
        ausnahmen: ausnahmenZusammenfuehren(da?.ausnahmen ?? [], inhalt.ausnahmen),
      });
    }
    return { ok: true, termine };
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
}

/**
 * **Wechsel festhalten** (`neue`): frisch lesen, mit dem Gelesenen zusammenführen, schreiben, **nachlesen** – erst was danach
 * dasteht, ist der Erfolg. Steht schon alles da, wird nichts geschrieben. Die Kategorie wird bei Bedarf angelegt (nur wer
 * Kategorien anlegen darf) und danach nachgesehen. Gibt es zum Termin zwei Werte, wird in den mit der kleinsten ID
 * geschrieben und der Rest nur gelesen – gelöscht wird nie etwas.
 */
export async function verlaufSchreiben(
  p: VersionPort,
  modul: () => Promise<number>,
  terminId: number,
  neue: readonly Wechsel[],
  neueAusnahmen: readonly Ausnahme[] = [],
): Promise<VerlaufSchreiben> {
  let letzterGrund: VerlaufGrund = 'nicht-angekommen';
  for (let versuch = 0; versuch < VERLAUF_VERSUCHE; versuch++) {
    let da: { wert: Wert; wechsel: Wechsel[]; ausnahmen: Ausnahme[] }[];
    let modulId: number;
    let kategorie: number;
    try {
      modulId = await modul();
      kategorie = await kategorieSicherstellen(p, modulId, VERLAUF_KATEGORIE, VERLAUF_VERWEIGERT);
      da = werteVon(await werteLesen(p, modulId, kategorie), terminId);
    } catch (e) {
      return { ok: false, grund: grundAus(p, e) };
    }
    const gelesen = vereint(da);
    const gelesenAusnahmen = vereinteAusnahmen(da);
    if (enthaelt(gelesen, neue) && ausnahmenEnthalten(gelesenAusnahmen, neueAusnahmen)) {
      return { ok: true, wechsel: gelesen, ausnahmen: gelesenAusnahmen };
    }
    const text = verlaufText(
      terminId,
      zusammenfuehren(gelesen, neue),
      ausnahmenZusammenfuehren(gelesenAusnahmen, neueAusnahmen),
    );
    if (text === null) return { ok: false, grund: 'zu-gross' };
    try {
      if (da[0]) await wertAendern(p, modulId, kategorie, da[0].wert.id, text, VERLAUF_VERWEIGERT);
      else await wertAnlegen(p, modulId, kategorie, text, VERLAUF_VERWEIGERT);
    } catch (e) {
      const g = grundAus(p, e);
      // Gelöscht, während wir ändern wollten (404): ein anderer war dran – neu lesen und zusammenführen.
      if (g === 'voruebergehend' && p.istNichtGefunden(e)) {
        letzterGrund = 'nicht-angekommen';
        continue;
      }
      return { ok: false, grund: g };
    }
    const nach = await verlaufLesen(p, modul, terminId);
    if (!nach.ok) return nach;
    if (enthaelt(nach.wechsel, neue) && ausnahmenEnthalten(nach.ausnahmen, neueAusnahmen)) {
      return { ok: true, wechsel: nach.wechsel, ausnahmen: nach.ausnahmen };
    }
    letzterGrund = 'nicht-angekommen';
  }
  return { ok: false, grund: letzterGrund };
}
