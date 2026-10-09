/**
 * **Der Datenbereich des eigenen ChurchTools-Moduls** (#335, Phase 3b-4) – Kategorien und Werte der
 * Erweiterung. Darauf bauen die Gemeinde-Einstellungen und das Verzeichnis „Wer teilt" der
 * Team-Notizen. Seit der Ablage in ChurchTools (09.10.2026) für **beide** Auslieferungen: Der Server
 * liest und schreibt dasselbe Verzeichnis, damit App und Erweiterung dieselben Team-Notizen sehen.
 *
 * Gemessen auf der Test-Instanz (Plan §2c), nicht angenommen:
 *  - Das Modul findet man nur über die Liste (`shorty` = Kürzel); `GET /custommodules/<kürzel>` → 400.
 *  - Kategorie anlegen braucht `customModuleId`, `name`, `shorty` (≤ 50 Zeichen).
 *  - Ein Wert ist Text, höchstens 10.000 Zeichen. Anlegen 201, Ändern (`PUT`) 200, Löschen 204,
 *    nochmal löschen 404.
 *  - Ohne Recht „view custom category" kommt eine **leere** Liste, kein Fehler. Fehlendes Recht beim
 *    Schreiben → 401/403 (je Anschluss als „kein Recht" erkannt).
 */

/** Gemessen (Plan §2b): Mehr nimmt ChurchTools in einem Wert nicht an. */
export const MAX_ZEICHEN = 10_000;

export interface Wert {
  id: number;
  dataCategoryId: number;
  value: string;
}

/** Eine Kategorie, wie die App sie anlegt. */
export interface KategorieAngabe {
  kuerzel: string;
  name: string;
  beschreibung: string;
}

/** Der Anschluss an ChurchTools – Browser (Erweiterung) oder Server (Sitzung der Person). */
export interface ModulPort {
  /** Das Kürzel des Moduls (Erweiterung: aus der Adresse, Server: aus der Konfiguration). */
  kuerzel(): string | null;
  /** `GET /api<pfad>`, `data` ausgepackt. */
  daten<T>(pfad: string): Promise<T>;
  /** Schreibender Aufruf mit JSON-Rumpf; `verweigert` ist die Meldung bei fehlendem Recht. */
  schreibe(
    pfad: string,
    auftrag: { method: 'POST' | 'PUT' | 'DELETE'; json?: unknown; verweigert: string },
  ): Promise<void>;
  fehler(status: number, meldung: string): Error;
  istKeinRecht(e: unknown): boolean;
  istNichtGefunden(e: unknown): boolean;
}

/** Die ID des eigenen Moduls. Kein Modul mit dem Kürzel → 404. */
export async function modulSuchen(p: ModulPort): Promise<number> {
  const kuerzel = p.kuerzel();
  const module = await p.daten<{ id: number; shorty: string }[]>('/custommodules');
  const modul = (module ?? []).find((m) => m.shorty === kuerzel);
  if (!modul) throw p.fehler(404, 'Die Musik App ist in ChurchTools nicht zu finden.');
  return modul.id;
}

/** Die Kategorie mit diesem Kürzel – `null`, wenn es sie nicht gibt oder man sie nicht sehen darf. */
export async function kategorieSuchen(
  p: ModulPort,
  modul: number,
  kuerzel: string,
): Promise<number | null> {
  const liste = await p.daten<{ id: number; shorty: string }[]>(
    `/custommodules/${modul}/customdatacategories`,
  );
  return (liste ?? []).find((k) => k.shorty === kuerzel)?.id ?? null;
}

/**
 * Die Kategorie finden – oder anlegen und **danach nachsehen**, ob sie dasteht (ein 201 ist kein Beleg,
 * Lehre vom 11.08.2026). Anlegen darf nur, wer in ChurchTools „create custom category" hat (Admins).
 */
export async function kategorieSicherstellen(
  p: ModulPort,
  modul: number,
  k: KategorieAngabe,
  verweigert: string,
): Promise<number> {
  const da = await kategorieSuchen(p, modul, k.kuerzel);
  if (da !== null) return da;
  await p.schreibe(`/custommodules/${modul}/customdatacategories`, {
    method: 'POST',
    json: { customModuleId: modul, name: k.name, shorty: k.kuerzel, description: k.beschreibung },
    verweigert,
  });
  const neu = await kategorieSuchen(p, modul, k.kuerzel);
  if (neu === null)
    throw p.fehler(502, `ChurchTools hat die Kategorie „${k.name}" nicht angelegt.`);
  return neu;
}

export function wertePfad(modul: number, kategorie: number): string {
  return `/custommodules/${modul}/customdatacategories/${kategorie}/customdatavalues`;
}

export async function werteLesen(p: ModulPort, modul: number, kategorie: number): Promise<Wert[]> {
  return (await p.daten<Wert[]>(wertePfad(modul, kategorie))) ?? [];
}

export async function wertAnlegen(
  p: ModulPort,
  modul: number,
  kategorie: number,
  value: string,
  verweigert: string,
): Promise<void> {
  await p.schreibe(wertePfad(modul, kategorie), {
    method: 'POST',
    json: { dataCategoryId: kategorie, value },
    verweigert,
  });
}

export async function wertAendern(
  p: ModulPort,
  modul: number,
  kategorie: number,
  id: number,
  value: string,
  verweigert: string,
): Promise<void> {
  await p.schreibe(`${wertePfad(modul, kategorie)}/${id}`, {
    method: 'PUT',
    json: { id, dataCategoryId: kategorie, value },
    verweigert,
  });
}

/** Einen Wert löschen. „Schon weg" (404) ist kein Fehler. */
export async function wertLoeschen(
  p: ModulPort,
  modul: number,
  kategorie: number,
  id: number,
  verweigert: string,
): Promise<void> {
  try {
    await p.schreibe(`${wertePfad(modul, kategorie)}/${id}`, { method: 'DELETE', verweigert });
  } catch (e) {
    if (!p.istNichtGefunden(e)) throw e;
  }
}

/** Den Inhalt eines Werts lesen, wenn er von uns ist (`art` + `fassung` passen) – sonst `null`. */
export function inhaltAus<T>(wert: Wert, art: string, fassung: number): T | null {
  try {
    const roh = JSON.parse(wert.value) as { art?: unknown; fassung?: unknown } | null;
    if (roh?.art !== art || roh.fassung !== fassung) return null;
    return roh as T;
  } catch {
    return null;
  }
}

/**
 * Bleibt so, bis jemand in ChurchTools etwas ändert: kein Recht, kein Modul (falsches Kürzel). Ein
 * Neuladen hilft nicht – also gelten die Vorgaben. Alles andere (Netz, Drosselung, 5xx) ist
 * vorübergehend und muss geworfen werden.
 */
export function istDauerhaftLeer(p: ModulPort, e: unknown): boolean {
  return p.istKeinRecht(e) || p.istNichtGefunden(e);
}
