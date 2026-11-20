/**
 * **Wie die Website im Erweiterungs-Speicher liegt** (Bauplan Website W3a-1, §3.2) – und der EINE Anschluss der Website an
 * diesen Speicher (Bauplan §5, Risiko Dev-Platform: Wechselt ChurchTools die Ablage, ist es genau diese Datei).
 *
 * - Eine Kategorie (`entwuerfe-g<ID>`, `veroeffentlicht-g<ID>`, `einrichten.ts`) enthält **Einheiten**: je Seite eine, dazu
 *   je eine für das Menü und die Einstellungen.
 * - Eine Einheit besteht aus einem **Kopf** (wer bin ich, welcher Stand gilt) und **Teilen** mit dem gepackten Inhalt
 *   (`shared/ct/teile.ts`: ein Wert fasst höchstens 10.000 Zeichen, gemessen W0). Der Inhalt selbst ist der Text aus
 *   `modell.ts` (`seiteAlsText` … mit der Kennung `website:v1:`), so bleiben spätere Formate erkennbar.
 * - **Gelesen wird die ganze Kategorie mit EINEM Aufruf** (156 Werte in 81 ms, kein Blättern – gemessen W0) und daraus alles
 *   zusammengesetzt. Was nicht passt (fremd, beschädigt, Teile fehlen), landet in `probleme` – es wird **gemeldet, nie
 *   still verworfen und nie gelöscht**.
 * - **Schreiben** (die Lehre der Protokolle, `protokolle/src/schreiben.ts`): neue Teile → nachlesen → Kopf umstellen →
 *   nachlesen → alte Teile löschen. Bricht es unterwegs ab, zeigt der Kopf weiter auf einen vollständigen Stand; nur das
 *   Aufräumen darf scheitern (das nächste Speichern räumt mit auf). Ein `201` ist kein Beleg (Lehre vom 11.08.2026) – jeder
 *   Schritt wird nachgelesen.
 * - **Vorübergehend ist nicht ungültig:** Jeder Fehler beim Lesen oder Schreiben wird geworfen; nichts wird deswegen
 *   gelöscht oder überschrieben. Der Aufrufer behält die Änderung und versucht es erneut.
 * - Der Speicher kennt keine Versionen: Zwei gleichzeitige Speicherungen derselben Einheit – die spätere gewinnt. Dagegen
 *   schützen die Sperre je Seite (`sperre.ts`, W3a-2) und die Schlange des Editors (`schlange.ts`).
 */
import {
  werteLesen,
  wertAendern,
  wertAnlegen,
  wertLoeschen,
  type ModulPort,
  type Wert,
} from '../ct/modulDaten';
import { teileBauen, textAusTeilen } from '../ct/teile';
import type { Sperre } from '../ct/sperre';
import { istSperrWert, sperreAusWerten, sperreWert } from './sperre';
import {
  einstellungenAlsText,
  einstellungenAusText,
  menueAlsText,
  menueAusText,
  seiteAlsText,
  seiteAusText,
  seiteSchema,
  type Einstellungen,
  type Menue,
  type Seite,
} from './modell';

export type Einheit = 'seite' | 'menue' | 'einstellungen';

/** Menü und Einstellungen gibt es je einmal – ihre Kennung ist fest. */
export const MENUE_ID = 'menue';
export const EINSTELLUNGEN_ID = 'einstellungen';

export interface WebsiteKopf {
  art: 'website-kopf';
  fassung: 1;
  einheit: Einheit;
  /** Seiten-ID, bei Menü und Einstellungen die feste Kennung. */
  id: string;
  /** Prüfsumme des gespeicherten Inhalts; die Teile tragen dieselbe. */
  stand: string;
  /** ISO-Zeit der letzten Speicherung. */
  zeit: string;
}

export interface WebsiteTeil {
  art: 'website-teil';
  fassung: 1;
  einheit: Einheit;
  id: string;
  stand: string;
  nr: number;
  von: number;
  daten: string;
}

const EINHEITEN: readonly Einheit[] = ['seite', 'menue', 'einstellungen'];

function istEinheit(x: unknown): x is Einheit {
  return EINHEITEN.includes(x as Einheit);
}

/** Ist das ein Kopf-Wert der Website? Fremde und kaputte Werte werden beim Lesen gemeldet. */
export function istKopf(x: unknown): x is WebsiteKopf {
  const k = x as Partial<WebsiteKopf> | null;
  return (
    !!k &&
    k.art === 'website-kopf' &&
    k.fassung === 1 &&
    istEinheit(k.einheit) &&
    typeof k.id === 'string' &&
    k.id !== '' &&
    typeof k.stand === 'string' &&
    typeof k.zeit === 'string'
  );
}

