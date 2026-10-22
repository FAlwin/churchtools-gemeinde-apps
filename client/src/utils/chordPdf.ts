import { jsPDF } from 'jspdf';
import { parseChordPro, parseLine, parseMetadata, teileImFlow } from './chordpro';
import { transposeChord } from './transpose';
import type { SetlistSong } from '@shared/types/index';
import type { Abbildung, Satzplan, Stueck } from './rollenAbbildung';
import { MARGIN, PAGE_H, PAGE_W, spaltenBreite, spaltenX } from './blattMasse';

/** Optionen für die PDF-Erzeugung aus ChordPro (Issue: PDF-Export). */
export interface ChordPdfOptions {
  /** Halbton-Versatz (Transponieren + Kapo). */
  semitones?: number;
  /** Spalten pro Seite (1 oder 2). */
  cols?: 1 | 2;
  /** Schriftgröße der Liedzeilen in pt. */
  fontPt?: number;
  /** Nur Text (Akkorde ausblenden). */
  lyricsOnly?: boolean;
  /** Mit Flats statt Sharps spelling. */
  flat?: boolean;
  /** Zusätzlicher Halbton-Versatz je Abschnitts-Index (Issue #16). */
  sectionSemitones?: Record<number, number>;
  /** Anzuzeigende Tonart im Kopf (z. B. transponiert). Fällt auf targetKey/originalKey zurück. */
  displayKey?: string;
  /** App-Logo oben rechts (HTMLImageElement oder PNG-DataURL). Optional. */
  logo?: HTMLImageElement | string | null;
  /**
   * **Eine lange Seite statt A4** (Scroll-Modus, #607): eine Spalte, kein Seitenumbruch, die Seite ist
   * so hoch wie der Inhalt, die CCLI-Angabe steht direkt darunter. Keine Lücken mehr am Seitenende und
   * zwischen Outro und Fußzeile (Rückmeldung Musik-Bereichsleiter, 17.10.2026).
   */
  rolle?: boolean;
}

/**
 * Nur intern: Was ein Satz-Durchlauf mitschreibt – Endhöhe (für die Rolle) und WO jedes Stück eines
 * Teils steht (#614: daraus werden die Anmerkungen zwischen A4 und Rolle umgerechnet).
 */
interface Protokoll extends Satzplan {
  hoehe: number;
}

function leeresProtokoll(): Protokoll {
  return { hoehe: 0, stuecke: [], weiterschalten: [], kopfEnde: 0, spalten: 1, seiten: 1 };
}

const PT_TO_MM = 0.352777;
// A4 Hochformat – Maße in `blattMasse.ts`, die Umrechnung der Anmerkungen nutzt dieselben (#614).
// Alles schwarz halten (SongSelect-Look) – damit Akkorde auch auf S/W-Druckern klar sichtbar sind.
const TEXT_COLOR: [number, number, number] = [20, 17, 15];
const CHORD_COLOR: [number, number, number] = TEXT_COLOR;
const LABEL_COLOR: [number, number, number] = TEXT_COLOR;
const MUTED_COLOR: [number, number, number] = [90, 90, 90];

/**
 * Titel und Autor für den Kopf des Blatts (#236).
 *
 * `{title}`/`{artist}` **des gerenderten Textes** gehen vor. Der Server tut dasselbe für das
 * Original (`buildSong`) – hier ist es zusätzlich nötig, weil das Blatt auch eine **Version**
 * zeigen kann, die ihren eigenen Titel trägt. Damit kann die Editor-Vorschau nie wieder etwas
 * anderes anzeigen als das fertige Blatt: beide gehen durch diese Funktion.
 */
export function chartHead(song: Pick<SetlistSong, 'title' | 'author' | 'chordpro'>): {
  title: string;
  author: string;
} {
  const meta = parseMetadata(song.chordpro ?? '');
  return {
    title: meta.title || song.title,
    author: meta.artist || song.author,
  };
}

/**
 * Was ein Blatt wirklich braucht (#283): Titel/Autor über `chartHead`, dazu Akkorde, Tonarten, Taktart
 * und Tempo. NICHT das ganze `SetlistSong` – die weite Signatur war der Grund, warum `PdfPreview` ein
 * zusammengesetztes Objekt mit `as unknown as SetlistSong` durchschieben musste. Ein Doppel-Cast
 * schaltet die Typprüfung komplett ab; eine schmale Signatur braucht ihn gar nicht.
 */
