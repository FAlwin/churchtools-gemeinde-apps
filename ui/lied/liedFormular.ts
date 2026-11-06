/**
 * Die Regeln der Lied-Formulare – **anlegen (#322, Schritt 10b) und ändern (Schritt 11)**, rein und
 * damit prüfbar.
 *
 * Warum hier und nicht in den Komponenten: Es sind Entscheidungen, nicht Darstellung. Was ein Doppel
 * ist, wann der Knopf freigibt, was aus dem CCLI-Treffer übernommen wird und **was als Änderung gilt** –
 * genau das sind die Stellen, an denen später eine Korrektur landet. In einer Komponente ließe sich das
 * nur über gerenderte Oberfläche prüfen; hier direkt.
 *
 * **Beide Formulare teilen diese Datei mit Absicht.** Sie zeigen dieselben Felder; zwei Regelsätze
 * nebeneinander wären zwei Stellen, an denen dieselbe Korrektur landen müsste – und die zweite wird
 * vergessen.
 *
 * **Was hier NICHT steht:** die Blockade gegen eine doppelte CCLI-Nummer und die Rechteprüfung. Beides
 * **entscheidet der Server** (`songVerwaltung.ts`) – eine Prüfung, die nur in der Oberfläche steht,
 * umgeht jeder, der den Endpunkt direkt aufruft.
 *
 * Seit dem 20.09.2026 (#395) sucht `vorhandenesLied` hier trotzdem nach der Nummer – **nicht um zu
 * blockieren, sondern um zu fragen**: Der Server lehnt ein Doppel mit einer Fehlermeldung ab, und eine
 * Fehlermeldung ist eine Sackgasse. Die App stellt stattdessen die Frage, die dahintersteht: das
 * vorhandene Lied nehmen oder doch ein zweites anlegen? Die Regel selbst (`ccliSchluessel`) liegt in
 * `@shared/lieder` – eine Quelle für beide Seiten.
 */
import type {
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
  SongLibraryEntry,
  SongSelectSong,
  SongSelectTreffer,
} from '@shared/types/index';
import { LIED_GRENZEN } from '@shared/types/index';
import { ccliSchluessel } from '@shared/lieder/index';

/** Der Stand des Formulars – alle Felder als Text, so wie sie in den Eingabefeldern stehen. */
export interface NeuesLiedFormular {
  name: string;
  /** `null` = noch keine gewählt. Kategorie **0** ist echt, deshalb nicht `0` als „leer". */
  categoryId: number | null;
  author: string;
  ccli: string;
  copyright: string;
  key: string;
  /** Leer = „Standard" (das benennt der Server, nicht das Formular). */
  arrangementName: string;
}

/** Ein leeres Formular. Die Kategorie bleibt bewusst offen (Entscheidung Alwin, 13.08.2026). */
export const LEERES_FORMULAR: NeuesLiedFormular = {
  name: '',
  categoryId: null,
  author: '',
  ccli: '',
  copyright: '',
  key: '',
  arrangementName: '',
};

/**
 * Übernimmt einen CCLI-Treffer ins Formular – **ohne die Kategorie zu berühren.**
 *
 * Die Kategorie ist Pflichtfeld ohne Vorbelegung; hätte ein Treffer sie gesetzt, wäre die Entscheidung
 * dem Nutzer aus der Hand genommen. Eine bereits gewählte Kategorie bleibt deshalb stehen, wenn man
 * einen anderen Treffer anklickt.
 *
 * `copyright` kennt nur die Einzelabfrage (`SongSelectSong`); bei einem Treffer aus der Liste bleibt
 * das Feld leer, statt mit einem Platzhalter zu füllen.
 */
export function formularAusTreffer(
  treffer: SongSelectTreffer | SongSelectSong,
  bisher: NeuesLiedFormular = LEERES_FORMULAR,
): NeuesLiedFormular {
  return {
    ...bisher,
    name: treffer.title,
    author: treffer.authors.join(', '),
    ccli: String(treffer.songNumber),
    copyright: 'copyright' in treffer ? (treffer.copyright ?? '') : '',
    key: treffer.defaultKey ?? '',
  };
}

