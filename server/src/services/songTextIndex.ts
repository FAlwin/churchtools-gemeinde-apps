/**
 * **Suche im Liedtext** (#322, Wunsch Alwin: „wenn man nicht genau den Titel kennt").
 *
 * **Warum das ein Index sein muss – gemessen, nicht vermutet (13.08.2026, `probe-songsuche.ts`):**
 *
 *  - **ChurchTools kann es nicht.** `/api/songs?query=…` filtert nur Stammdaten: Ein Wort aus dem
 *    Liedtext ergab **0** Treffer, dasselbe Wort aus dem Titel **1** (Gegenprobe). Die Liedtexte liegen
 *    dort als **Datei** am Arrangement, nicht als Feld.
 *  - **CCLI kann es auch nicht** – acht naheliegende Funktionsnamen für eine Textsuche existieren nicht
 *    (`getCCLILyrics` gibt es, holt aber nur den Text zu EINER Nummer).
 *
 * Bleibt: **wir suchen selbst.** Dafür wird jeder Liedtext einmal geladen und im Speicher gehalten.
 *
 * **Der teure Teil ist der Aufbau: ein Datei-Download je Lied** (~50 bei der ECG). Genau diese Sorte
 * Lauf hat in #300 das ChurchTools-Limit gerissen, deshalb drei Vorkehrungen – dieselben wie bei der
 * Song-Statistik, aus demselben Baustein:
 *
 *  1. **gebündelt** – fünf iPads, die gleichzeitig suchen, lösen EINEN Aufbau aus,
 *  2. **gedrosselt** – höchstens 6 Downloads gleichzeitig, und bei einer Drosselung sofort Schluss,
 *  3. **gecacht** – eine Stunde; danach wird beim nächsten Suchen neu gebaut.
 *
 * **Der Index hält nur, was zum Suchen nötig ist:** kleingeschriebenen Text ohne Akkorde und ohne
 * ChordPro-Direktiven. Er ist **einer für die ganze Gemeinde** – Liedtexte sind für alle dieselben.
 *
 * **Aber nicht jeder darf jedes Lied sehen (#458).** In ChurchTools hängt das Lied-Recht an Kategorien
 * (z. B. „Inaktive Songs" nur für Musiker). Deshalb gilt zweierlei:
 *
 *  - **Treffer und Vorschau nur aus der EIGENEN Liederliste** – die liefert ChurchTools mit dem Cookie
 *    der fragenden Person, gemerkt je Sitzung (`sichtbareLiederMemo`). Wir bauen die Rechte-Regel nicht
 *    nach; ChurchTools entscheidet. Vorher bekam jede angemeldete Person Texte aller Lieder.
 *  - **Der Index wächst um das, was jemand sieht und er noch nicht kennt.** Gebaut wird mit dem Cookie
 *    der ersten Person – sah die nur einen Teil (ein Mitglied mit Liederbuch), fehlten den Musikern
 *    eine Stunde lang Lieder. Jetzt werden fehlende Lieder nachgeladen, nicht der ganze Index neu.
 */
import { LIEDTEXT_SUCHE_MIN_ZEICHEN, type SongTextTreffer } from '@shared/types/index';
import { CtOverloadedError, isCtOverloaded } from './ctHttp.js';
import { downloadFileText } from './ctFiles.js';
import { getAllSongs } from './ctRead.js';
import { sichtbareLiederMemo } from './ctSessionMemos.js';
import type { CtSongListEntry } from '@shared/ct/typen';
import { createGebuendelterLauf } from './gebuendelterLauf.js';
import { mapLimit } from './mapLimit.js';
import { chordproZuLesetext, liedtextVorschauAus, originalChordpro } from '@shared/ct/liedtext';

/** Wie lange ein aufgebauter Index gilt. Liedtexte ändern sich selten; eine Stunde ist reichlich. */
const INDEX_TTL_MS = 3_600_000;
/** Sperrfrist nach einer Drosselung – wie bei der Statistik. */
const INDEX_COOLDOWN_MS = 120_000;
/** Gleichzeitige Datei-Downloads – Dateien sind schwer, deshalb wenige. */
const PARALLEL = 6;

