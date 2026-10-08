/**
 * CCLI SongSelect über ChurchTools – **die Regeln für beide Auslieferungen** (#322, Extension 3b-5 #335).
 *
 * Lag bis dahin in `server/src/services/ctSongSelect.ts` und `setlistBuilder.ts`. Die App ist dabei nur
 * **Fernbedienung**: Nicht wir fragen bei CCLI an, sondern ChurchTools – der zertifizierte Partner, mit
 * dem Abo der Gemeinde und der Sitzung des Nutzers. Gesprochen wird über die alte Schnittstelle
 * (`index.php?q=churchservice/ajax`); den Aufruf macht der Aufrufer (Server: `ctAjax`, Browser:
 * `ctAltAnfrage`), hier steht, was gefragt wird und wie die Antwort zu lesen ist.
 *
 * Gemessen und begründet in `docs/entwicklung/churchtools-songselect.md`.
 */
import type {
  SongSelectLiedtext,
  SongSelectSong,
  SongSelectSuchergebnis,
  SongSelectTreffer,
} from '../types/index';
import type { AjaxMeldungen, AltPort } from './altSchnittstelle';
import { notenblattSchreiben, type CtNotenSchreiber } from './notenblaetter';
import { arrangementAus } from './schreibKern';

/** Der Anschluss an ChurchTools – derselbe wie für jeden Aufruf der alten Schnittstelle. */
export type SongSelectPort = AltPort;

/**
 * Die SongSelect-Wortlaute. Getrennt von denen der Lied-Kategorien, weil ein Fehler beim Liedersuchen
 * etwas anderes ist. Wichtig ist die Trennung der letzten beiden: „ChurchTools antwortete nicht
 * lesbar" heißt, unser Vermittler klemmt; „Die Antwort von CCLI war nicht lesbar" die Gegenstelle.
 */
export const SS_MELDUNGEN: AjaxMeldungen = {
  verweigert: 'Keine Berechtigung für CCLI SongSelect in ChurchTools.',
  abgelehnt: 'ChurchTools hat die SongSelect-Anfrage abgelehnt',
  unlesbar: 'ChurchTools lieferte keine lesbare Antwort für SongSelect.',
  fehlgeschlagen: 'SongSelect-Anfrage fehlgeschlagen.',
  innenUnlesbar: 'Die Antwort von CCLI war nicht lesbar.',
};

/**
 * Ein SongSelect-Aufruf – **mit Blick auf den inneren Status von CCLI.**
 *
 * ChurchTools packt die Antwort von CCLI in seine eigene Hülle; innen steht `statusCode` (gemessen
 * 08.10.2026: `200`, `message: "Success"`). Meldet CCLI dort einen Fehler, sagt die Hülle trotzdem
 * „success" – ohne diesen Blick läse die App eine leere Trefferliste und zeigte „Keine Treffer", wo in
 * Wahrheit CCLI nicht geantwortet hat (Durchklick 08.10.2026: „Treu" ergab einmal nichts, gleich danach
 * 100 Treffer). Ein Erfolgssignal ist kein Beleg.
 */
async function ss(
  p: SongSelectPort,
  func: string,
  felder: Record<string, string>,
): Promise<unknown> {
  const antwort = await p.anfrage(func, felder, SS_MELDUNGEN);
  const innen = antwort as { statusCode?: unknown; message?: unknown } | null;
  if (typeof innen?.statusCode === 'number' && innen.statusCode >= 400) {
    const grund = typeof innen.message === 'string' && innen.message ? ` – ${innen.message}` : '';
    throw p.fehler(
      502,
      `SongSelect hat nicht geantwortet (CCLI ${innen.statusCode}${grund}). Bitte gleich noch einmal versuchen.`,
    );
  }
  return antwort;
}

/** Was CCLI je Format meldet: Gibt es das, und deckt die Lizenz der Gemeinde es ab? */
interface CtInhalt {
  exists?: boolean;
  isAuthorized?: boolean;
}

