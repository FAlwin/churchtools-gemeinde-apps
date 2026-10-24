import type { CtArrangement, CtSong } from './typen';
import type { ArrangementOverrides } from './arrangementPayload';
import type { SongOverrides } from './songPayload';
import { arrangementAendern, arrangementAus } from './schreibKern';
import { liedAendern, type CtVerwalter } from './liedVerwaltung';
import {
  liedinfoAusDatei,
  liedinfoVergleich,
  liedinfoZeilenEntfernen,
  tempoAusText,
  type Liedinfo,
} from './liedinfo';

/** Was ChurchTools an Liedinfo führt – aus den Rohdaten (Server und Erweiterung lesen gleich). */
function liedinfoAusCt(song: CtSong, arr: CtArrangement): Liedinfo {
  const tempo = arr.tempo ?? arr.bpm;
  return {
    name: song.name,
    author: song.author,
    ccli: song.ccli,
    copyright: song.copyright ?? null,
    tempo: tempo === null || tempo === undefined || tempo === '' ? null : String(tempo),
    beat: arr.beat,
  };
}

/**
 * **SongSelect-Import: Liedinfo nach ChurchTools** (Lied-Editor L4-4, Alwin 23.10.2026). Ein Notenblatt aus SongSelect
 * bringt Titel, Autor, CCLI, Copyright, Tempo und Takt als Kopfzeilen mit. Dieselbe Regel wie beim Speichern im
 * Editor:
 *  - Leere ChurchTools-Felder werden aus dem Import gefüllt – **vorhandene nie überschrieben**.
 *  - Danach wird das Lied frisch gelesen; nur die Zeilen der Felder, die ChurchTools DANN hat, verlassen den Text.
 *
 * Scheitert das Füllen (Rechte, Netz, Zeitüberschreitung), kommt der Text unverändert zurück: Das Notenblatt wird
 * trotzdem gespeichert, alle Angaben stehen weiter darin – vorübergehend ist nicht ungültig, nichts geht verloren.
 */
export async function liedinfoBeimImport(
  s: CtVerwalter,
  songId: number,
  arrangementId: number,
  text: string,
): Promise<string> {
  try {
    const song = await s.song(songId);
    const arr = arrangementAus(song, arrangementId, (st, m) => s.fehler(st, m));
    const lied: SongOverrides = {};
    const arrangement: ArrangementOverrides = {};
    for (const v of liedinfoVergleich(liedinfoAusDatei(text), liedinfoAusCt(song, arr))) {
      if (v.art !== 'vorbelegen') continue;
      if (v.feld === 'tempo') {
        const zahl = tempoAusText(v.datei);
        if (zahl !== null) arrangement.tempo = zahl;
      } else if (v.feld === 'beat') arrangement.beat = v.datei;
      else lied[v.feld] = v.datei;
    }
    if (Object.keys(lied).length) await liedAendern(s, songId, lied);
    if (Object.keys(arrangement).length)
      await arrangementAendern(s, songId, arrangementId, arrangement);
    // Erst das Ergebnis in der Hand, dann aufräumen: frisch lesen, was ChurchTools jetzt wirklich hat.
    const stand = await s.song(songId);
    return liedinfoZeilenEntfernen(
      text,
      liedinfoAusCt(
        stand,
        arrangementAus(stand, arrangementId, (st, m) => s.fehler(st, m)),
      ),
    );
  } catch {
    return text;
  }
}