export type ChordPdfSong = Pick<
  SetlistSong,
  'title' | 'author' | 'chordpro' | 'originalKey' | 'targetKey' | 'timeSig' | 'bpm' | 'ccli'
>;

/**
 * Erzeugt aus dem ChordPro eines Lieds eine SongSelect-artige PDF (Akkorde über Text,
 * Abschnitts-Labels, 1/2 Spalten, Seitenumbruch). ChordPro bleibt die Quelle – die PDF ist
 * die erzeugte Ansicht/das Export-Format. Liefert das fertige jsPDF-Dokument zurück.
 */
export function generateChordPdf(
  song: ChordPdfSong,
  opts: ChordPdfOptions = {},
  doc?: jsPDF,
  protokoll?: Protokoll,
): jsPDF {
  const {
    semitones = 0,
    cols: gewaehlteSpalten = 1,
    fontPt = 11,
    lyricsOnly = false,
    flat = false,
    sectionSemitones,
    displayKey,
    logo,
    rolle = false,
  } = opts;
  // Die Rolle hat immer eine Spalte – zwei Spalten auf einer endlos langen Seite ergäben keinen Sinn.
  const cols = rolle ? 1 : gewaehlteSpalten;
  const d = doc ?? (rolle ? rollenDokument(rollenHoehe(song, opts)) : neuesA4());

  const lyricH = fontPt * PT_TO_MM * 1.18; // Höhe einer Textzeile
  const chordPt = Math.max(8, Math.round(fontPt * 0.95));
  const chordH = chordPt * PT_TO_MM * 1.15; // Höhe einer Akkordzeile
  const rowH = (lyricsOnly ? 0 : chordH) + lyricH; // eine „musikalische" Zeile
  const emptyGap = lyricH * 0.5;
  const sectionGap = lyricH * 0.8;
  // Labels deutlicher: fett, etwas größer als der Text, mit klarem Abstand darüber.
  const labelPt = Math.max(10, Math.round(fontPt * 1.0));
  const labelH = labelPt * PT_TO_MM * 1.3 + 2.5;

  const colW = spaltenBreite(cols);
  // Die Rolle bricht nie um – ihr „Seitenende" gibt es nicht.
  const bottom = rolle ? Number.POSITIVE_INFINITY : PAGE_H - MARGIN;
  let col = 0;
  let pageNo = 0; // 0 = erste Seite (mit Titelkopf); darunter beginnen die Spalten tiefer
  let x = MARGIN;
  let y = MARGIN;

  function colX(c: number): number {
    return spaltenX(c, cols);
  }
  // ── Stücke mitschreiben (#614) ──
  // Ein Stück ist ein zusammenhängender Lauf eines Teils in EINER Spalte einer Seite. Bricht ein Teil
  // um, beginnt ein neues Stück desselben Teils; `imTeil` sagt, wie weit der Teil davor schon war.
  let offen: Omit<Stueck, 'y1'> | null = null;
  let imTeilLauf = 0;
  function stueckOeffnen(teil: number) {
    offen = { teil, seite: pageNo, spalte: col, x: colX(col), y0: y, imTeil: imTeilLauf };
  }
  function stueckSchliessen() {
    const o = offen;
    offen = null;
    if (!o || y <= o.y0) return; // leeres Stück (Umbruch direkt am Anfang) – zählt nicht
    protokoll?.stuecke.push({ ...o, y1: y });
    imTeilLauf += y - o.y0;
  }

  function nextColumn() {
    const lief = offen?.teil;
    stueckSchliessen();
    col += 1;
    if (col >= cols) {
      d.addPage();
      col = 0;
      pageNo += 1;
    }
    x = colX(col);
    // Auf Seite 1 beginnen ALLE Spalten unter dem Titelkopf (sonst überlappt Spalte 2 den Titel).
    y = pageNo === 0 ? startY : MARGIN;
    if (lief !== undefined) stueckOeffnen(lief);
  }
  function ensure(space: number) {
    if (y + space > bottom) nextColumn();
  }

  // Kopf im SongSelect-Stil: Logo oben rechts, dann Titel / Autor / „Tonart - X | Taktart - Y".
  let logoBottom = MARGIN;
  if (logo) {
    try {
      const lw = 17; // mm (eng zugeschnittenes Logo → ohne Eigenrand kleiner ansetzen)
      const logoMargin = 6; // sauber in die Ecke, oben = rechts gleich
      let lh = lw;
      if (typeof logo !== 'string' && logo.naturalWidth > 0)
        lh = lw * (logo.naturalHeight / logo.naturalWidth);
      d.addImage(logo, 'PNG', PAGE_W - logoMargin - lw, logoMargin, lw, lh);
      logoBottom = logoMargin + lh;
    } catch {
      /* Logo ist optional */
    }
  }

  const head = chartHead(song);
  const titlePt = fontPt + 6;
  d.setFont('helvetica', 'bold');
  d.setFontSize(titlePt);
  d.setTextColor(...TEXT_COLOR);
  d.text(head.title, MARGIN, y + titlePt * PT_TO_MM);
  y += titlePt * PT_TO_MM + 1.5;

  const subPt = Math.max(8, fontPt - 2);
  if (head.author) {
    d.setFont('helvetica', 'normal');
    d.setFontSize(subPt);
    d.setTextColor(...MUTED_COLOR);
    d.text(head.author, MARGIN, y + subPt * PT_TO_MM);
    y += subPt * PT_TO_MM + 1;
  }

  const headKey = displayKey || song.targetKey || song.originalKey || '';
  const infoParts: string[] = [];
  if (headKey) infoParts.push(`Tonart - ${headKey}`);
  if (song.timeSig) infoParts.push(`Taktart - ${song.timeSig}`);
  if (song.bpm) infoParts.push(`${song.bpm} BPM`);
  if (infoParts.length) {
    d.setFont('helvetica', 'bold');
    d.setFontSize(subPt);
    d.setTextColor(...TEXT_COLOR);
    d.text(infoParts.join('   |   '), MARGIN, y + subPt * PT_TO_MM);
    y += subPt * PT_TO_MM + 1;
  }

  // Flow (#606): Teile in der Reihenfolge der `{flow: …}`-Zeile; sie steht als Wegweiser im Kopf.
  const { teile: sections, flow } = teileImFlow(
    parseChordPro(song.chordpro ?? ''),
    parseMetadata(song.chordpro ?? '').flow,
  );
  if (flow.length > 0) {
    d.setFont('helvetica', 'normal');
    d.setFontSize(subPt);
    d.setTextColor(...MUTED_COLOR);
    // Rechts bleibt das Logo frei – der Wegweiser kann mehrzeilig werden.
    const breite = PAGE_W - 2 * MARGIN - (logo ? 22 : 0);
    const zeilen = d.splitTextToSize(`Ablauf: ${flow.join(' – ')}`, breite) as string[];
    for (const z of zeilen) {
      d.text(z, MARGIN, y + subPt * PT_TO_MM);
      y += subPt * PT_TO_MM + 1;
    }
  }

  // Spalten beginnen unter dem Titelkopf UND unter dem Logo (nur Seite 1).
  const startY = Math.max(y, logoBottom) + 4;
  y = startY;
  x = colX(0);
  if (protokoll) {
    protokoll.kopfEnde = startY;
    protokoll.spalten = cols;
  }

  type Pair = { chord: string | null; text: string };
  // Eine Liedzeile in Token zerlegen (Akkord bleibt am ersten Wort) und an Wortgrenzen so
  // umbrechen, dass sie in die Spaltenbreite passt (kein Abschneiden, kein Überlauf).
  function wrapLine(pairs: Pair[]): Pair[][] {
    d.setFont('helvetica', 'normal');
    d.setFontSize(fontPt);
    const toks: Pair[] = [];
    for (const p of pairs) {
      const words = (p.text || '').match(/\S+\s*|\s+/g);
      if (!words) {
        toks.push({ chord: p.chord, text: p.text || '' });
        continue;
      }
      // Akkord auf das erste Wort mit echtem Text legen – nicht auf ein führendes Leerzeichen
      // (Quelltext „[C] wort"). Sonst würde das Leerzeichen-Token auf Akkordbreite aufgeblasen
      // und erzeugte eine Lücke. Hat das Segment nur Leerraum (z. B. Instrumental-Akkorde ohne
      // Text), bleibt der Akkord am ersten Token (Abstand dort gewollt).
      const firstWordIdx = words.findIndex((w) => /\S/.test(w));
      const chordIdx = firstWordIdx === -1 ? 0 : firstWordIdx;
      words.forEach((w, wi) => toks.push({ chord: wi === chordIdx ? p.chord : null, text: w }));
    }
    const rows: Pair[][] = [[]];
    let lineW = 0;
    for (const t of toks) {
      let adv = d.getTextWidth(t.text);
      if (t.chord) {
        d.setFont('helvetica', 'bold');
        d.setFontSize(chordPt);
        adv = Math.max(adv, d.getTextWidth(t.chord) + 1.5);
        d.setFont('helvetica', 'normal');
        d.setFontSize(fontPt);
      }
      if (lineW + adv > colW && rows[rows.length - 1].length > 0) {
        rows.push([]);
        lineW = 0;
      }
      rows[rows.length - 1].push(t);
      lineW += adv;
    }
    return rows;
  }

  // „Nur Text": eine Rohzeile zu sauberem, linksbündigem Fließtext aufbereiten und auf
  // Spaltenbreite umbrechen. Akkorde raus, Silbentrenner „Va - ter" → „Vater" zusammenführen,
  // Mehrfach-Leerzeichen (von Akkordpositionen) auf eines reduzieren, Einrückung trimmen.
  function lyricRows(rawLine: string): Pair[][] {
    const plain = rawLine
      .replace(/\[[^\]]*\]/g, '') // Akkorde entfernen
      .replace(/\s+-\s+/g, '') // Silbentrenner zusammenführen
      .replace(/\s{2,}/g, ' ') // Mehrfach-Leerzeichen → eines
      .trim();
    if (!plain) return [[{ chord: null, text: '' }]];
    d.setFont('helvetica', 'normal');
    d.setFontSize(fontPt);
    const lines = d.splitTextToSize(plain, colW) as string[];
    return lines.map((s) => [{ chord: null, text: s }]);
  }

  function drawRow(row: Pair[]) {
    // Führende reine Leerzeichen am Zeilenanfang weglassen (z. B. Einrückung aus „[A]   Ich")
    // → jede Zeile beginnt bündig am linken Spaltenrand. Mehrfach-Leerzeichen INNERHALB der
    // Zeile bleiben unberührt.
    let s = 0;
    while (s < row.length && !row[s].chord && !/\S/.test(row[s].text || '')) s++;
    const cells = row.slice(s);
    let cx = x;
    const yChord = y + chordPt * PT_TO_MM;
    const yLyric = y + (lyricsOnly ? 0 : chordH) + fontPt * PT_TO_MM;
    // Ein Akkord, der breiter ist als seine Silbe, darf über die folgenden akkordlosen Wörter
    // ragen (wie in Lead-Sheets üblich). Extra-Platz wird nur erzwungen, wenn direkt danach
    // wieder ein Akkord käme – sonst entstünde eine unnötige Lücke. `chordDebt` = Restbreite,
    // die der zuletzt gesetzte Akkord bis zum nächsten Akkord noch beansprucht.
    let chordDebt = 0;
    cells.forEach((p, i) => {
      d.setFont('helvetica', 'normal');
      d.setFontSize(fontPt);
      const tw = d.getTextWidth(p.text || '');
      if (p.chord) {
        d.setFont('helvetica', 'bold');
        d.setFontSize(chordPt);
        d.setTextColor(...CHORD_COLOR);
        d.text(p.chord, cx, yChord);
        chordDebt = d.getTextWidth(p.chord) + 1.5;
      }
      if (p.text) {
        d.setFont('helvetica', 'normal');
        d.setFontSize(fontPt);
        d.setTextColor(...TEXT_COLOR);
        d.text(p.text, cx, yLyric);
      }
      let adv = tw;
      chordDebt -= tw;
      const next = cells[i + 1];
      if (chordDebt > 0 && next && next.chord) {
        adv += chordDebt; // gerade so viel Platz, dass der nächste Akkord nicht überlappt
        chordDebt = 0;
      }
      if (chordDebt < 0) chordDebt = 0;
      cx += adv;
    });
    y += rowH;
  }

  sections.forEach((sec, teil) => {
    // Die Abschnitts-Transponierung hängt am Teil im ORIGINAL – auch wenn er im Flow wiederkehrt.
    const secSemi = semitones + (sectionSemitones?.[sec.index] ?? 0);

    // Sektion vorab umbrechen + Gesamthöhe berechnen (Label + Zeilen/Leerzeilen).
    const blocks: ({ gap: true } | { rows: Pair[][] })[] = [];
    let secH = sec.label ? labelH : 0;
    for (const rawLine of sec.lines) {
      if (rawLine === '') {
        blocks.push({ gap: true });
        secH += emptyGap;
        continue;
      }
      let rows: Pair[][];
      if (lyricsOnly) {
        rows = lyricRows(rawLine);
      } else {
        const pairs = parseLine(rawLine).map((p) => ({
          chord: p.chord ? transposeChord(p.chord, secSemi, flat) : null,
          text: p.text,
        }));
        rows = wrapLine(pairs);
      }
      blocks.push({ rows });
      secH += rows.length * rowH;
    }

    // Ganze Sektion zusammenhalten: passt sie nicht mehr in die Spalte, aber komplett in eine
    // leere Spalte → vorher umbrechen (springt geschlossen auf die nächste Spalte/Seite).
    const colTop = pageNo === 0 ? startY : MARGIN;
    if (y + secH > bottom && secH <= bottom - colTop) nextColumn();

    imTeilLauf = 0;
    stueckOeffnen(teil);
    if (sec.label) {
      ensure(labelH + rowH);
      d.setFont('helvetica', 'bold');
      d.setFontSize(labelPt);
      d.setTextColor(...LABEL_COLOR);
      d.text(sec.label.toUpperCase(), x, y + labelPt * PT_TO_MM);
      y += labelH;
    }
    blocks.forEach((b, zeile) => {
      // Weiterschalt-Punkt `----` vor dieser Zeile (#609): Hier hält das Pedal auf der Rolle an. Die
      // Blöcke stehen 1:1 für `sec.lines`, deren Stellen `umbrueche` zählt. (Auf A4 kann die Zeile danach
      // noch in die nächste Spalte rutschen – gebraucht wird die Stelle nur auf der Rolle, die nie umbricht.)
      if (sec.umbrueche?.includes(zeile)) protokoll?.weiterschalten.push({ seite: pageNo, y });
      if ('gap' in b) {
        y += emptyGap;
        return;
      }
      for (const row of b.rows) {
        ensure(rowH);
        drawRow(row);
      }
    });
    stueckSchliessen();
    y += sectionGap;
  });

  // CCLI-Fußzeile: auf A4 zentriert unten auf der letzten Seite, auf der Rolle direkt unter dem
  // letzten Teil (sonst stünde dort wieder die Lücke, die die Rolle vermeiden soll).
  const inhaltEnde = y - sectionGap; // nach dem letzten Teil steht noch der Abstand zum nächsten
  const ccliY = rolle ? inhaltEnde + 6 : PAGE_H - 8;
  if (song.ccli) {
    d.setFont('helvetica', 'italic');
    d.setFontSize(8);
    d.setTextColor(...MUTED_COLOR);
    d.text(`CCLI-Liednummer ${song.ccli}`, PAGE_W / 2, ccliY, { align: 'center' });
  }
  if (protokoll) {
    protokoll.hoehe = (song.ccli ? ccliY + 2 : inhaltEnde) + MARGIN;
    protokoll.seiten = pageNo + 1;
  }

  return d;
}