/**
 * Ist das Formular vollständig genug zum Absenden?
 *
 * Nur die beiden **Pflichtangaben**: ein Name mit Mindestlänge und eine gewählte Kategorie. Die
 * Längen-Obergrenzen prüft das Formular nicht nach – die Eingabefelder begrenzen sie über
 * `LIED_GRENZEN`, und der Server lehnt ab, was trotzdem zu lang ankommt.
 */
export function formularBereit(f: NeuesLiedFormular): boolean {
  return f.name.trim().length >= LIED_GRENZEN.name.min && f.categoryId !== null;
}

/**
 * Warnt, wenn schon ein Lied so heißt – **warnt nur, blockiert nicht** (Entscheidung Alwin,
 * 13.08.2026).
 *
 * Gleiche Namen sind bei Liedern normal: verschiedene Fassungen, Übersetzungen, ein deutscher und ein
 * englischer Text. Blockiert wird nur die gleiche **CCLI-Nummer**, und das macht der Server.
 *
 * Verglichen wird getrimmt und ohne Groß-/Kleinschreibung, weil „Treu" und „treu " dasselbe Lied
 * meinen. `null`, solange der Name zu kurz zum Vergleichen ist.
 */
export function namensWarnung(
  name: string,
  songs: SongLibraryEntry[],
  eigenesLied?: number,
): string | null {
  const gesucht = name.trim().toLocaleLowerCase('de-DE');
  if (gesucht.length < LIED_GRENZEN.name.min) return null;

  const treffer = songs.filter(
    (s) => s.name.trim().toLocaleLowerCase('de-DE') === gesucht && s.songId !== eigenesLied,
  );
  if (treffer.length === 0) return null;

  return treffer.length === 1
    ? `„${treffer[0].name}" gibt es schon. Anlegen geht trotzdem – gemeint ist dann ein zweites, eigenes Lied.`
    : `${treffer.length} Lieder heißen schon so. Anlegen geht trotzdem – gemeint ist dann ein weiteres, eigenes Lied.`;
}

/**
 * **Gibt es dieses Lied schon?** Gesucht wird über die **CCLI-Nummer** – sie ist die einzige Angabe,
 * die ein Lied eindeutig macht (#395, Wunsch Alwin am 19.09.2026: „dann muss man entscheiden, was man
 * macht"). Gleiche Namen sagen nichts: Übersetzungen und Fassungen heißen normal gleich, dafür gibt es
 * `namensWarnung`.
 *
 * `null`, wenn keine Nummer im Formular steht oder keine passt.
 *
 * **Diese Suche ist bewusst schwächer als die des Servers** und darf es sein: Sie läuft über die
 * Bibliothek, und die enthält nur Lieder **mit** Arrangement (der Server sieht über `getAllSongs` auch
 * die ohne). Beides ist richtig so – anbieten lässt sich ohnehin nur ein Lied mit Arrangement, und
 * findet die App nichts, lehnt der Server wie bisher mit seiner Meldung ab. Die App nimmt dem Server
 * nichts ab, sie kommt ihm nur zuvor.
 */
export function vorhandenesLied(
  ccli: string,
  songs: SongLibraryEntry[],
  eigenesLied?: number,
): SongLibraryEntry | null {
  const nummer = ccliSchluessel(ccli);
  if (!nummer) return null;
  return songs.find((s) => ccliSchluessel(s.ccli) === nummer && s.songId !== eigenesLied) ?? null;
}