interface IndexEintrag {
  songId: number;
  name: string;
  /** Kleingeschrieben, ohne Akkorde und Direktiven – nur zum Suchen. */
  text: string;
  /**
   * Das **rohe ChordPro** des Original-Notenblatts (#379, seit 04.09.2026 statt eines gekürzten Anfangs).
   *
   * Getrennt von `text`, weil beide verschiedene Aufgaben haben: `text` ist zum **Suchen** gebaut
   * (kleingeschrieben, ohne Akkorde), das ChordPro für die **Vorschau** – der Client zerlegt es mit
   * demselben Parser wie das Blatt in Abschnitte (Vers, Chorus). Alwin: „Manchmal braucht man genau den
   * Chorus, um auf das Lied zu kommen." Bei ~50 Liedern sind das ein paar hundert Kilobyte – deutlich
   * billiger, als für eine Vorschau eine Datei zu laden, die schon einmal durch die Leitung ging.
   */
  chordpro: string;
}

interface IndexStand {
  /** Wann der Index zuletzt VOLLSTÄNDIG gebaut wurde – ein Nachladen verlängert die Stunde nicht. */
  at: number;
  eintraege: IndexEintrag[];
  /** Welche Lieder schon angesehen wurden – mit oder ohne Text. Was hier fehlt, wird nachgeladen. */
  abgedeckt: ReadonlySet<number>;
}

let index: IndexStand | null = null;
const indexLauf = createGebuendelterLauf<IndexStand>(INDEX_COOLDOWN_MS);

/** Nur für Tests: Index, laufenden Aufbau und Sperrfrist zurücksetzen. */
export function __resetSongTextIndexForTests(): void {
  index = null;
  indexLauf.reset();
}

// `chordproZuLesetext` und `originalChordpro` liegen seit #335 (3b-1) in `@shared/ct/liedtext` – die
// Extension zeigt die Liedtext-Vorschau mit derselben Regel. Hier bleibt die Suche (Massenlauf, 3c).
export { chordproZuLesetext };

/**
 * Die **Vergleichsform** – sie muss für den Index UND für den Suchbegriff dieselbe sein.
 *
 * Deshalb steht sie hier und nicht als `toLocaleLowerCase` an drei Stellen: Gesucht wird mit
 * `text.includes(gesucht)`. Würde eine der beiden Seiten anders normalisiert – etwa weil jemand später
 * Umlaute oder Bindestriche mit einbezieht –, **fände die Suche schlicht nichts mehr**, ohne Fehler und
 * ohne Hinweis. Genau diese Sorte stiller Bruch entsteht, wenn eine Regel zweimal existiert.
 */
export function zuSuchform(text: string): string {
  return text.toLocaleLowerCase('de-DE');
}

/**
 * Derselbe Text, in der Suchform – die Form, in der gesucht wird.
 *
 * Baut bewusst auf `chordproZuLesetext` auf, statt die Ersetzungen zu wiederholen: Die Regel „Akkorde
 * ersatzlos" gibt es damit **einmal**. Zwei Fassungen wären zwei Stellen, an denen die nächste Korrektur
 * landen müsste – und die zweite wird vergessen.
 */
export function chordproZuText(chordpro: string): string {
  return zuSuchform(chordproZuLesetext(chordpro));
}

/**
 * Einen Textausschnitt um den Treffer bauen – damit man **sieht**, warum ein Lied gefunden wurde.
 *
 * Ohne ihn müsste man jedes Lied öffnen, um zu prüfen, ob es das gesuchte ist. Der Ausschnitt kommt aus
 * dem bereits kleingeschriebenen Suchtext; das ist ehrlich („so wurde gesucht") und spart, den
 * Originaltext zusätzlich im Speicher zu halten.
 */
export function ausschnitt(text: string, treffer: string, laenge = 90): string {
  const pos = text.indexOf(treffer);
  if (pos < 0) return '';
  const von = Math.max(0, pos - Math.floor((laenge - treffer.length) / 2));
  const bis = Math.min(text.length, von + laenge);
  return (von > 0 ? '… ' : '') + text.slice(von, bis).trim() + (bis < text.length ? ' …' : '');
}

type Lied = CtSongListEntry;

/**
 * Die Liederliste, die ChurchTools DIESER Person zeigt – gemerkt je Sitzung (#458).
 *
 * Kostet eine Anfrage je 100 Lieder, höchstens alle fünf Minuten je Person. Billiger lässt sich die
 * Frage „darf sie dieses Lied sehen?" nicht ehrlich beantworten – die Kategorie-Rechte nachzubauen
 * wäre eine zweite Fassung einer Regel, die ChurchTools schon hat.
 */
async function sichtbareLieder(cookie: string): Promise<Lied[]> {
  const gemerkt = sichtbareLiederMemo.get(cookie);
  if (gemerkt) return gemerkt;
  const lieder = await getAllSongs(cookie);
  sichtbareLiederMemo.set(cookie, lieder);
  return lieder;
}