/** Ist das ein Teil-Wert der Website? */
export function istTeil(x: unknown): x is WebsiteTeil {
  const t = x as Partial<WebsiteTeil> | null;
  return (
    !!t &&
    t.art === 'website-teil' &&
    t.fassung === 1 &&
    istEinheit(t.einheit) &&
    typeof t.id === 'string' &&
    t.id !== '' &&
    typeof t.stand === 'string' &&
    Number.isInteger(t.nr) &&
    Number.isInteger(t.von) &&
    typeof t.daten === 'string'
  );
}

/** Der Inhalt eines Werts als JSON – `null`, wenn er keins ist. */
function inhalt(w: Pick<Wert, 'value'>): unknown {
  try {
    return JSON.parse(w.value);
  } catch {
    return null;
  }
}

const schluessel = (einheit: Einheit, id: string) => `${einheit}:${id}`;

/** Ein Wert, mit dem etwas nicht stimmt – steht im Hinweis der Seite, gelöscht wird er nie. */
export interface Problem {
  /** Wert-ID in ChurchTools (zum Nachsehen), `null`, wenn es mehrere oder keinen gibt. */
  wert: number | null;
  einheit: Einheit | null;
  id: string | null;
  text: string;
}

export interface WebsiteStand {
  /** Alle lesbaren Seiten, in der Reihenfolge, in der sie angelegt wurden. */
  seiten: Seite[];
  /** `null`: nicht gespeichert (dann gilt der Anfang: leeres Menü). */
  menue: Menue | null;
  einstellungen: Einstellungen | null;
  probleme: Problem[];
  /** Teile ohne Kopf (ein erstes Speichern ist abgebrochen) – unschädlich, das nächste Speichern räumt sie ab. */
  verwaist: number;
  /**
   * Wer bearbeitet welche Seite (Seiten-ID → Sperre), so wie gespeichert – **ob sie noch gilt, entscheidet `sperreLage`**
   * (Zeit!). Nur, was die Oberfläche beim Öffnen einer Seite wissen will; genommen und erneuert wird in `sperre.ts`.
   */
  sperren: Record<string, Sperre>;
}

/**
 * **Alles, was in der Kategorie liegt** – rein, aus den gelesenen Werten. Die kleinste Wert-ID gilt bei doppelten Köpfen
 * (wie bei doppelten Kategorien); jede Unstimmigkeit wird als `Problem` gemeldet.
 */
export function websiteAusWerten(werte: readonly Wert[]): WebsiteStand {
  const probleme: Problem[] = [];
  const koepfe = new Map<string, { wert: number; kopf: WebsiteKopf }>();
  const teile = new Map<string, WebsiteTeil[]>();
  const sperren: Record<string, Sperre> = {};
  const sperrSeiten = new Set<string>();

  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    const x = inhalt(w);
    if (istKopf(x)) {
      const s = schluessel(x.einheit, x.id);
      const festeId =
        x.einheit === 'menue' ? MENUE_ID : x.einheit === 'einstellungen' ? EINSTELLUNGEN_ID : null;
      if (festeId !== null && x.id !== festeId) {
        probleme.push({
          wert: w.id,
          einheit: x.einheit,
          id: x.id,
          text: `Der Wert ${w.id} gehört zu „${x.einheit}“ mit unbekannter Kennung „${x.id}“ und wird nicht benutzt.`,
        });
      } else if (koepfe.has(s)) {
        probleme.push({
          wert: w.id,
          einheit: x.einheit,
          id: x.id,
          text: `Der Wert ${w.id} ist ein zweiter Kopf für dieselbe Einheit (${s}); es gilt der erste.`,
        });
      } else {
        koepfe.set(s, { wert: w.id, kopf: x });
      }
    } else if (istTeil(x)) {
      const s = schluessel(x.einheit, x.id);
      teile.set(s, [...(teile.get(s) ?? []), x]);
    } else if (istSperrWert(w)) {
      // Wer bearbeitet gerade? (`sperre.ts`) – gehört zur Website, ist aber kein Inhalt und kein Problem.
      const sw = sperreWert(w);
      // Wie `sperreAusWerten`: bei mehreren Werten für dieselbe Seite gilt der mit der kleinsten ID.
      if (sw && sw.einheit === 'seite' && !sperrSeiten.has(sw.id)) {
        sperrSeiten.add(sw.id);
        if (sw.sperre) sperren[sw.id] = sw.sperre;
      }
    } else {
      probleme.push({
        wert: w.id,
        einheit: null,
        id: null,
        text: `Der Wert ${w.id} gehört nicht zur Website-Erweiterung oder ist beschädigt.`,
      });
    }
  }

  const seiten: Seite[] = [];
  let menue: Menue | null = null;
  let einstellungen: Einstellungen | null = null;

  for (const [s, { wert, kopf }] of koepfe) {
    const text = textAusTeilen(kopf.stand, teile.get(s) ?? []);
    const wo = { wert, einheit: kopf.einheit, id: kopf.id };
    if (text === null) {
      probleme.push({
        ...wo,
        text: `„${kopf.einheit} ${kopf.id}“ ist gerade nicht vollständig lesbar (Teile fehlen oder gehören zu einem anderen Stand).`,
      });
      continue;
    }
    if (kopf.einheit === 'seite') {
      const r = seiteAusText(text);
      if (!r.ok) probleme.push({ ...wo, text: r.meldung });
      else if (r.wert.id !== kopf.id)
        probleme.push({
          ...wo,
          text: `Die Seite im Wert ${wert} trägt die Kennung „${r.wert.id}“, der Kopf aber „${kopf.id}“.`,
        });
      else seiten.push(r.wert);
    } else if (kopf.einheit === 'menue') {
      const r = menueAusText(text);
      if (r.ok) menue = r.wert;
      else probleme.push({ ...wo, text: r.meldung });
    } else {
      const r = einstellungenAusText(text);
      if (r.ok) einstellungen = r.wert;
      else probleme.push({ ...wo, text: r.meldung });
    }
  }

  let verwaist = 0;
  for (const [s, liste] of teile) if (!koepfe.has(s)) verwaist += liste.length;
  return { seiten, menue, einstellungen, probleme, verwaist, sperren };
}