/**
 * Baut den Auftrag für den Server – **leere Felder werden weggelassen, nicht als `""` gesendet.**
 *
 * Der Grund steht in `createSong`: ChurchTools soll seine Vorgaben behalten, statt sie mit einer
 * leeren Zeichenkette zu überschreiben.
 *
 * `categoryId` ist hier Pflicht; dass sie gewählt ist, stellt `formularBereit` sicher – deshalb nimmt
 * diese Funktion sie als Zahl und nicht als „vielleicht null" (ein `?? 0` wäre stillschweigend die
 * Kategorie „Aktive Songs" gewesen).
 */
export function auftragAus(f: NeuesLiedFormular, categoryId: number): LiedAnlegenAuftrag {
  const auftrag: LiedAnlegenAuftrag = { name: f.name.trim(), categoryId };
  if (f.author.trim()) auftrag.author = f.author.trim();
  if (f.ccli.trim()) auftrag.ccli = f.ccli.trim();
  if (f.copyright.trim()) auftrag.copyright = f.copyright.trim();
  if (f.key.trim()) auftrag.key = f.key.trim();
  if (f.arrangementName.trim()) auftrag.arrangementName = f.arrangementName.trim();
  return auftrag;
}

/**
 * Soll nach dem Anlegen das Notenblatt aus SongSelect geholt werden? (#322)
 *
 * **Automatisch, weil bei einem neuen Lied nichts überschrieben werden kann** (Entscheidung Alwin,
 * 13.08.2026): Das Arrangement ist gerade entstanden und hat kein ChordPro – der Grund, warum der
 * Knopf in der Dateiverwaltung nur ohne Notenblatt erscheint, greift hier also nicht. Und der Download
 * ist nicht idempotent: Ein zweiter Aufruf legte eine zweite gleichnamige Datei an.
 *
 * Drei Antworten, und die dritte ist der Grund für diese Funktion:
 *  - `{ songNumber }` – holen,
 *  - `null` – nichts zu holen und nichts zu sagen (keine Nummer oder keine SongSelect-Lizenz),
 *  - `{ grund }` – **nicht holen, aber sagen warum.** Wenn CCLI für dieses Lied gar keine Akkorde hat,
 *    wäre der Aufruf ein sicherer Fehlschlag; dann ist ein ruhiger Satz besser als eine Fehlermeldung.
 *
 * **Ohne Nummer im Formular zählt die des Treffers** (#395, 20.09.2026). Das ist der Fall „Trotzdem neu
 * anlegen": Wer ein zweites Lied neben einem vorhandenen will, muss die CCLI-Nummer abgeben – die
 * Akkorde will er trotzdem. Er hat den SongSelect-Treffer schließlich selbst ausgesucht.
 */
export function notenblattPlan(
  f: NeuesLiedFormular,
  treffer: SongSelectTreffer | null,
  canUseCcli: boolean,
): { songNumber: number } | { grund: string } | null {
  const eingetippt = Number(f.ccli.trim());
  const nummer =
    Number.isInteger(eingetippt) && eingetippt > 0 ? eingetippt : (treffer?.songNumber ?? 0);
  if (!canUseCcli || !Number.isInteger(nummer) || nummer <= 0) return null;

  // Nur wenn der Treffer zur eingetippten Nummer gehört, wissen wir etwas über die Formate. Wer die
  // Nummer selbst eingibt, bekommt einen Versuch – ein Fehlschlag kostet nur einen Hinweis.
  if (treffer && treffer.songNumber === nummer && !treffer.hasChordPro) {
    return {
      grund: treffer.hasChordSheet
        ? 'SongSelect hat für dieses Lied keine Akkorde als ChordPro, nur ein PDF – das Notenblatt musst du in ChurchTools hochladen.'
        : 'SongSelect hat für dieses Lied keine Akkorde – das Notenblatt musst du selbst hinzufügen.',
    };
  }
  return { songNumber: nummer };
}

/* ══════════════════════════════════════ Stammdaten ändern (#322, Schritt 11) ══════════════════ */

