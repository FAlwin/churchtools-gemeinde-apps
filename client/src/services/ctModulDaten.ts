/**
 * **Der Datenbereich des eigenen ChurchTools-Moduls** (#335, Phase 3b-4) – Kategorien und Werte der
 * Erweiterung. Darauf bauen die Gemeinde-Einstellungen (`ctEinstellungen.ts`) und das Verzeichnis
 * „Wer teilt" der Team-Notizen (`ctTeilen.ts`).
 *
 * Gemessen auf der Test-Instanz (Plan §2c), nicht angenommen:
 *  - Das Modul findet man nur über die Liste (`shorty` = Kürzel); `GET /custommodules/<kürzel>` → 400.
 *  - Kategorie anlegen braucht `customModuleId`, `name`, `shorty` (≤ 50 Zeichen).
 *  - Ein Wert ist Text, höchstens 10.000 Zeichen. Anlegen 201, Ändern (`PUT`) 200, Löschen 204,
 *    nochmal löschen 404.
 *  - Ohne Recht „view custom category" kommt eine **leere** Liste, kein Fehler. Fehlendes Recht beim
 *    Schreiben → 401 (`KeinSpeicherRecht`, siehe `ctRuntime.fehlerAus`).
 */
import { ApiError } from './api';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from './ctRuntime';
import { erweiterungsKuerzel } from './modus';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';

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

/**
 * Die ID des eigenen Moduls – je Sitzung der Seite einmal gesucht. Ein Fehlschlag wird NICHT gemerkt
 * (vorübergehend ist nicht ungültig).
 */
const modulSuche = merkeVersprechen<number>();

export function modulId(): Promise<number> {
  return modulSuche.hole('modul', async () => {
    const kuerzel = erweiterungsKuerzel();
    const module = await ctDaten<{ id: number; shorty: string }[]>('/custommodules');
    const modul = (module ?? []).find((m) => m.shorty === kuerzel);
    if (!modul) throw new ApiError(404, 'Die Musik App ist in ChurchTools nicht zu finden.');
    return modul.id;
  });
}

/** Nur für Tests: das gemerkte Modul vergessen. */
export function _vergissModul(): void {
  modulSuche.vergiss();
}

/** Die Kategorie mit diesem Kürzel – `null`, wenn es sie nicht gibt oder man sie nicht sehen darf. */
export async function kategorieSuchen(modul: number, kuerzel: string): Promise<number | null> {
  const liste = await ctDaten<{ id: number; shorty: string }[]>(
    `/custommodules/${modul}/customdatacategories`,
  );
  return (liste ?? []).find((k) => k.shorty === kuerzel)?.id ?? null;
}

/**
 * Die Kategorie finden – oder anlegen und **danach nachsehen**, ob sie dasteht (ein 201 ist kein Beleg,
 * Lehre vom 11.08.2026). Anlegen darf nur, wer in ChurchTools „create custom category" hat (Admins).
 */
export async function kategorieSicherstellen(
  modul: number,
  k: KategorieAngabe,
  verweigert: string,
): Promise<number> {
  const da = await kategorieSuchen(modul, k.kuerzel);
  if (da !== null) return da;
  await ctAnfrage(`/custommodules/${modul}/customdatacategories`, {
    method: 'POST',
    body: JSON.stringify({
      customModuleId: modul,
      name: k.name,
      shorty: k.kuerzel,
      description: k.beschreibung,
    }),
    verweigert,
  });
  const neu = await kategorieSuchen(modul, k.kuerzel);
  if (neu === null) {
    throw new ApiError(502, `ChurchTools hat die Kategorie „${k.name}" nicht angelegt.`);
  }
  return neu;
}

function wertePfad(modul: number, kategorie: number): string {
  return `/custommodules/${modul}/customdatacategories/${kategorie}/customdatavalues`;
}

export async function werteLesen(modul: number, kategorie: number): Promise<Wert[]> {
  return (await ctDaten<Wert[]>(wertePfad(modul, kategorie))) ?? [];
}

export async function wertAnlegen(
  modul: number,
  kategorie: number,
  value: string,
  verweigert: string,
): Promise<void> {
  await ctAnfrage(wertePfad(modul, kategorie), {
    method: 'POST',
    body: JSON.stringify({ dataCategoryId: kategorie, value }),
    verweigert,
  });
}

export async function wertAendern(
  modul: number,
  kategorie: number,
  id: number,
  value: string,
  verweigert: string,
): Promise<void> {
  await ctAnfrage(`${wertePfad(modul, kategorie)}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ id, dataCategoryId: kategorie, value }),
    verweigert,
  });
}

/** Einen Wert löschen. „Schon weg" (404) ist kein Fehler. */
export async function wertLoeschen(
  modul: number,
  kategorie: number,
  id: number,
  verweigert: string,
): Promise<void> {
  try {
    await ctAnfrage(`${wertePfad(modul, kategorie)}/${id}`, { method: 'DELETE', verweigert });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
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
export function istDauerhaftLeer(e: unknown): boolean {
  return e instanceof KeinSpeicherRecht || (e instanceof ApiError && e.status === 404);
}