/** **Die ganze Kategorie lesen** und zusammensetzen. Wirft bei jedem Fehler (vorübergehend ist nicht leer). */
export async function websiteLesen(
  p: ModulPort,
  modul: number,
  kategorie: number,
): Promise<WebsiteStand> {
  return websiteAusWerten(await werteLesen(p, modul, kategorie));
}

// ── Schreiben ────────────────────────────────────────────────────────────────────────────────────────────────

interface Ort {
  p: ModulPort;
  modul: number;
  kategorie: number;
}

/** Die Werte einer Einheit aus einem frisch gelesenen Stand: alle Köpfe (kleinste Wert-ID zuerst) und alle Teile. */
function dieEinheit(werte: readonly Wert[], einheit: Einheit, id: string) {
  const koepfe: { wert: number; kopf: WebsiteKopf }[] = [];
  const teile: { wert: number; teil: WebsiteTeil }[] = [];
  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    const x = inhalt(w);
    if (istKopf(x) && x.einheit === einheit && x.id === id) koepfe.push({ wert: w.id, kopf: x });
    else if (istTeil(x) && x.einheit === einheit && x.id === id)
      teile.push({ wert: w.id, teil: x });
  }
  return { koepfe, teile };
}

/** Liegt der Inhalt mit diesem Stand vollständig da? */
function vollstaendig(
  werte: readonly Wert[],
  einheit: Einheit,
  id: string,
  stand: string,
): boolean {
  return (
    textAusTeilen(
      stand,
      dieEinheit(werte, einheit, id).teile.map((t) => t.teil),
    ) !== null
  );
}

const VERWEIGERT = 'Du darfst die Website nicht bearbeiten.';

/**
 * **Eine Einheit speichern** (Seite, Menü oder Einstellungen) – `text` ist der Text aus `modell.ts` (`seiteAlsText` …).
 * Reihenfolge und Begründung: Kopf dieser Datei. Wirft, wenn etwas nicht ankommt; **ein Fehler VOR dem Umstellen des Kopfes
 * lässt den bisherigen Stand unberührt** (die neuen Teile liegen dann nur herum und werden vom nächsten Speichern genutzt
 * oder aufgeräumt).
 */
