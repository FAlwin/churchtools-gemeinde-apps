import { jsPDF } from 'jspdf';
import type { SetlistSong, SongDocument } from '@shared/types/index';
import { loadSettings } from './chartSettings';
import { generateChordPdf, type ChordPdfOptions } from './chordPdf';
import { selectedVersionKey, versionText } from './songVersions';
import type { StreamOwner } from './streamCompose';

/**
 * **Den Ablauf als EIN PDF teilen – jedes Lied so, wie es angezeigt wird** (07.10.2026).
 *
 * Anlass: Bei einer Gemeinde ohne ChordPro-Dateien (nur PDFs in ChurchTools) fehlte der Teilen-Knopf
 * ganz – das geteilte PDF wurde nur aus Akkorden gebaut, und ohne ein einziges Akkord-Lied gab es
 * nichts zu teilen. Jetzt steuert jedes Lied bei, was es auf dem Bildschirm zeigt: seine Akkorde
 * oder die Seiten seines Dokuments (PDF/Bild aus ChurchTools, als Bild auf A4).
 */

/** Ein Lied des Ablaufs, wie es ins geteilte PDF soll. */
export interface AblaufEintrag {
  song: SetlistSong;
  /** Die angezeigte Version – Teil des Anmerkungs-Schlüssels der Akkord-Seiten. */
  versionKey: string;
  /** Was das Lied zeigt: die Akkorde (mit Optionen) oder ein Dokument. */
  quelle: { art: 'akkorde'; opts: ChordPdfOptions } | { art: 'dokument'; dokument: SongDocument };
}

/**
 * Die Anmerkungs-Ebene einer Seite als PNG (durchsichtig) – oder `null`. Bekommt den Besitzer der
 * Seite wie im Liedblatt (`StreamOwner`), damit der Schlüssel aus DERSELBEN Grammatik entsteht
 * (`drawKeyForOwner`), und die gewünschte Auflösung.
 */
export type AnmerkungsEbene = (
  seite: StreamOwner,
  lyricsOnly: boolean,
  breite: number,
  hoehe: number,
) => Promise<string | null>;

/** Ein Lied, das etwas zum Teilen hat – mit dem Text der gewählten Version und seiner Quelle. */
export interface TeilbaresLied {
  song: SetlistSong;
  versionKey: string;
  /** Das angezeigte Dokument – oder `null`, wenn das Lied seine Akkorde zeigt. */
  dokument: SongDocument | null;
}

/**
 * Was beim Teilen des Ablaufs mitkommt: jedes Lied mit dem, was es **anzeigt** (`loadSettings` – also
 * auch die Standard-Ansicht der Gemeinde und Lieder ohne ChordPro). Ein Lied ohne Akkord-Text und ohne
 * Dokument hat nichts beizutragen und fällt weg.
 */
export function teilbareLieder(songs: SetlistSong[]): TeilbaresLied[] {
  return songs.flatMap((s) => {
    const versionKey = selectedVersionKey(s);
    const song = { ...s, chordpro: versionText(s, versionKey) };
    const quelle = loadSettings(s, versionKey).viewSource;
    const dokument =
      quelle === 'chords' ? null : (s.documents.find((d) => d.fileId === quelle) ?? null);
    if (!dokument && !song.chordpro) return [];
    return [{ song, versionKey, dokument }];
  });
}

/**
 * Lieder, deren Akkorde nur wegen eines Ladefehlers fehlen (#274) – und die auch Akkorde ZEIGEN
 * würden. Ein Lied, das sein Dokument zeigt, kommt ohnehin mit.
 */
export function akkordeNichtGeladen(songs: SetlistSong[], teilbar: TeilbaresLied[]): string[] {
  const mitDokument = new Set(teilbar.filter((t) => t.dokument).map((t) => t.song.id));
  return songs.filter((s) => s.chordproFailed && !mitDokument.has(s.id)).map((s) => s.title);
}

// A4 hochkant in mm, wie `chordPdf.ts`.
const SEITE_B = 210;
const SEITE_H = 297;
const RAND = 6;

