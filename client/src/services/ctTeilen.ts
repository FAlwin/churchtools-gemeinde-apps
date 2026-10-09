/**
 * **Team-Notizen in der Erweiterung** (#335, Phase 3b-4b) – der Browser-Anschluss an `@shared/ct/teilen`.
 * Regeln, Reihenfolgen und Begründungen stehen dort; seit der Ablage in ChurchTools (09.10.2026) nutzt
 * der Server dieselben, damit App und Erweiterung dieselben Team-Notizen sehen.
 */
import { ApiError } from './api';
import { modulId, modulPort } from './ctModulDaten';
import { meinStatus } from './ctLesen';
import { ablagePort, eigeneAblage, geteilteAblage, type GeteilteAblage } from './personenAblage';
import type { AnnotationText } from '@shared/types/index';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import * as kern from '@shared/ct/teilen';

export { TEILEN_KATEGORIE } from '@shared/ct/teilen';

/**
 * Gelesene Ablagen anderer – eine Minute gemerkt. Beim Öffnen von „Notizen von …" fragt die App
 * nacheinander Liste, Anmerkungen und Einstellungen derselben Person; ohne das Merken wären das drei
 * Mal Dateiliste und Daten-Datei. Ein Fehlschlag wird nicht gemerkt.
 */
const ablagen = merkeVersprechen<GeteilteAblage | null>({ ttlMs: 60_000 });

const anschluss: kern.TeilenAnschluss = {
  modul: modulPort,
  ablage: ablagePort,
  meineAblage: eigeneAblage,
  modulId,
  async ich() {
    const status = await meinStatus();
    if (!status.authenticated || !status.user) {
      throw new ApiError(401, 'Bei ChurchTools nicht mehr angemeldet.');
    }
    const { id, firstName, lastName } = status.user;
    return { id, name: `${firstName} ${lastName}`.trim() };
  },
  fremdeAblage: (personId) => ablagen.hole(personId, () => geteilteAblage(personId)),
  vergissFremde: () => ablagen.vergiss(),
};

/** Nur für Tests. */
export function _vergissAblagen(): void {
  ablagen.vergiss();
}

/** Das Verzeichnis anlegen – beim Speichern der Gruppen durch einen Admin. */
export const teilenEinrichten = (): Promise<void> => kern.teilenEinrichten(anschluss);

/** `GET /api/annotations/sharing` – teilt mein Konto? Aus der eigenen Datei. */
export const teiltIch = (): Promise<{ enabled: boolean }> => kern.teiltIch(anschluss);

/** `PUT /api/annotations/sharing` – eigenes Teilen umschalten. */
export const teilenSetzen = (enabled: boolean): Promise<{ enabled: boolean }> =>
  kern.teilenSetzen(anschluss, enabled);

/** `GET /api/annotations/sharers?songs=…` – wer teilt Anmerkungen zu diesen Liedern (außer mir)? */
export async function teilende(
  songIds: number[],
): Promise<{ id: number; name: string; songs: number[] }[]> {
  const personen = await kern.verzeichnis(anschluss);
  if (personen.length === 0) return [];
  return kern.teilende(anschluss, personen, songIds);
}

/** `GET /api/annotations/of/:personId?songs=…` – geteilte Anmerkungen einer Person (ohne Zoom). */
export const anmerkungenVon = (
  personId: number,
  songIds: number[],
): Promise<Record<string, { strokes: string | null; texts: AnnotationText[] }>> =>
  kern.anmerkungenVon(anschluss, personId, songIds);

/** `GET /api/settings/of/:personId?songs=…` – ihre Lied-Einstellungen (für ihre Ansicht). */
export const einstellungenVon = (
  personId: number,
  songIds: number[],
): Promise<Record<string, string>> => kern.einstellungenVon(anschluss, personId, songIds);