/**
 * **Verfügbar heißt: vorhanden UND lizenziert.** `exists` allein genügt nicht – ein Knopf für etwas,
 * das CCLI dann verweigert, führt ins Leere.
 */
function verfuegbar(i: CtInhalt | undefined): boolean {
  return i?.exists === true && i.isAuthorized === true;
}

/** Ein Treffer/Lied, wie CCLI es liefert – nur die Felder, die wir wirklich lesen. */
interface CtSongSelectRoh {
  songNumber?: number;
  title?: string;
  authors?: string[];
  copyrights?: string[];
  defaultKey?: string[];
  isPublicDomain?: boolean;
  content?: Record<string, CtInhalt>;
}

/**
 * Aus CCLIs Rohform unsere. **Bewusst nicht alles durchreichen:** Die Antwort enthält auch die
 * Konto-Nummer der Gemeinde bei CCLI, interne IDs und Links zur CCLI-API.
 */
function treffer(r: CtSongSelectRoh): SongSelectTreffer {
  return {
    songNumber: r.songNumber ?? 0,
    title: r.title ?? '',
    authors: r.authors ?? [],
    // `defaultKey` ist eine Liste und kann LEER sein (Lieder ohne hinterlegte Tonart, gemessen).
    defaultKey: r.defaultKey?.[0] ?? null,
    isPublicDomain: r.isPublicDomain === true,
    hasLyrics: verfuegbar(r.content?.lyrics),
    hasChordPro: verfuegbar(r.content?.chordPro),
    hasChordSheet: verfuegbar(r.content?.chordSheet),
  };
}

/**
 * Nach Titel suchen – ändert nichts. **Die Suche ist unscharf** („Wo ich auch stehe" ergab 147 Treffer);
 * ChurchTools holt 100 auf einmal, einen Weg zu weiteren Seiten gibt es nicht. `vollstaendig` sagt, ob
 * noch mehr da wären.
 */
export async function songSelectSuchen(
  p: SongSelectPort,
  songTitle: string,
): Promise<SongSelectSuchergebnis> {
  const titel = songTitle.trim();
  if (!titel) throw p.fehler(400, 'Bitte einen Titel eingeben.');
  const antwort = (await ss(p, 'getCCLISongsMatchingTitle', { songTitle: titel })) as {
    pagination?: { totalItems?: number };
    data?: { results?: CtSongSelectRoh[] };
  };
  const roh = antwort.data?.results ?? [];
  const gesamt = antwort.pagination?.totalItems ?? roh.length;
  return { treffer: roh.map(treffer), gesamt, vollstaendig: gesamt <= roh.length };
}

/** Ein Lied per CCLI-Nummer – samt **Copyright** (steht nur hier, nicht in der Trefferliste). */
export async function songSelectLied(
  p: SongSelectPort,
  songNumber: number,
): Promise<SongSelectSong> {
  const antwort = (await ss(p, 'getCCLISongData', { songNumber: String(songNumber) })) as {
    data?: CtSongSelectRoh;
  };
  const roh = antwort.data;
  if (!roh?.songNumber) {
    throw p.fehler(404, `Zur CCLI-Nummer ${songNumber} wurde nichts gefunden.`);
  }
  return { ...treffer(roh), copyright: roh.copyrights?.[0] ?? null };
}

/** So liefert CCLI den Liedtext – gemessen am 14.08.2026 (`probe-ccli-lyrics.ts`). */
interface CtLyricsRoh {
  songNumber?: number;
  title?: string;
  authors?: string[];
  copyrights?: string[];
  disclaimer?: string;
  lyricParts?: { partLabel?: string; lyrics?: string }[];
}

/**
 * Den **Liedtext** holen (#379) – für die Vorschau vor dem Anlegen. Der Text kommt strukturiert in
 * `lyricParts`. ⚠️ **`disclaimer` MUSS mit angezeigt werden** – eine Lizenzbedingung. Aufs Kontingent
 * zählt ein Textabruf laut CCLI nicht (Liedtexte sind unbegrenzt); ob er in der Nutzungs-Historie
 * erscheint, ist offen – deshalb ruft die Oberfläche ihn nur für bewusst geöffnete Treffer ab.
 */