/** Für diese Lieder das Original-ChordPro laden und auf Suchtext reduzieren. */
async function ladeTexte(
  cookie: string,
  songs: Lied[],
): Promise<{
  eintraege: IndexEintrag[];
  abgedeckt: number[];
  ohneText: number;
  gedrosselt: boolean;
}> {
  const eintraege: IndexEintrag[] = [];
  const abgedeckt: number[] = [];
  let gedrosselt = false;
  let ohneText = 0;

  await mapLimit(songs, PARALLEL, async (song) => {
    // Notbremse: Sobald ChurchTools gebremst hat, keine weiteren Downloads mehr starten (#300).
    if (gedrosselt) return;
    const datei = originalChordpro(song);
    if (!datei) {
      ohneText++;
      abgedeckt.push(song.id);
      return;
    }
    try {
      // Einmal aufbereiten, zweimal genutzt: Suchtext und Vorschau (lesbar) aus demselben Lauf.
      // Die Kleinschreibung läuft über `zuSuchform` – dieselbe Funktion, die auch den Suchbegriff
      // normalisiert. Zwei Fassungen davon würden die Suche still ins Leere laufen lassen.
      const chordpro = await downloadFileText(cookie, datei.fileUrl);
      const lesetext = chordproZuLesetext(chordpro);
      const text = zuSuchform(lesetext);
      if (text) {
        eintraege.push({
          songId: song.id,
          name: song.name,
          text,
          chordpro,
        });
      } else ohneText++;
      abgedeckt.push(song.id);
    } catch (e) {
      if (isCtOverloaded(e)) {
        gedrosselt = true;
        return;
      }
      // Ein einzelnes nicht ladbares Notenblatt darf den Index nicht verhindern – das Lied fehlt dann
      // nur in der Textsuche und bleibt über den Titel weiter findbar.
      ohneText++;
      abgedeckt.push(song.id);
    }
  });
  return { eintraege, abgedeckt, ohneText, gedrosselt };
}

/** Nach einer Drosselung: Sperrfrist beginnen und im Log festhalten. */
function nachDrosselung(was: string, started: number): void {
  indexLauf.sperren();
  console.warn(
    `[songTextIndex] ${was} ABGEBROCHEN (ChurchTools drosselt) nach ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s; Sperrfrist ` +
      `${Math.round(INDEX_COOLDOWN_MS / 1000)} s`,
  );
}

