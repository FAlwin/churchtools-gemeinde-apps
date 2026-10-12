import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { PageAnnotation } from '@shared/types/index';

/**
 * Legt **Altbestand** auf dem Daten-Volume an – so, wie ihn die Server-App vor dem Umzug nach ChurchTools
 * (v2.33.0) geschrieben hat. Die Schreibfunktionen dafür gibt es seit 12.10.2026 nicht mehr; Tests für den
 * Umzug brauchen die Dateien trotzdem. Format wie `services/annotations.ts` bzw. `services/userSettings.ts`.
 *
 * Vor dem ersten Lesen des Kontos aufrufen: Die Dienste halten einen Zwischenspeicher. Die Konfiguration
 * wird erst beim Aufruf geladen – die Tests setzen `ANNOTATIONS_PATH` zur Laufzeit, ein statischer Import
 * läse sie vorher mit dem falschen Pfad.
 */
async function ablagePfad(): Promise<string> {
  const { config } = await import('../config.js');
  return config.annotationsPath;
}

async function ergaenzen(datei: string, eintraege: Record<string, unknown>): Promise<void> {
  let alt: Record<string, unknown> = {};
  try {
    alt = JSON.parse(await readFile(datei, 'utf8')) as Record<string, unknown>;
  } catch {
    alt = {};
  }
  await mkdir(path.dirname(datei), { recursive: true });
  await writeFile(datei, JSON.stringify({ ...alt, ...eintraege }));
}

/** Eine Anmerkungsseite des Kontos auf dem Volume. */
export async function nasAnmerkungAnlegen(
  userId: number,
  key: string,
  anmerkung: PageAnnotation,
): Promise<void> {
  await ergaenzen(path.join(await ablagePfad(), `${userId}.json`), { [key]: anmerkung });
}

/** Lied-Einstellungen des Kontos auf dem Volume. */
export async function nasEinstellungenAnlegen(
  userId: number,
  eintraege: Record<string, string>,
): Promise<void> {
  await ergaenzen(path.join(await ablagePfad(), `settings-${userId}.json`), eintraege);
}