export async function songSelectLiedtext(
  p: SongSelectPort,
  songNumber: number,
): Promise<SongSelectLiedtext> {
  const antwort = (await ss(p, 'getCCLILyrics', { songNumber: String(songNumber) })) as {
    data?: CtLyricsRoh;
  };
  const roh = antwort.data;
  if (!roh?.lyricParts) {
    throw p.fehler(404, `Zur CCLI-Nummer ${songNumber} liefert SongSelect keinen Liedtext.`);
  }
  return {
    songNumber: roh.songNumber ?? songNumber,
    title: roh.title ?? '',
    authors: roh.authors ?? [],
    copyright: roh.copyrights?.[0] ?? null,
    // Abschnitte ohne Text fallen weg – eine leere Überschrift hilft niemandem.
    teile: roh.lyricParts
      .filter((t) => (t.lyrics ?? '').trim() !== '')
      .map((t) => ({ label: (t.partLabel ?? '').trim(), text: (t.lyrics ?? '').trim() })),
    disclaimer: roh.disclaimer?.trim() ?? null,
  };
}

/**
 * Den ChordPro-**Text** bei CCLI holen. **Legt KEINE Datei an** (gemessen 11.08.2026): Der Aufruf
 * liefert nur den Text; die ChurchTools-Oberfläche lädt ihn danach selbst hoch. Ein `status: success`
 * ist kein Beleg dafür, dass etwas entstanden ist – deshalb: erst den Text in der Hand, dann selbst
 * hochladen, dann aufräumen. `tonality` bestimmt die Tonart, in der CCLI liefert.
 */
export async function songSelectChordPro(
  p: SongSelectPort,
  auftrag: { arrangementId: number; songNumber: number; title: string; tonality: string },
): Promise<string> {
  const antwort = (await ss(p, 'getCCLIChordPro', {
    songNumber: String(auftrag.songNumber),
    title: auftrag.title,
    tonality: auftrag.tonality,
    arrangementID: String(auftrag.arrangementId),
  })) as { data?: { chordPro?: unknown } };
  const text = antwort.data?.chordPro;
  // Leer heißt: nichts geholt. Dann darf hinterher auch nichts gelöscht werden.
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw p.fehler(502, 'CCLI hat kein Notenblatt geliefert.');
  }
  return text;
}

/**
 * Das Original-Notenblatt eines Arrangements aus SongSelect holen und **ersetzen** (#322, Schritt 9).
 *
 * **ERST holen, DANN das alte löschen.** Andersherum stünde das Lied ohne Notenblatt da, sobald der
 * Abruf bei CCLI scheitert. Das Ersetzen macht `notenblattSchreiben` – dieselbe Stelle wie der Editor.
 *
 * Die Tonart: die des ARRANGEMENTS, sonst die von CCLI vorgeschlagene. Ohne beides wird abgebrochen,
 * statt eine zu raten – ein Blatt in einer zufälligen Tonart merkt man erst beim Spielen.
 */
export async function notenblattAusSongSelect(
  s: CtNotenSchreiber,
  p: SongSelectPort,
  songId: number,
  arrangementId: number,
  songNumber: number,
) {
  const song = await s.song(songId);
  const arrangement = arrangementAus(song, arrangementId, (st, m) => s.fehler(st, m));
  const tonart = arrangement.keyOfArrangement ?? arrangement.key ?? null;
  const ausCcli = tonart ? null : await songSelectLied(p, songNumber);
  const tonality = tonart ?? ausCcli?.defaultKey ?? null;
  if (!tonality) {
    throw p.fehler(
      400,
      'Für dieses Arrangement ist keine Tonart hinterlegt, und CCLI schlägt keine vor. Bitte zuerst eine Tonart setzen.',
    );
  }
  const text = await songSelectChordPro(p, {
    arrangementId,
    songNumber,
    title: song.name,
    tonality,
  });
  return notenblattSchreiben(s, songId, arrangementId, text);
}