function neuesA4(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
}

/** Mindesthöhe der Rolle – ein Lied aus zwei Zeilen soll nicht als schmaler Streifen erscheinen. */
const ROLLE_MIN_H = 120;
/**
 * Höchsthöhe: Das PDF-Format erlaubt höchstens 14 400 Punkte (≈ 5,08 m) je Seitenkante – jsPDF kappt
 * darüber still. 5 m Liedblatt gibt es nicht; die Grenze steht hier, damit die Probe sie nie reißt.
 */
const ROLLE_MAX_H = 5000;

/** Hochkant bleibt hochkant: jsPDF dreht ein Format, das „portrait" heißt, aber breiter als hoch ist. */
function rollenFormat(hoehe: number): { format: [number, number]; orientation: 'p' | 'l' } {
  const h = Math.min(ROLLE_MAX_H, Math.max(ROLLE_MIN_H, hoehe));
  return { format: [PAGE_W, h], orientation: h >= PAGE_W ? 'p' : 'l' };
}

function rollenDokument(hoehe: number): jsPDF {
  return new jsPDF({ unit: 'mm', ...rollenFormat(hoehe) });
}

/**
 * Wie hoch die Rolle eines Lieds wird (mm). jsPDF braucht die Seitengröße VOR dem Schreiben – also
 * einmal zur Probe auf eine sehr lange Seite setzen und ablesen, wo der Inhalt endet. Gesetzt wird
 * dabei mit genau derselben Funktion wie danach; eine zweite Höhenrechnung gibt es bewusst nicht.
 */
