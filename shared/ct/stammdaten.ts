/**
 * Lied-Kategorien und Liedquellen (Liederbücher) aus ChurchTools – **für beide Auslieferungen**
 * (#335, Phase 3b-2). Lag bis dahin in `server/src/services/ctSongCategories.ts` und `ctSongSources.ts`.
 *
 * Beides gemessen, nicht angenommen (`server/scripts/probe-songmgmt.ts`, 13.08.2026):
 *  1. **Die Namen.** Unter `/api/` gibt es sie nicht. Die alte churchservice-Schnittstelle liefert sie
 *     über `getMasterData` → `songcategory` / `songsource`. Dort ist `id` eine **Zeichenkette** und das
 *     Namensfeld der Kategorie heißt `bezeichnung`. Aus dem Browser geht derselbe Aufruf mit der Sitzung
 *     der Seite und CSRF-Token (gemessen 07.10.2026; ohne Token → 401).
 *  2. **Die Rechte.** `edit songcategory` nennt die erlaubten Kategorie-IDs. Ausgewertet wird das an
 *     genau einer Stelle: `parseSongEditRight` in `rechte.ts`.
 *
 * Hier steht nur das Auswerten der Rohdaten – geholt wird beim Aufrufer (Server: `ctAjax`, Browser:
 * `ctLesen`).
 */
import type { SongCategory, SongSource } from '../types/index';
import { ctId } from './ctId';
import { parseSongEditRight, rechteAus } from './rechte';
import type { CtSongListEntry } from './typen';

interface RohKategorie {
  id?: string | number;
  bezeichnung?: string;
  sortkey?: string | number;
}

interface RohQuelle {
  id?: string | number;
  name?: string;
  shorty?: string;
  sortkey?: string | number;
}

/** Was `getMasterData` an Liedern betrifft (der Rest der Antwort interessiert hier nicht). */
export interface LiedStammdatenRoh {
  songcategory?: Record<string, RohKategorie> | RohKategorie[];
  songsource?: Record<string, RohQuelle> | RohQuelle[];
}

/** Die Kategorien aus `getMasterData` – sortiert wie in ChurchTools. */
export function kategorienAusStammdaten(daten: LiedStammdatenRoh): SongCategory[] {
  // Beide Formen zulassen: heute ein Array, bei `songsource` ein Objekt – und morgen vielleicht
  // umgekehrt. `Object.values` deckt beides ab, ohne dass jemand die Form raten muss.
  const roh = daten.songcategory ? Object.values(daten.songcategory) : [];
  return roh
    .map((k) => ({
      // Über `ctId`: Die ID kommt als `"0"` und MUSS eine Zahl werden – sie wird später mit den IDs
      // aus dem Rechte-Array und mit `song.category.id` verglichen. `Number(k.id)` allein wäre hier
      // falsch, weil ein fehlendes Feld (`null`) dabei zur echten Kategorie 0 würde.
      id: ctId(k.id),
      name: (k.bezeichnung ?? '').trim(),
      sortkey: Number(k.sortkey ?? 0),
    }))
    .filter((k): k is { id: number; name: string; sortkey: number } => k.id !== null && !!k.name)
    .sort((a, b) => a.sortkey - b.sortkey || a.name.localeCompare(b.name, 'de'))
    .map(({ id, name }) => ({ id, name }));
}

/** Die Liedquellen (Liederbücher) aus `getMasterData` – sortiert wie in ChurchTools. */
export function quellenAusStammdaten(daten: LiedStammdatenRoh): SongSource[] {
  const roh = daten.songsource ? Object.values(daten.songsource) : [];
  return roh
    .map((q) => ({
      id: ctId(q.id),
      name: (q.name ?? '').trim(),
      shorty: (q.shorty ?? '').trim(),
      sortkey: Number(q.sortkey ?? 0),
    }))
    .filter((q): q is { id: number; name: string; shorty: string; sortkey: number } => {
      return q.id !== null && !!q.name;
    })
    .sort((a, b) => a.sortkey - b.sortkey || a.name.localeCompare(b.name, 'de'))
    .map(({ id, name, shorty }) => ({ id, name, shorty }));
}

/**
 * Notbehelf, wenn `getMasterData` nicht mitspielt: die Kategorien, die an den Liedern hängen.
 * Kategorien ohne Lied fehlen dann – besser als gar keine Auswahl.
 */
export function kategorienAusLiedern(songs: CtSongListEntry[]): SongCategory[] {
  const gefunden = new Map<number, string>();
  for (const s of songs) {
    // Auch hier über `ctId` – eine eigene Prüfung daneben wäre wieder eine Regel in zwei Fassungen.
    const id = ctId(s.category?.id);
    if (id === null) continue;
    const name = (s.category?.name ?? '').trim();
    if (!gefunden.has(id) && name) gefunden.set(id, name);
  }
  return [...gefunden]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Alle Kategorien der Instanz – Namen aus `getMasterData`, sonst aus den Liedern.
 *
 * Der Rückfall ist bewusst still (nur eine Warnung): Die Kategorien sind Beiwerk zu einem Formular,
 * und ein Fehler der alten Schnittstelle soll das Anlegen nicht verhindern, solange sich die Namen
 * anders beschaffen lassen. **Nur bei einer Drosselung nicht** (#300): Dann ist der Rückfall –
 * mehrere Seiten Liederliste – genau die Last, die ChurchTools gerade abwehrt.
 */
export async function alleKategorien(mittel: {
  stammdaten: () => Promise<LiedStammdatenRoh>;
  lieder: () => Promise<CtSongListEntry[]>;
  istUeberlastet: (e: unknown) => boolean;
  warnen?: (meldung: string) => void;
}): Promise<SongCategory[]> {
  try {
    const mitNamen = kategorienAusStammdaten(await mittel.stammdaten());
    if (mitNamen.length > 0) return mitNamen;
    mittel.warnen?.('getMasterData lieferte keine Kategorien – weiche auf Lieder aus');
  } catch (err) {
    if (mittel.istUeberlastet(err)) throw err;
    mittel.warnen?.(
      `getMasterData fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) – weiche auf Lieder aus`,
    );
  }
  return kategorienAusLiedern(await mittel.lieder());
}

/**
 * Die Kategorien, in denen der Nutzer Lieder anlegen/ändern darf – **immer zugeschnitten**: Eine
 * Auswahl, die Kategorien anbietet, die ChurchTools danach ablehnt, ist ein Knopf ins Leere. Dieselbe
 * Liste prüft beim Anlegen und Ändern, ob eine Kategorie erlaubt ist (`pruefeKategorie`).
 *
 * Ein Admin hat in ChurchTools oft KEINE Kategorie-Liste (`ids: []`), darf aber alles – deshalb wird
 * er eigens erkannt, über `rechteAus` (die eine Stelle für das Admin-Recht).
 */
export function bearbeitbareKategorien(
  rechte: Record<string, Record<string, unknown>>,
  adminRecht: string,
  alle: SongCategory[],
  fehler: (status: number, meldung: string) => Error,
): SongCategory[] {
  const { isAdmin } = rechteAus(rechte, adminRecht, fehler);
  const recht = parseSongEditRight(rechte);
  // Ohne Einschränkung (Admin oder Recht ohne Aufzählung): alles, was die Instanz kennt.
  if (isAdmin || recht.ids === null) return alle;
  const bekannt = new Map(alle.map((k) => [k.id, k.name]));
  return recht.ids.map((id) => ({ id, name: bekannt.get(id) ?? `Kategorie ${id}` }));
}
