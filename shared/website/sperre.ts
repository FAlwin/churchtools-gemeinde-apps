/**
 * **Wer bearbeitet diese Seite gerade?** (Bauplan Website W3a-2). Die Regel (`sperreLage`, `SPERRE_MINUTEN`) ist die der
 * Protokolle und steht in `shared/ct/sperre.ts`; hier steht, **wo** die Website die Sperre ablegt und wie sie genommen,
 * erneuert und freigegeben wird.
 *
 * **Warum ein eigener Wert je Seite und nicht im Kopf der Seite** (wie bei den Protokollen): Der Kopf einer Seite wird bei
 * jedem Speichern neu geschrieben (`einheitSpeichern`, Schritt 3 – auf dem frisch gelesenen Stand). Ein Lebenszeichen der
 * Sperre, das im selben Wert läge, würde mit diesem Schreiben um den Wert streiten: Das spätere gewinnt, das andere ist
 * still weg – entweder die Sperre oder die Seite. Ein eigener Wert (`website-sperre`) hat genau einen Schreiber (die
 * Sperre) und lässt Kopf und Teile der Seite unberührt. Der Preis: ein Wert mehr in der Kategorie, den das Lesen der Website
 * kennt und überspringt (`websiteAusWerten`) und den das Löschen einer Seite mit entfernt.
 *
 * Freigegeben wird, indem `sperre` auf `null` gesetzt wird (der Wert bleibt, das nächste Nehmen nutzt ihn wieder – kein
 * Anlegen und Löschen bei jedem Seitenwechsel). Wer die Seite nicht freigibt (Akku leer, Netz weg), blockiert höchstens
 * `SPERRE_MINUTEN`.
 *
 * Wie bei den Protokollen: **vorher frisch lesen und prüfen, nachher nachlesen** – ein `201` ist kein Beleg dafür, dass die
 * Sperre bei uns liegt (zwei Fenster können fast gleichzeitig nehmen; wessen Wert hinterher dasteht, gewinnt, der andere
 * sieht beim Nachlesen „fremd“ und schreibt nichts).
 */
import { inhaltAus, werteLesen, wertAendern, wertAnlegen, type Wert } from '../ct/modulDaten';
import { sperreLage, sperreVon, type Schreiber, type Sperre } from '../ct/sperre';
import type { Einheit, SpeicherOrt } from './speicher';

export interface WebsiteSperre {
  art: 'website-sperre';
  fassung: 1;
  einheit: Einheit;
  /** Seiten-ID. */
  id: string;
  /** `null`: freigegeben. */
  sperre: Sperre | null;
}

const ART = 'website-sperre';

/** Ist das ein Sperr-Wert der Website? (Die Sperre selbst wird nur grob geprüft – ein kaputter Wert gilt als frei.) */
function istWebsiteSperre(x: unknown): x is WebsiteSperre {
  const k = x as Partial<WebsiteSperre> | null;
  return (
    !!k &&
    k.art === ART &&
    k.fassung === 1 &&
    typeof k.einheit === 'string' &&
    typeof k.id === 'string' &&
    k.id !== ''
  );
}

function sperreGueltig(s: unknown): s is Sperre {
  const x = s as Partial<Sperre> | null;
  return (
    !!x &&
    typeof x.von === 'number' &&
    typeof x.name === 'string' &&
    typeof x.seit === 'string' &&
    (x.fenster === undefined || typeof x.fenster === 'string')
  );
}

/** Ist dieser Wert ein Sperr-Wert der Website (egal für welche Seite)? Das Lesen der Website überspringt ihn. */
export function istSperrWert(w: Wert): boolean {
  return sperreWert(w) !== null;
}

/** Der Inhalt eines Sperr-Werts – `null`, wenn es keiner ist. Eine kaputte Sperre darin gilt als `null` (frei). */
export function sperreWert(
  w: Wert,
): { einheit: Einheit; id: string; sperre: Sperre | null } | null {
  const x = inhaltAus<WebsiteSperre>(w, ART, 1);
  if (!x || !istWebsiteSperre(x)) return null;
  return { einheit: x.einheit, id: x.id, sperre: sperreGueltig(x.sperre) ? x.sperre : null };
}

/** Der Sperr-Wert dieser Seite – bei mehreren der mit der kleinsten ID (wie bei Köpfen und Kategorien). */
export function sperreAusWerten(
  werte: readonly Wert[],
  einheit: Einheit,
  id: string,
): { wert: number; sperre: Sperre | null } | null {
  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    const x = sperreWert(w);
    if (x && x.einheit === einheit && x.id === id) return { wert: w.id, sperre: x.sperre };
  }
  return null;
}

/**
 * Was gesperrt wird: eine Seite (nur die ID – so rufen es die Seiten seit W3a-2 auf) oder eine andere Einheit mit fester
 * Kennung (die Einstellungen, W3a-3: `{ einheit: 'einstellungen', id: EINSTELLUNGEN_ID }`). **Eine Regel für alle** –
 * nur der Schlüssel (`einheit` + `id`) unterscheidet, nicht der Ablauf.
 */
export type SperrZiel = string | { einheit: Einheit; id: string };

function zielVon(z: SperrZiel): { einheit: Einheit; id: string } {
  return typeof z === 'string' ? { einheit: 'seite', id: z } : z;
}