/** Wo eine Dokument-Seite auf A4 sitzt – eingepasst, mittig, Seitenverhältnis bleibt. */
function bildRahmen(leinwand: HTMLCanvasElement): { x: number; y: number; b: number; h: number } {
  const massstab = Math.min(
    (SEITE_B - 2 * RAND) / leinwand.width,
    (SEITE_H - 2 * RAND) / leinwand.height,
  );
  const b = leinwand.width * massstab;
  const h = leinwand.height * massstab;
  return { x: (SEITE_B - b) / 2, y: (SEITE_H - h) / 2, b, h };
}

/** Auflösung der Anmerkungs-Ebene einer Akkord-Seite: A4 bei 150 dpi. */
const AKKORD_EBENE = { breite: 1240, hoehe: 1754 };

/**
 * Baut das PDF. Dokumente werden über `ladeSeiten` geholt (Anzeige und Teilen nutzen dieselbe
 * Umwandlung, `dokumentSeiten.ts`). Scheitert ein Dokument, fällt das Lied auf seine Akkorde zurück,
 * wenn es welche hat – sonst fehlt es. Beides wird in `fehlend`/`ersetzt` gemeldet: Ein Lied darf
 * nicht STILL aus dem geteilten PDF fallen (#274). Mit `ebene` kommen die Anmerkungen auf jede Seite.
 */
export async function ablaufPdfBauen(
  eintraege: AblaufEintrag[],
  mittel: {
    ladeSeiten: (song: SetlistSong, dokument: SongDocument) => Promise<HTMLCanvasElement[]>;
    akkordOpts: (song: SetlistSong) => ChordPdfOptions;
    ebene?: AnmerkungsEbene;
  },
): Promise<{ doc: jsPDF; fehlend: string[]; ersetzt: string[] }> {
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const fehlend: string[] = [];
  const ersetzt: string[] = [];
  // jsPDF beginnt mit einer leeren Seite – die erste Seite des ersten Lieds kommt dorthin.
  let leer = true;
  const neueSeite = () => {
    if (!leer) d.addPage();
    leer = false;
  };

  for (const [songIdx, { song, versionKey, quelle }] of eintraege.entries()) {
    const besitzer = (
      kind: StreamOwner['kind'],
      localPage: number,
      dokument?: SongDocument,
    ): StreamOwner => ({
      songIdx,
      songId: song.id,
      localPage,
      kind,
      versionKey,
      arrangementId: song.arrangementId,
      fileId: dokument?.fileId,
      docType: dokument?.type,
    });

    if (quelle.art === 'dokument') {
      try {
        const seiten = await mittel.ladeSeiten(song, quelle.dokument);
        if (seiten.length === 0) throw new Error('leeres Dokument');
        for (const [i, leinwand] of seiten.entries()) {
          neueSeite();
          const r = bildRahmen(leinwand);
          // JPEG statt PNG: Notenblätter als PNG machen das geteilte PDF schnell zweistellig in MB.
          d.addImage(leinwand.toDataURL('image/jpeg', 0.85), 'JPEG', r.x, r.y, r.b, r.h);
          const bild = await mittel.ebene?.(
            besitzer('doc', i, quelle.dokument),
            false,
            leinwand.width,
            leinwand.height,
          );
          if (bild) d.addImage(bild, 'PNG', r.x, r.y, r.b, r.h);
        }
        continue;
      } catch {
        if (!song.chordpro) {
          fehlend.push(song.title);
          continue;
        }
        ersetzt.push(song.title);
      }
    }
    neueSeite();
    const opts = quelle.art === 'akkorde' ? quelle.opts : mittel.akkordOpts(song);
    const erste = d.getNumberOfPages();
    generateChordPdf(song, opts, d);
    if (mittel.ebene) {
      for (let seite = erste; seite <= d.getNumberOfPages(); seite++) {
        const bild = await mittel.ebene(
          besitzer('chord', seite - erste),
          !!opts.lyricsOnly,
          AKKORD_EBENE.breite,
          AKKORD_EBENE.hoehe,
        );
        if (!bild) continue;
        d.setPage(seite);
        d.addImage(bild, 'PNG', 0, 0, SEITE_B, SEITE_H);
      }
      d.setPage(d.getNumberOfPages());
    }
  }
  // Kein einziges Lied kam an – ein leeres PDF zu teilen hieße „hat geklappt" für nichts.
  if (leer)
    throw new Error('Keines der Lieder konnte geladen werden – bitte später erneut versuchen.');
  return { doc: d, fehlend, ersetzt };
}
