/**
 * **Wo steht diese Seite im Freigabe-Weg?** (Bauplan Website W3b-2, E-W23/E-W24). Je Seite in „Entwürfe“ ein **eigener Wert**
 * (`website-status`) – nach dem Vorbild der Sperre (`sperre.ts`): eigener Wert, **ein** Schreiber, kein Streit mit dem Kopf der
 * Seite. Der Kopf wird bei jedem Speichern neu geschrieben (`einheitSpeichern`); läge der Status darin, würde jedes Speichern
 * eines Redakteurs („Ändern nach dem Einreichen ist erlaubt“, E-W24) einen Status überschreiben – oder umgekehrt.
 *
 * - **Kein Wert = Entwurf.** Es gibt keinen Zustand „Entwurf“ zum Speichern.
 * - `eingereicht` – ein Redakteur bittet die Leitung um Freigabe. `zurueck` – die Leitung gibt mit Anmerkung zurück.
 *   `loeschenAngefragt` – ein Redakteur bittet darum, die Seite zu löschen (E-W23; die Seite bleibt, wie sie ist).
 * - Der Wert trägt, **wer** (Person-ID + Name) und **wann**. Bei `zurueck` zusätzlich, wer eingereicht hatte (`einreicher`) –
 *   für „Zurückgegeben an dich“ und später die Mail an den Einreichenden (W3b-3).
 * - **Ein Status, der auf eine nicht mehr vorhandene Seite zeigt, wird ignoriert** (`websiteAusWerten`) und beim nächsten
 *   Schreiben eines Status aufgeräumt (`statusSetzen`).
 * - Entfernt wird der Wert ganz (kein Wert = Entwurf). Beim Löschen der Seite geht er mit (`einheitLoeschen`).
 *
 * Wie überall: **vorher frisch lesen, nachher nachlesen** – ein `201` ist kein Beleg (Lehre vom 11.08.2026).
 *
 * **W3b-4 (Untergruppen)** ergänzt den Bereich, dem die Seite gehört, an der Stelle, an der entschieden wird, wer einreichen und
 * freigeben darf (`freigabe.ts`, `darfFreigeben`) – der Wert selbst bleibt, wie er ist.
 */
import { z } from 'zod';
import {
  inhaltAus,
  werteLesen,
  wertAendern,
  wertAnlegen,
  wertLoeschen,
  type Wert,
} from '../ct/modulDaten';
import type { Schreiber } from '../ct/sperre';
import type { SpeicherOrt } from './speicher';

export const STATUS_ZUSTAENDE = ['eingereicht', 'zurueck', 'loeschenAngefragt'] as const;
export type StatusZustand = (typeof STATUS_ZUSTAENDE)[number];

/** So lang darf eine Anmerkung sein – ein Wert fasst höchstens 10.000 Zeichen, der Rest ist Platz für die Hülle. */
export const ANMERKUNG_MAX = 1000;

const person = z.object({ von: z.number().int(), name: z.string() });

export const statusSchema = z.object({
  art: z.literal('website-status'),
  fassung: z.literal(1),
  /** Seiten-ID. */
  id: z.string().min(1),
  zustand: z.enum(STATUS_ZUSTAENDE),
  /** Wer hat den Zustand gesetzt? */
  von: z.number().int(),
  name: z.string(),
  /** ISO-Zeit. */
  zeit: z.string(),
  /** Nur bei `zurueck`. */
  anmerkung: z.string().max(ANMERKUNG_MAX).optional(),
  /** Nur bei `zurueck`: wer hatte eingereicht? */
  einreicher: person.optional(),
});
export type WebsiteStatus = z.infer<typeof statusSchema>;

/** Der Status einer Seite, wie ihn die Oberfläche braucht (ohne die Kennung des Werts). */
export type SeitenStatus = Omit<WebsiteStatus, 'art' | 'fassung' | 'id'>;

/** Was beim Setzen angegeben wird – Wer und Wann kommen aus `ich` und der Uhr. */
export type StatusEingabe =
  | { zustand: 'eingereicht' | 'loeschenAngefragt' }
  | { zustand: 'zurueck'; anmerkung: string; einreicher?: { von: number; name: string } };

/** Der Inhalt eines Status-Werts – `null`, wenn es keiner ist (oder er beschädigt ist). */
export function statusWert(w: Wert): WebsiteStatus | null {
  const roh = inhaltAus<unknown>(w, 'website-status', 1);
  if (!roh) return null;
  const r = statusSchema.safeParse(roh);
  return r.success ? r.data : null;
}

/** Ist das ein Status-Wert der Website (egal für welche Seite)? Das Lesen der Website überspringt ihn. */
export function istStatusWert(w: Wert): boolean {
  return statusWert(w) !== null;
}

function ohneKennung(s: WebsiteStatus): SeitenStatus {
  const { art, fassung, id, ...rest } = s;
  void art;
  void fassung;
  void id;
  return rest;
}

/**
 * **Alle Status-Werte, nach Seiten-ID** – bei mehreren Werten für dieselbe Seite gilt der mit der kleinsten Wert-ID (wie bei
 * Köpfen, Kategorien und der Sperre).
 */
export function statusAusWerten(werte: readonly Wert[]): Record<string, SeitenStatus> {
  const aus: Record<string, SeitenStatus> = {};
  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    const s = statusWert(w);
    if (s && !(s.id in aus)) aus[s.id] = ohneKennung(s);
  }
  return aus;
}

function statusWerte(
  werte: readonly Wert[],
  seiteId: string,
): { wert: number; status: WebsiteStatus }[] {
  const liste: { wert: number; status: WebsiteStatus }[] = [];
  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    const s = statusWert(w);
    if (s && s.id === seiteId) liste.push({ wert: w.id, status: s });
  }
  return liste;
}

