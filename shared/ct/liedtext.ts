/**
 * Liedtext aus dem ChordPro des Originals – **für beide Auslieferungen** (#335, 3b-1).
 *
 * Lag bis dahin in `server/src/services/songTextIndex.ts`. Die ChurchTools-Extension braucht die
 * Liedtext-Vorschau beim Hinzufügen eines Lieds zum Ablauf ebenfalls – mit derselben Wahl der Datei
 * und derselben „nur mit Text"-Regel. Die Suche im Liedtext bleibt im Server (Massenlauf, Plan 3c).
 */
import { isOriginalChordpro } from './arrangementFiles';
import type { CtArrangementFile } from './typen';

/**
 * ChordPro auf reinen Text reduzieren – **das ist die Regel, auf die es bei der Suche ankommt.**
 *
 * `[Am]` mitten in einem Wort ist der Grund: „ge[Am]liebt" muss bei der Suche nach „geliebt" gefunden
 * werden. Würde man Akkorde nur durch Leerzeichen ersetzen, entstünde „ge liebt" – und der Treffer
 * bliebe aus. Deshalb fallen sie **ersatzlos** weg.
 *
 * Direktiven (`{title: …}`, `{comment: …}`) fliegen ganz heraus: Der Titel wird ohnehin schon in der
 * Liste durchsucht, und Kommentare wie „2× spielen" sind kein Liedtext.
 */
export function chordproZuLesetext(chordpro: string): string {
  return chordpro
    .replace(/\{[^}]*\}/g, ' ') // Direktiven samt Inhalt
    .replace(/\[[^\]]*\]/g, '') // Akkorde ERSATZLOS – sonst zerfallen Wörter
    .replace(/\s+/g, ' ')
    .trim();
}

/** Was es braucht, um die Original-Datei zu finden – Listen-Eintrag und einzelnes Lied haben es. */
interface MitDateien {
  arrangements?: { files?: CtArrangementFile[] }[];
}

/**
 * Die Datei, aus der Suchtext und Vorschau kommen: das **Original**-ChordPro des Liedes.
 *
 * **Nutzt `isOriginalChordpro` und baut die Regel nicht nach** (#379). Vorher stand hier ein eigenes
 * `!/\(App\)\.chordpro$/i` – das erkannte nur den heutigen Marker. Bestandsdateien mit den älteren
 * Kürzeln (`— <Name> (ECG).chordpro`, `— Bearbeitet.chordpro`) gingen damit als Original durch.
 *
 * **Die Folge, genau benannt:** Gesucht wird mit `.find()`, es gewinnt also die **erste** passende Datei.
 * Steht eine solche Bestandsfassung in der ChurchTools-Antwort **vor** dem Original, wurde der
 * **bearbeitete** Text indexiert statt des echten – die Suche fand dann die falsche Fassung, und die
 * Vorschau zeigte sie. (Nicht: „das Lied stand doppelt drin" – `find` liefert nur eine Datei. Diese
 * erste Diagnose war falsch und wäre unbemerkt geblieben, hätte die Gegenprobe sie nicht widerlegt.)
 */
export function originalChordpro(song: MitDateien): CtArrangementFile | undefined {
  return song.arrangements?.flatMap((a) => a.files ?? []).find(isOriginalChordpro);
}

/**
 * Die Liedtext-Vorschau eines Lieds: das rohe Original-ChordPro – oder `null`, wenn es keines gibt
 * oder es keinen Text enthält. Eine Datei aus lauter Direktiven ist kein Liedtext; die Oberfläche
 * sagt dann „kein Liedtext" statt eine leere Vorschau zu zeigen.
 */
export async function liedtextVorschauAus(
  song: MitDateien | undefined,
  dateiText: (fileUrl: string) => Promise<string>,
): Promise<string | null> {
  const datei = song ? originalChordpro(song) : undefined;
  if (!datei) return null;
  const chordpro = await dateiText(datei.fileUrl);
  return chordproZuLesetext(chordpro) ? chordpro : null;
}