export function rollenHoehe(song: ChordPdfSong, opts: ChordPdfOptions = {}): number {
  return rollenProbe(song, opts).hoehe;
}

function rollenProbe(song: ChordPdfSong, opts: ChordPdfOptions): Protokoll {
  const probe = new jsPDF({ unit: 'mm', format: [PAGE_W, ROLLE_MAX_H], orientation: 'p' });
  const p = leeresProtokoll();
  generateChordPdf(song, { ...opts, rolle: true }, probe, p);
  p.hoehe = Math.min(ROLLE_MAX_H, Math.max(ROLLE_MIN_H, Math.ceil(p.hoehe)));
  return p;
}

/**
 * **Wo steht was – auf A4 und auf der Rolle?** (#614) Beide Sätze laufen durch DIESELBE Funktion; die
 * A4-Seiten mit den Einstellungen des Lieds (auch 2 Spalten), die Rolle immer einspaltig. Daraus rechnet
 * `rollenAbbildung.ts` die Anmerkungen um – sie bleiben auf den A4-Seiten gespeichert.
 */
export function satzplaene(
  song: ChordPdfSong,
  opts: ChordPdfOptions = {},
): { a4: Satzplan; rolle: Satzplan & { hoehe: number } } {
  const a4 = leeresProtokoll();
  generateChordPdf(song, { ...opts, rolle: false }, neuesA4(), a4);
  const { hoehe, ...rolle } = rollenProbe(song, opts);
  const { hoehe: _a4Hoehe, ...a4Plan } = a4;
  return { a4: a4Plan, rolle: { ...rolle, hoehe } };
}