const VERWEIGERT = 'Du darfst die Website nicht bearbeiten.';

/** Kennung des Kopfes, wenn der Wert einer ist. */
function kopfKennung(w: Wert): { einheit: string; id: string } | null {
  const x = inhaltAus<{ einheit?: unknown; id?: unknown }>(w, 'website-kopf', 1);
  return x && typeof x.einheit === 'string' && typeof x.id === 'string'
    ? { einheit: x.einheit, id: x.id }
    : null;
}

/** Gibt es diese Seite in „Entwürfe“ (ein Kopf)? Ob er lesbar ist, ist hier einerlei. */
function hatSeite(werte: readonly Wert[], seiteId: string): boolean {
  return werte.some((w) => {
    const k = kopfKennung(w);
    return k?.einheit === 'seite' && k.id === seiteId;
  });
}

/**
 * Status-Werte, deren Seite es nicht mehr gibt, löschen – **so gut es geht** (Aufräumen darf scheitern, unschädlich: sie werden
 * ohnehin ignoriert).
 */
async function waisenAufraeumen(o: SpeicherOrt, werte: readonly Wert[]): Promise<void> {
  const seiten = new Set(
    werte.flatMap((w) => {
      const k = kopfKennung(w);
      return k && k.einheit === 'seite' ? [k.id] : [];
    }),
  );
  for (const w of werte) {
    const s = statusWert(w);
    if (!s || seiten.has(s.id)) continue;
    try {
      await wertLoeschen(o.p, o.modul, o.kategorie, w.id, VERWEIGERT);
    } catch (e) {
      console.warn('Website: Status einer fehlenden Seite bleibt vorerst liegen', w.id, e);
    }
  }
}

function inhaltText(seiteId: string, eingabe: StatusEingabe, ich: Schreiber, jetzt: Date): string {
  const basis = {
    art: 'website-status' as const,
    fassung: 1 as const,
    id: seiteId,
    zustand: eingabe.zustand,
    von: ich.person,
    name: ich.name,
    zeit: jetzt.toISOString(),
  };
  const s: WebsiteStatus =
    eingabe.zustand === 'zurueck'
      ? {
          ...basis,
          anmerkung: eingabe.anmerkung,
          ...(eingabe.einreicher ? { einreicher: eingabe.einreicher } : {}),
        }
      : basis;
  return JSON.stringify(statusSchema.parse(s));
}

/**
 * **Den Status einer Seite setzen** (einreichen, zurückgeben, Löschen anfragen): frisch lesen (gibt es die Seite noch?),
 * schreiben, **nachlesen** – nur was danach so dasteht, gilt. Wirft bei jedem Fehler; **ein Fehler ändert den bisherigen
 * Status nicht** (vorübergehend ist nicht ungültig). Gibt den gelesenen Stand zurück.
 */
export async function statusSetzen(
  o: SpeicherOrt,
  seiteId: string,
  eingabe: StatusEingabe,
  ich: Schreiber,
  jetzt: Date = new Date(),
): Promise<SeitenStatus> {
  if (eingabe.zustand === 'zurueck') {
    const r = statusSchema.shape.anmerkung.safeParse(eingabe.anmerkung);
    if (!r.success || (eingabe.anmerkung ?? '').trim() === '')
      throw o.p.fehler(
        422,
        `Bitte schreib eine Anmerkung (höchstens ${ANMERKUNG_MAX} Zeichen) – sie wurde nicht gespeichert.`,
      );
  }
  const vorher = await werteLesen(o.p, o.modul, o.kategorie);
  if (!hatSeite(vorher, seiteId))
    throw o.p.fehler(404, 'Diese Seite gibt es nicht mehr – der Status wurde nicht gesetzt.');
  const text = inhaltText(seiteId, eingabe, ich, jetzt);
  const da = statusWerte(vorher, seiteId)[0];
  if (da) await wertAendern(o.p, o.modul, o.kategorie, da.wert, text, VERWEIGERT);
  else await wertAnlegen(o.p, o.modul, o.kategorie, text, VERWEIGERT);

  const nachher = await werteLesen(o.p, o.modul, o.kategorie);
  const jetztDa = statusAusWerten(nachher)[seiteId];
  if (!jetztDa || jetztDa.zustand !== eingabe.zustand || jetztDa.zeit !== jetzt.toISOString())
    throw o.p.fehler(502, 'ChurchTools hat den Status der Seite nicht übernommen.');
  await waisenAufraeumen(o, nachher);
  return jetztDa;
}

/**
 * **Den Status entfernen** (Freigabe, Ablehnen) – danach ist die Seite wieder „Entwurf“. Alle Werte dieser Seite, nachlesen,
 * dass keiner übrig ist. Gibt es keinen, ist nichts zu tun (kein Fehler).
 */
export async function statusEntfernen(o: SpeicherOrt, seiteId: string): Promise<void> {
  const vorher = await werteLesen(o.p, o.modul, o.kategorie);
  for (const s of statusWerte(vorher, seiteId))
    await wertLoeschen(o.p, o.modul, o.kategorie, s.wert, VERWEIGERT);
  const nachher = await werteLesen(o.p, o.modul, o.kategorie);
  if (statusWerte(nachher, seiteId).length > 0)
    throw o.p.fehler(502, 'ChurchTools hat den Status der Seite nicht entfernt.');
}

/** Für `einheitLoeschen`: die Wert-IDs der Status-Werte dieser Seite. */
export function statusWertIds(werte: readonly Wert[], seiteId: string): number[] {
  return statusWerte(werte, seiteId).map((s) => s.wert);
}