/** Baut den Index neu – aus den Liedern, die die auslösende Person sieht. */
async function baueIndex(cookie: string, songs: Lied[]): Promise<IndexStand> {
  const started = Date.now();
  const r = await ladeTexte(cookie, songs);

  if (r.gedrosselt) {
    nachDrosselung('Aufbau', started);
    // Ein halber Index wäre schlimmer als keiner: Er würde eine Stunde lang Lieder verschweigen und
    // dabei aussehen wie ein vollständiges Ergebnis.
    if (index) return index;
    throw new CtOverloadedError(INDEX_COOLDOWN_MS);
  }

  index = { at: Date.now(), eintraege: r.eintraege, abgedeckt: new Set(r.abgedeckt) };
  indexLauf.entsperren();
  console.warn(
    `[songTextIndex] Aufbau beendet: ${r.eintraege.length} Lieder mit Text, ${r.ohneText} ohne, ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  return index;
}

/**
 * Nur die Lieder nachladen, die der Index noch nicht kennt (#458) – statt alles neu zu bauen.
 *
 * Hier darf auch ein Teil hinein: Jedes nachgeladene Lied steht in `abgedeckt`, der Rest wird beim
 * nächsten Suchen erneut versucht. Anders als beim Aufbau verschweigt das nichts, was vorher da war.
 */
async function ergaenzeIndex(
  cookie: string,
  stand: IndexStand,
  fehlend: Lied[],
): Promise<IndexStand> {
  const started = Date.now();
  const r = await ladeTexte(cookie, fehlend);
  index = {
    at: stand.at,
    eintraege: [...stand.eintraege, ...r.eintraege],
    abgedeckt: new Set([...stand.abgedeckt, ...r.abgedeckt]),
  };
  if (r.gedrosselt) nachDrosselung('Nachladen', started);
  return index;
}

/**
 * Den Index besorgen, der für diese Person taugt: frisch, und mit allen Liedern, die sie sieht.
 *
 * **Während einer Drosselung wird weder gebaut noch nachgeladen** (#456). Liegt ein älterer Index vor,
 * ist der die bessere Antwort als ein Fehler – Liedtexte ändern sich selten. Vorher fiel dieser Fall
 * durch zum Neubau, denn `fuehreAus` prüft die Sperre nicht: Jede Suche in der Sperrfrist startete
 * einen Lauf und verlängerte die Drosselung – das Muster aus #300. Liegt keiner vor, muss die
 * Oberfläche erfahren, dass sie kurz warten soll: „nichts gefunden" und „konnte nicht suchen" sind
 * zwei verschiedene Aussagen (#270).
 */
async function indexFuer(cookie: string, sichtbar: Lied[]): Promise<IndexStand> {
  // Zweimal: Hängt sich ein Aufruf an das Nachladen eines anderen, sind seine Lieder danach evtl.
  // noch nicht dabei – dann einmal selbst nachladen. Mehr nicht, sonst droht eine Schleife.
  for (let versuch = 0; versuch < 2; versuch++) {
    const vorhanden = index;
    const frisch = vorhanden !== null && Date.now() - vorhanden.at < INDEX_TTL_MS;
    if (indexLauf.istGesperrt()) {
      if (vorhanden === null) throw new CtOverloadedError(indexLauf.restMs());
      return vorhanden;
    }
    if (!frisch) return indexLauf.fuehreAus(() => baueIndex(cookie, sichtbar));
    const fehlend = sichtbar.filter((l) => !vorhanden.abgedeckt.has(l.id));
    if (fehlend.length === 0) return vorhanden;
    await indexLauf.fuehreAus(() => ergaenzeIndex(cookie, vorhanden, fehlend));
  }
  // `index` ist hier gesetzt: Jeder Weg oben, der nicht zurückkehrt, hat ihn gebaut oder ergänzt.
  return index as IndexStand;
}

/**
 * Sucht `begriff` in den Liedtexten (#322).
 *
 * Beim ersten Aufruf (und nach einer Stunde) wird der Index gebaut – das dauert, und **die Oberfläche
 * sagt das**, statt so zu tun, als wäre Suchen immer gleich schnell.
 */
export async function sucheImLiedtext(cookie: string, begriff: string): Promise<SongTextTreffer[]> {
  // Dieselbe Vergleichsform wie der Index – siehe `zuSuchform`.
  const gesucht = zuSuchform(begriff.trim());
  if (gesucht.length < LIEDTEXT_SUCHE_MIN_ZEICHEN) return [];

  const sichtbar = await sichtbareLieder(cookie);
  const darf = new Set(sichtbar.map((l) => l.id));
  const { eintraege } = await indexFuer(cookie, sichtbar);

  return eintraege
    .filter((e) => darf.has(e.songId) && e.text.includes(gesucht))
    .map((e) => ({ songId: e.songId, name: e.name, ausschnitt: ausschnitt(e.text, gesucht) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
}

/**
 * Der Anfang eines Liedtexts zum Nachlesen (#379) – **auf Verlangen, für EIN Lied.**
 *
 * Anlass (Alwin, 13.08.2026): Heißen mehrere Lieder gleich und ist der Autor unbekannt, entscheidet nur
 * ein Blick in den Text. Ausgelöst wird das je Lied, nicht für die Liste.
 *
 * **Der Index wird dafür nie gebaut, nur benutzt** – das ist der ganze Trick:
 *
 *  - Steht er frisch (weil gerade in Liedtexten gesucht wurde), kostet die Vorschau **keine** Anfrage.
 *  - Steht er nicht, wird **genau dieses eine** Notenblatt geladen. Ein Index-Aufbau (~50 Downloads)
 *    nur für zwei Zeilen wäre grob unverhältnismäßig – und genau die Sorte Last, die in #300 das
 *    ChurchTools-Limit gerissen hat.
 *
 * `null` heißt „dieses Lied hat keinen Text" – die Oberfläche zeigt dann **keine** leere Vorschau.
 */
export async function liedtextVorschau(cookie: string, songId: number): Promise<string | null> {
  // Erst die eigene Liederliste (#458): Ein Lied, das ChurchTools dieser Person nicht zeigt, hat für
  // sie keine Vorschau – auch wenn es im Index steht, den jemand anderes aufgebaut hat.
  const song = (await sichtbareLieder(cookie)).find((s) => s.id === songId);
  if (!song) return null;

  const vorhanden = index;
  if (vorhanden !== null && Date.now() - vorhanden.at < INDEX_TTL_MS) {
    const treffer = vorhanden.eintraege.find((e) => e.songId === songId);
    // Nur wenn das Lied im Index steht. Fehlt es dort, hat es beim Aufbau keinen Text gehabt – dann
    // lohnt der Versuch unten trotzdem, denn seitdem kann eines hinzugekommen sein.
    if (treffer) return treffer.chordpro;
  }

  return liedtextVorschauAus(song, (url) => downloadFileText(cookie, url));
}
