/**
 * **Tonart und Anmerkungen einer Version auf ihren berichtigten Schlüssel mitnehmen** (07.10.2026).
 *
 * Bis zu diesem Tag las die App den Versionsnamen am ERSTEN Strich im Dateinamen ab. Bei Liedern mit
 * Bindestrich im Titel („Testlied 3b-2 — Akustik (App).chordpro") wurde daraus „2 — Akustik" – und der
 * Schlüssel `2-akustik` statt `akustik`. Darunter liegen Tonart, Kapo, Spalten, Anmerkungen und Zoom.
 * Seit der Berichtigung (`versionNameOf`) sucht die App unter `akustik`; Lied und Version tragen den
 * alten Schlüssel als `alterKey` mit.
 *
 * Wie beim Arrangement-Umzug (`arrangementMigration.ts`): **kopieren, nicht umbenennen** (der Bestand
 * bleibt, ein Kopieren ist umkehrbar) und **nichts überschreiben** (was es unter dem neuen Schlüssel
 * schon gibt, gewinnt). Idempotent – ein zweiter Lauf findet nichts mehr.
 */
import type { SetlistSong } from '@shared/types/index';
import type { Kopie } from './arrangementMigration';
import { lsSong, setLsSong } from './songVersions';
import { lokalSchreiben } from './lokalSpeicher';

function ohneSonderzeichen(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Welche Schlüssel dieses Lieds gehören zur Version `alt` und müssen nach `neu` kopiert werden?
 *  - Anmerkungen und Zoom (jeder Namensraum): `…song<id>(_a<arr>)?_v<alt>(_lyr)?_…`
 *  - Einstellungen je Version: `worship_<art>_<id>_<alt>` (samt altem Geräte-Anhang `_d…`)
 */
export function versionKopien(
  vorhanden: string[],
  songId: number,
  alt: string,
  neu: string,
): Kopie[] {
  const a = ohneSonderzeichen(alt);
  const anmerkung = new RegExp(`^(.*song${songId}(?:_a\\d+)?_v)${a}((?:_lyr)?_.*)$`);
  const einstellung = new RegExp(`^(worship_[a-z]+_${songId}_)${a}((?:_d[a-z0-9]+)?)$`);
  const belegt = new Set(vorhanden);
  const kopien: Kopie[] = [];
  for (const von of vorhanden) {
    const m = anmerkung.exec(von) ?? einstellung.exec(von);
    if (!m) continue;
    const nach = `${m[1]}${neu}${m[2]}`;
    if (belegt.has(nach)) continue;
    kopien.push({ von, nach });
  }
  return kopien;
}

/**
 * Die Kopien für alle Versionen eines Lieds anlegen – und die gemerkte Wahl der Version
 * (`worship_ver_<id>`) mitziehen, sonst fiele das Lied beim Öffnen aufs Original zurück. Gibt zurück,
 * wie viele Schlüssel kopiert wurden.
 *
 * **Muss laufen, BEVOR die Einstellungen gelesen werden** (`useSongSettings`) – sonst stünde beim
 * ersten Öffnen die Vorgabe statt der gemerkten Tonart da.
 */
export function versionMigrationAnwenden(song: SetlistSong): number {
  const umzug = song.versions.filter(
    (v): v is typeof v & { alterKey: string } => !!v.alterKey && v.alterKey !== v.key,
  );
  if (umzug.length === 0) return 0;
  const vorhanden: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) vorhanden.push(k);
  }
  let anzahl = 0;
  for (const v of umzug) {
    for (const { von, nach } of versionKopien(vorhanden, song.id, v.alterKey, v.key)) {
      const wert = localStorage.getItem(von);
      if (wert !== null && lokalSchreiben(nach, wert)) anzahl++;
    }
    // Die gewählte Version – über `setLsSong`, damit auch das Konto (und damit andere Geräte) sie hat.
    if (lsSong('ver', song.id) === v.alterKey) setLsSong('ver', song.id, v.key);
  }
  return anzahl;
}