/** `ok`: die Sperre liegt bei diesem Fenster; `werte` ist der frisch gelesene Stand der Kategorie. */
export type BeginnErgebnis = { art: 'ok'; werte: Wert[] } | { art: 'gesperrt'; sperre: Sperre };

const VERWEIGERT = 'Du darfst die Website nicht bearbeiten.';

function inhaltText(ziel: { einheit: Einheit; id: string }, sperre: Sperre | null): string {
  return JSON.stringify({
    art: ART,
    fassung: 1,
    einheit: ziel.einheit,
    id: ziel.id,
    sperre,
  } satisfies WebsiteSperre);
}

/**
 * **Die Sperre dieser Seite nehmen** – beim ersten Bearbeiten – **oder erneuern** (Lebenszeichen, und unmittelbar vor jedem
 * Speichern). Nur, wenn niemand sonst bearbeitet (`sperreLage`); sonst wird **nichts geschrieben**. Wirft bei jedem Fehler
 * (vorübergehend ist nicht „gesperrt“).
 *
 * Der Aufrufer bekommt den frisch gelesenen Stand der Kategorie mit: Daran sieht er, ob die Seite inzwischen von jemand
 * anderem geändert wurde, bevor er auf einem veralteten Bild aufsetzt.
 */
export async function bearbeitungBeginnen(
  { p, modul, kategorie }: SpeicherOrt,
  seiteId: SperrZiel,
  ich: Schreiber,
  jetzt: Date = new Date(),
): Promise<BeginnErgebnis> {
  const ziel = zielVon(seiteId);
  const vorher = await werteLesen(p, modul, kategorie);
  const da = sperreAusWerten(vorher, ziel.einheit, ziel.id);
  if (sperreLage(da?.sperre ?? null, ich, jetzt) === 'fremd')
    return { art: 'gesperrt', sperre: da!.sperre! };

  return sperreSchreiben({ p, modul, kategorie }, ziel, ich, da, jetzt);
}

/** Die eigene Sperre schreiben (ändern oder anlegen) und **nachlesen**: Nur was danach bei uns steht, gehört uns. */
async function sperreSchreiben(
  { p, modul, kategorie }: SpeicherOrt,
  ziel: { einheit: Einheit; id: string },
  ich: Schreiber,
  da: { wert: number } | null,
  jetzt: Date,
): Promise<BeginnErgebnis> {
  const text = inhaltText(ziel, sperreVon(ich, jetzt));
  if (da) await wertAendern(p, modul, kategorie, da.wert, text, VERWEIGERT);
  else await wertAnlegen(p, modul, kategorie, text, VERWEIGERT);

  const nachher = await werteLesen(p, modul, kategorie);
  const jetztDa = sperreAusWerten(nachher, ziel.einheit, ziel.id);
  if (jetztDa?.sperre && sperreLage(jetztDa.sperre, ich, jetzt) === 'meine')
    return { art: 'ok', werte: nachher };
  if (jetztDa?.sperre) return { art: 'gesperrt', sperre: jetztDa.sperre };
  throw p.fehler(502, 'ChurchTools hat die Sperre der Seite nicht übernommen.');
}

/**
 * **Die Bearbeitung übernehmen** – die Sperre eines anderen (oder eines anderen eigenen Fensters, etwa nach dem Neuladen,
 * wenn die Freigabe beim Verlassen nicht mehr durchkam) **bewusst** wegnehmen. Wie `schreibenUebernehmen` der Protokolle
 * (24.10.2026: sofort, mit Rückfrage in der Oberfläche – die Rückfrage stellt der Aufrufer): frisch lesen, **ohne**
 * `sperreLage`-Prüfung schreiben, nachlesen. Liegt die Sperre danach nicht bei uns (jemand war schneller), kommt
 * `gesperrt` zurück; scheitert das Schreiben, wird geworfen – die Ansicht bleibt dann gesperrt.
 *
 * Das verdrängte Fenster merkt es am nächsten Lebenszeichen oder Speichern (`bearbeitungBeginnen` → `gesperrt`) und
 * schreibt nichts mehr; was dort noch ungespeichert steht, bleibt dort sichtbar.
 */
export async function bearbeitungUebernehmen(
  ort: SpeicherOrt,
  seiteId: SperrZiel,
  ich: Schreiber,
  jetzt: Date = new Date(),
): Promise<BeginnErgebnis> {
  const ziel = zielVon(seiteId);
  const vorher = await werteLesen(ort.p, ort.modul, ort.kategorie);
  return sperreSchreiben(ort, ziel, ich, sperreAusWerten(vorher, ziel.einheit, ziel.id), jetzt);
}

/**
 * **Die Sperre freigeben** – nur die eigene (dasselbe Fenster). Der Aufrufer macht das „so gut es geht“ (beim Verlassen der
 * Seite): Scheitert es, verfällt die Sperre nach `SPERRE_MINUTEN`.
 */
export async function bearbeitungBeenden(
  { p, modul, kategorie }: SpeicherOrt,
  seiteId: SperrZiel,
  ich: Schreiber,
  jetzt: Date = new Date(),
): Promise<void> {
  const ziel = zielVon(seiteId);
  const da = sperreAusWerten(await werteLesen(p, modul, kategorie), ziel.einheit, ziel.id);
  if (!da?.sperre || sperreLage(da.sperre, ich, jetzt) !== 'meine') return;
  await wertAendern(p, modul, kategorie, da.wert, inhaltText(ziel, null), VERWEIGERT);
}