/**
 * Füllt das Formular aus den gelesenen Stammdaten.
 *
 * `null` wird zu `''` – im Eingabefeld gibt es kein „nicht gesetzt", nur leer. Die Rückrichtung
 * (`aenderungAus`) macht daraus wieder eine Leerung.
 *
 * `key` und `arrangementName` bleiben leer: Sie gehören zum **Arrangement**, nicht zum Lied. Beim
 * Ändern der Stammdaten haben sie deshalb nichts zu suchen – die Tonart eines vorhandenen
 * Arrangements ändert man in ChurchTools oder über die Transposition der App.
 */
export function formularAusLied(lied: LiedStammdatenAnsicht): NeuesLiedFormular {
  return {
    ...LEERES_FORMULAR,
    name: lied.name,
    categoryId: lied.categoryId,
    author: lied.author ?? '',
    ccli: lied.ccli ?? '',
    copyright: lied.copyright ?? '',
  };
}

/**
 * Was sich gegenüber dem gelesenen Stand geändert hat – **nur das wird geschickt.**
 *
 * Drei Zustände, und die Unterscheidung ist der Grund für diese Funktion:
 *  - Feld **fehlt** im Ergebnis = unverändert (der Server behält den Ist-Wert),
 *  - Feld mit **Text** = neuer Wert,
 *  - Feld mit **`''`** = ausdrücklich leeren.
 *
 * Der Server baut daraus einen vollständigen Payload (`songWritePayload`) – nötig, weil ein Teil-`PUT`
 * in ChurchTools die nicht gesendeten Felder löscht (gemessen). Diese Funktion beschreibt also die
 * **Absicht**, nicht den Payload.
 *
 * Ein leeres Ergebnis heißt: Es gibt nichts zu speichern. Die Oberfläche sperrt dann den Knopf, statt
 * einen Schreibvorgang für nichts auszulösen.
 */
export function aenderungAus(
  f: NeuesLiedFormular,
  ist: LiedStammdatenAnsicht,
): Partial<LiedStammdaten> {
  const aenderung: Partial<LiedStammdaten> = {};

  if (f.name.trim() !== ist.name) aenderung.name = f.name.trim();
  if (f.categoryId !== null && f.categoryId !== ist.categoryId) aenderung.categoryId = f.categoryId;

  // Die drei freiwilligen Textfelder: `''` im Formular und `null` im Bestand sind dasselbe – daraus
  // darf keine Änderung entstehen, sonst wäre der Speichern-Knopf immer aktiv.
  for (const feld of ['author', 'ccli', 'copyright'] as const) {
    const neu = f[feld].trim();
    if (neu !== (ist[feld] ?? '')) aenderung[feld] = neu;
  }

  return aenderung;
}

/** Gibt es überhaupt etwas zu speichern? (Leere Änderung = Knopf bleibt gesperrt.) */
export function hatAenderung(f: NeuesLiedFormular, ist: LiedStammdatenAnsicht): boolean {
  return Object.keys(aenderungAus(f, ist)).length > 0;
}

/**
 * Startgerüst für ein Lied, zu dem es noch keinen ChordPro-Text gibt.
 *
 * **Eine Vorlage, zwei Aufrufer** (04.09.2026): das Blatt (`buildEditorTemplate`) und der Editor direkt
 * nach dem Anlegen (`NewSongSheet`). Vorher stand das Gerüst hier fest verdrahtet an ein `SetlistSong`;
 * das neue Lied hat noch keins – nur Titel, Tonart und ggf. CCLI-Nummer aus dem Formular.
 */
export function chordproVorlage(lied: {
  title: string;
  key?: string | null;
  ccli?: string | null;
}): string {
  const key = lied.key || 'C';
  const kopf = [
    `{title: ${lied.title}}`,
    `{key: ${key}}`,
    lied.ccli ? `{ccli: ${lied.ccli}}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  return `${kopf}\n\n{comment: Vers 1}\n[${key}]Hier Text mit Akkorden eingeben\n\n{comment: Chorus}\n`;
}
