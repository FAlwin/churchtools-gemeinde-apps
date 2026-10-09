import { useLayoutEffect } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { arrangementMigrationAnwenden } from '../utils/arrangementMigration';
import { versionMigrationAnwenden } from '../utils/versionMigration';
import { lsSong } from '../utils/songVersions';

/**
 * Die zwei lokalen Schlüssel-Umzüge des Liedblatts – **vor dem Zeichnen, aber nicht beim Rendern**
 * (#465).
 *
 * - **Versionen** (07.10.2026, `versionMigration.ts`): Tonart, Anmerkungen und die gewählte Version vom
 *   alten Versions-Schlüssel mitnehmen.
 * - **Arrangement** (#320, `arrangementMigration.ts`): Bestandsnotizen dem geltenden Arrangement
 *   zuschlagen. Über ALLE Lieder des Ablaufs – der Strom zeigt im Querformat auch Nachbarseiten.
 *
 * Beide standen bis #465 in einem `useMemo`: Effekte laufen NACH dem Zeichnen, die Seiten hätten einen
 * Wimpernschlag ohne die Notizen dagestanden. Ein `useMemo` ist aber nur ein Leistungs-Hinweis, keine
 * Stelle für Nebenwirkungen. **`useLayoutEffect` läuft vor dem Zeichnen** – und vor den gewöhnlichen
 * Effekten, mit denen die Seiten ihre Notizen lesen. Die Einstellungen hatte `useSongSettings` beim
 * ersten Rendern schon gelesen; hat der Versions-Umzug etwas bewegt, liest `reloadSettings` sie neu –
 * ebenfalls noch vor dem Zeichnen.
 *
 * Beide Umzüge sind rein lokal, synchron und idempotent (ein zweiter Lauf findet nichts mehr).
 */
export function useLokaleUmzuege(
  songsAusAblauf: SetlistSong[],
  songs: SetlistSong[],
  reloadSettings: () => void,
): void {
  useLayoutEffect(() => {
    const gewaehltVorher = songsAusAblauf.map((s) => lsSong('ver', s.id));
    let kopiert = 0;
    for (const s of songsAusAblauf) kopiert += versionMigrationAnwenden(s);
    const wahlGeaendert = songsAusAblauf.some((s, i) => lsSong('ver', s.id) !== gewaehltVorher[i]);
    if (kopiert > 0 || wahlGeaendert) reloadSettings();
  }, [songsAusAblauf, reloadSettings]);

  useLayoutEffect(() => {
    for (const s of songs) arrangementMigrationAnwenden(s.id, s.arrangementId);
  }, [songs]);
}