export async function einheitSpeichern(
  { p, modul, kategorie }: Ort,
  einheit: Einheit,
  id: string,
  text: string,
  jetzt: Date = new Date(),
): Promise<void> {
  // Zuerst bauen: Ein zu großer Teil wirft, bevor irgendetwas geschrieben ist.
  const { stand, werte: neueTeile } = teileBauen(
    text,
    (t) =>
      ({
        art: 'website-teil',
        fassung: 1,
        einheit,
        id,
        stand: t.stand,
        nr: t.nr,
        von: t.von,
        daten: t.daten,
      }) satisfies WebsiteTeil,
    'Ein Website-Teil',
  );

  // 1. Neue Teile – außer, sie liegen schon vollständig da (unveränderter Inhalt, oder ein früheres Speichern mit demselben
  //    Text, dessen Kopf oder Aufräumen scheiterte).
  const vorher = await werteLesen(p, modul, kategorie);
  if (!vollstaendig(vorher, einheit, id, stand))
    for (const w of neueTeile) await wertAnlegen(p, modul, kategorie, w, VERWEIGERT);

  // 2. Nachlesen: Sind sie vollständig angekommen?
  const f2 = await werteLesen(p, modul, kategorie);
  if (!vollstaendig(f2, einheit, id, stand))
    throw p.fehler(502, 'ChurchTools hat die Website nicht vollständig übernommen.');

  // 3. Kopf umstellen – auf dem frisch gelesenen Stand.
  const kopf: WebsiteKopf = {
    art: 'website-kopf',
    fassung: 1,
    einheit,
    id,
    stand,
    zeit: jetzt.toISOString(),
  };
  const alt = dieEinheit(f2, einheit, id).koepfe[0];
  if (alt) await wertAendern(p, modul, kategorie, alt.wert, JSON.stringify(kopf), VERWEIGERT);
  else await wertAnlegen(p, modul, kategorie, JSON.stringify(kopf), VERWEIGERT);

  // 4. Nachlesen: Zeigt der Kopf auf den neuen Stand?
  const f3 = await werteLesen(p, modul, kategorie);
  const jetztKopf = dieEinheit(f3, einheit, id).koepfe[0]?.kopf;
  if (jetztKopf?.stand !== stand)
    throw p.fehler(502, 'ChurchTools hat den neuen Stand der Website nicht übernommen.');

  // 5. Alte Teile weg – scheitert das, räumt das nächste Speichern sie mit auf (der Kopf zeigt schon auf die neuen).
  for (const t of dieEinheit(f3, einheit, id).teile) {
    if (t.teil.stand === stand) continue;
    try {
      await wertLoeschen(p, modul, kategorie, t.wert, VERWEIGERT);
    } catch (e) {
      console.warn('Website: alter Teil bleibt vorerst liegen', t.wert, e);
    }
  }
}

/**
 * **Eine Einheit löschen** (eine Seite): erst der Kopf – dann ist sie sofort weg und es bleibt kein Kopf zurück, der auf
 * fehlende Teile zeigt –, nachlesen, dann die Teile. Scheitert das Löschen der Teile, liegen sie verwaist da (unschädlich,
 * `verwaist` im Stand).
 */
export async function einheitLoeschen(
  { p, modul, kategorie }: Ort,
  einheit: Einheit,
  id: string,
): Promise<void> {
  const f = await werteLesen(p, modul, kategorie);
  const da = dieEinheit(f, einheit, id);
  for (const k of da.koepfe) await wertLoeschen(p, modul, kategorie, k.wert, VERWEIGERT);
  const f2 = await werteLesen(p, modul, kategorie);
  if (dieEinheit(f2, einheit, id).koepfe.length > 0)
    throw p.fehler(502, 'ChurchTools hat die Seite nicht gelöscht.');
  for (const t of dieEinheit(f2, einheit, id).teile) {
    try {
      await wertLoeschen(p, modul, kategorie, t.wert, VERWEIGERT);
    } catch (e) {
      console.warn('Website: Teil einer gelöschten Seite bleibt vorerst liegen', t.wert, e);
    }
  }
  // Die Sperre der Seite (W3a-2) hat mit der Seite nichts mehr zu tun – Aufräumen darf scheitern (unschädlich).
  const sperre = sperreAusWerten(f2, einheit, id);
  if (sperre) {
    try {
      await wertLoeschen(p, modul, kategorie, sperre.wert, VERWEIGERT);
    } catch (e) {
      console.warn('Website: Sperre einer gelöschten Seite bleibt vorerst liegen', sperre.wert, e);
    }
  }
}

/**
 * Eine Seite speichern. **Geprüft wird vorher mit dem Schema** (`seiteSchema`): Was nicht passt, wird nicht geschrieben –
 * gleich, aus welchem Weg es kommt (W3a-2: der Editor prüft vor dem Speichern auch selbst und zeigt die Meldung im Fenster;
 * das hier ist die letzte Sicherung, damit nie etwas Unlesbares im Speicher landet).
 */
export async function seiteSpeichern(o: Ort, seite: Seite, jetzt?: Date): Promise<void> {
  const r = seiteSchema.safeParse(seite);
  if (!r.success)
    throw o.p.fehler(
      422,
      `Diese Seite ist nicht gültig und wurde nicht gespeichert: ${r.error.issues[0]?.message ?? 'unbekannter Fehler'}`,
    );
  await einheitSpeichern(o, 'seite', seite.id, seiteAlsText(seite), jetzt);
}
export const menueSpeichern = (o: Ort, menue: Menue, jetzt?: Date) =>
  einheitSpeichern(o, 'menue', MENUE_ID, menueAlsText(menue), jetzt);
export const einstellungenSpeichern = (o: Ort, e: Einstellungen, jetzt?: Date) =>
  einheitSpeichern(o, 'einstellungen', EINSTELLUNGEN_ID, einstellungenAlsText(e), jetzt);
export const seiteLoeschen = (o: Ort, id: string) => einheitLoeschen(o, 'seite', id);

export type { Ort as SpeicherOrt };