/** Welches Lied (und welche Seite darin) gehört zu einer Seite der zusammengefassten PDF. */
export interface SetlistPageOwner {
  songIdx: number;
  songId: number;
  /** Schlüssel der angezeigten Version ('original' oder Slug) – für versionsbezogene Anmerkungen. */
  versionKey: string;
  localPage: number;
  /**
   * Nur bei der Rolle (Scroll-Modus): wo A4 und Rolle was stehen haben. Die Rolle hat KEINE eigenen
   * Anmerkungen – sie zeigt die der A4-Seiten, umgerechnet (#614).
   */
  abbildung?: Abbildung;
}

/**
 * Alle Lieder als EINE PDF, dazu pro PDF-Seite der Besitzer (Lied + Seite darin). (Das Teilen des
 * Ablaufs geht seit 07.10.2026 über `ablaufPdf.ts`, weil es auch Dokument-Seiten einfügt.)
 * Grundlage für den durchgehenden Seitenstrom über den ganzen Ablauf (2-up im Querformat).
 */
export function generateSetlistPdfWithOwners(
  songs: (SetlistSong & { versionKey?: string })[],
  optsFor: (song: SetlistSong) => ChordPdfOptions,
): { doc: jsPDF; owners: SetlistPageOwner[] } {
  let d: jsPDF | null = null;
  const owners: SetlistPageOwner[] = [];
  songs.forEach((song, si) => {
    const opts = optsFor(song);
    let abbildung: Abbildung | undefined;
    // Jede Seite bekommt ihr Format ausdrücklich: `addPage()` ohne Angabe nimmt das der VORIGEN Seite
    // (nachgemessen 17.10.2026) – nach einer Rolle wäre das nächste A4-Blatt sonst so lang wie sie.
    if (opts.rolle) {
      abbildung = satzplaene(song, opts);
      const { format, orientation } = rollenFormat(abbildung.rolle.hoehe);
      if (d) d.addPage(format, orientation);
      else d = new jsPDF({ unit: 'mm', format, orientation });
    } else if (d) d.addPage('a4', 'p');
    else d = neuesA4();
    const before = d.getNumberOfPages();
    generateChordPdf(song, opts, d);
    const after = d.getNumberOfPages();
    const versionKey = song.versionKey ?? 'original';
    for (let p = 0; p <= after - before; p++) {
      owners.push({
        songIdx: si,
        songId: song.id,
        versionKey,
        localPage: p,
        ...(abbildung ? { abbildung } : {}),
      });
    }
  });
  return { doc: d ?? neuesA4(), owners };
}
