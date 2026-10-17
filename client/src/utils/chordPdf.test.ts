// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { chartHead, generateChordPdf, generateSetlistPdfWithOwners, rollenHoehe } from './chordPdf';
import { ROLLEN_SEITE } from '@shared/keys/index';
import type { SetlistSong } from '@shared/types/index';

/**
 * #192: `chordPdf.ts` ist der Kern der App (ChordPro → A4-Seiten) und war bei 0 % Abdeckung – ein
 * Fehler hier zerstört jedes Chart im Gottesdienst.
 *
 * Getestet wird bewusst der **Vertrag**, nicht das PDF-Binary: Wie viele Seiten entstehen, und
 * welche Seite gehört zu welchem Lied (`owners[]`). Genau das nutzt `useSetlistPages` für den
 * durchgehenden Seitenstrom – stimmt die Zuordnung nicht, landen Anmerkungen auf der falschen Seite.
 */
function song(over: Partial<SetlistSong> & { chordpro: string }): SetlistSong {
  return {
    id: 1,
    arrangementId: 1,
    arrangementName: 'Standard',
    arrangementCount: 1,
    title: 'Testlied',
    author: 'Autor',
    originalKey: 'C',
    targetKey: 'C',
    bpm: null,
    timeSig: null,
    ccli: null,
    versions: [],
    documents: [],
    ...over,
  };
}

/** ChordPro mit `n` Textzeilen in einem Vers – zum Erzwingen von Umbrüchen. */
function longSong(lines: number, title = 'Langes Lied'): SetlistSong {
  const body = Array.from({ length: lines }, (_, i) => `[C]Zeile ${i} mit [G]Text`).join('\n');
  return song({
    title,
    chordpro: `{title: ${title}}\n{start_of_verse}\n${body}\n{end_of_verse}\n`,
  });
}

const SHORT = song({
  chordpro:
    '{title: Kurz}\n{start_of_verse}\n[C]Hallo [G]Welt\n[Am]Zweite [F]Zeile\n{end_of_verse}\n',
});

describe('generateChordPdf – Seitenaufteilung', () => {
  it('ein kurzes Lied passt auf eine Seite', () => {
    expect(generateChordPdf(SHORT).getNumberOfPages()).toBe(1);
  });

  it('ein sehr langes Lied bricht auf mehrere Seiten um', () => {
    expect(generateChordPdf(longSong(400)).getNumberOfPages()).toBeGreaterThan(1);
  });

  it('zwei Spalten brauchen weniger Seiten als eine', () => {
    const lang = longSong(120);
    const eine = generateChordPdf(lang, { cols: 1 }).getNumberOfPages();
    const zwei = generateChordPdf(lang, { cols: 2 }).getNumberOfPages();
    expect(zwei).toBeLessThan(eine);
  });

  it('größere Schrift braucht mehr (nie weniger) Seiten', () => {
    const lang = longSong(120);
    const klein = generateChordPdf(lang, { fontPt: 9 }).getNumberOfPages();
    const gross = generateChordPdf(lang, { fontPt: 16 }).getNumberOfPages();
    expect(gross).toBeGreaterThanOrEqual(klein);
  });

  it('„Nur Text" braucht nie mehr Seiten als mit Akkorden (Akkordzeilen entfallen)', () => {
    const lang = longSong(120);
    const mit = generateChordPdf(lang, { lyricsOnly: false }).getNumberOfPages();
    const ohne = generateChordPdf(lang, { lyricsOnly: true }).getNumberOfPages();
    expect(ohne).toBeLessThanOrEqual(mit);
  });

  it('leeres ChordPro erzeugt trotzdem eine gültige Seite (kein Absturz)', () => {
    expect(generateChordPdf(song({ chordpro: '' })).getNumberOfPages()).toBe(1);
  });

  it('SongSelect-Dialekt (comment-Abschnitte, optionale/Bass-Akkorde) läuft durch', () => {
    const s = song({
      chordpro:
        '{comment: Vers 1}\n[(E)]Optional [E/G#]Bass [C]normal\n{comment: Refrain}\n[G]Zeile\n',
    });
    expect(generateChordPdf(s).getNumberOfPages()).toBe(1);
  });

  it('in ein vorhandenes Dokument schreiben hängt an, statt neu zu beginnen', () => {
    const doc = generateChordPdf(SHORT);
    const vorher = doc.getNumberOfPages();
    generateChordPdf(longSong(400), {}, doc);
    expect(doc.getNumberOfPages()).toBeGreaterThan(vorher);
  });
});

describe('generateSetlistPdfWithOwners – Seiten-Zuordnung', () => {
  it('liefert für JEDE Seite genau einen Besitzer', () => {
    const { doc, owners } = generateSetlistPdfWithOwners(
      [
        { ...longSong(400), id: 10 },
        { ...SHORT, id: 20 },
      ],
      () => ({}),
    );
    expect(owners).toHaveLength(doc.getNumberOfPages());
  });

  it('ordnet die Seiten dem richtigen Lied zu und zählt die Lied-Seite mit', () => {
    const lang = { ...longSong(400), id: 10 };
    const kurz = { ...SHORT, id: 20 };
    const { owners } = generateSetlistPdfWithOwners([lang, kurz], () => ({}));

    const erste = owners.filter((o) => o.songId === 10);
    const zweite = owners.filter((o) => o.songId === 20);
    expect(erste.length).toBeGreaterThan(1); // langes Lied belegt mehrere Seiten
    expect(zweite).toHaveLength(1);
    // localPage zählt innerhalb des Lieds bei 0 los und lückenlos hoch.
    expect(erste.map((o) => o.localPage)).toEqual(erste.map((_, i) => i));
    expect(zweite[0].localPage).toBe(0);
    // Die Seiten des zweiten Lieds kommen NACH denen des ersten.
    expect(owners.findIndex((o) => o.songId === 20)).toBe(erste.length);
  });

  it('übernimmt den Versions-Schlüssel (steuert die versionsbezogenen Anmerkungen)', () => {
    const { owners } = generateSetlistPdfWithOwners(
      [
        { ...SHORT, id: 1, versionKey: 'akustik' },
        { ...SHORT, id: 2 }, // ohne Angabe → 'original'
      ],
      () => ({}),
    );
    expect(owners.find((o) => o.songId === 1)?.versionKey).toBe('akustik');
    expect(owners.find((o) => o.songId === 2)?.versionKey).toBe('original');
  });

  it('songIdx zeigt auf die Position im Ablauf', () => {
    const { owners } = generateSetlistPdfWithOwners(
      [
        { ...SHORT, id: 7 },
        { ...SHORT, id: 8 },
        { ...SHORT, id: 9 },
      ],
      () => ({}),
    );
    expect(owners.map((o) => o.songIdx)).toEqual([0, 1, 2]);
  });

  it('leere Liste ergibt keine Besitzer', () => {
    expect(generateSetlistPdfWithOwners([], () => ({})).owners).toEqual([]);
  });
});

/**
 * #236: `{title: …}` im ChordPro wurde auf dem Blatt ignoriert – nur die Editor-Vorschau las es.
 * Der Kopf ist jetzt eine reine Funktion, damit die Regel prüfbar ist, ohne das PDF-Binary zu
 * zerlegen.
 */
describe('chartHead – Titel/Autor des Blatts', () => {
  it('{title} aus dem Text schlägt den ChurchTools-Liednamen', () => {
    const s = song({
      title: 'Mottosong AC26',
      chordpro: '{title: Mottosong AC26 - Auf dich will ich bauen}\n[C]Text\n',
    });
    expect(chartHead(s).title).toBe('Mottosong AC26 - Auf dich will ich bauen');
  });

  it('ohne {title} bleibt der ChurchTools-Liedname stehen', () => {
    expect(chartHead(song({ title: 'Nur CT', chordpro: '[C]Text\n' })).title).toBe('Nur CT');
  });

  it('ein leeres {title: } ersetzt den Liednamen NICHT durch nichts', () => {
    expect(chartHead(song({ title: 'Nur CT', chordpro: '{title: }\n[C]Text\n' })).title).toBe(
      'Nur CT',
    );
  });

  /**
   * Der echte Fall vom 13.08.2026 (von Alwin gemeldet): Das Original-ChordPro von CCLI trägt eine
   * **überzählige Klammer** im Titel, die App-Version nicht. Solange die Kopfzeile `song.title` nahm
   * (aus dem Original) und das Blatt `chartHead` mit dem angezeigten Text, standen zwei verschiedene
   * Überschriften übereinander. Beide gehen jetzt durch diese Funktion – gefüttert mit dem Text, der
   * gerade gezeigt wird.
   */
  it('nimmt den Titel der ANGEZEIGTEN Fassung – auch wenn das Original einen anderen trägt', () => {
    const original = '{title: Die Schöpfung singt (Grosser Gott)]}\n[B]Text\n';
    const version = '{title: Die Schöpfung singt (Grosser Gott)}\n[B]Text\n';
    expect(chartHead(song({ title: 'Die Schöpfung singt', chordpro: original })).title).toBe(
      'Die Schöpfung singt (Grosser Gott)]',
    );
    expect(chartHead(song({ title: 'Die Schöpfung singt', chordpro: version })).title).toBe(
      'Die Schöpfung singt (Grosser Gott)',
    );
  });

  it('{artist} schlägt den ChurchTools-Autor, sonst bleibt dieser', () => {
    const mit = song({ author: 'CT-Autor', chordpro: '{artist: Echter Autor}\n[C]Text\n' });
    const ohne = song({ author: 'CT-Autor', chordpro: '[C]Text\n' });
    expect(chartHead(mit).author).toBe('Echter Autor');
    expect(chartHead(ohne).author).toBe('CT-Autor');
  });

  it('eine Version mit eigenem {title} bestimmt den Kopf ihres Blatts', () => {
    // Das ist der Fall, den der Server allein NICHT abdecken kann: er leitet den Titel aus dem
    // Original ab, angezeigt wird aber der Versionstext.
    const original = song({ title: 'Lied', chordpro: '{title: Lied lang}\n[C]Text\n' });
    const version = { ...original, chordpro: '{title: Lied – Akustik}\n[C]Text\n' };
    expect(chartHead(original).title).toBe('Lied lang');
    expect(chartHead(version).title).toBe('Lied – Akustik');
  });
});

/** Was aufs Blatt geschrieben wird – in der Reihenfolge des Schreibens. */
function geschrieben(
  lied: SetlistSong,
  opts: Parameters<typeof generateChordPdf>[1] = {},
): string[] {
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const texte: string[] = [];
  const echt = d.text.bind(d);
  vi.spyOn(d, 'text').mockImplementation(((t: string | string[], ...rest: unknown[]) => {
    texte.push(...(Array.isArray(t) ? t : [t]));
    return (echt as (...a: unknown[]) => jsPDF)(t, ...rest);
  }) as typeof d.text);
  generateChordPdf(lied, opts, d);
  return texte;
}

describe('generateChordPdf – Flow und Weiterschalt-Punkt (#606)', () => {
  const FLOW = song({
    chordpro: [
      '{flow: Intro, Vers 1, Chorus, Vers 2, Chorus}',
      '{comment: Intro}',
      '[C]Auftakt',
      '{comment: Vers 1}',
      '[C]Erster Vers',
      '----',
      '[C]Zweite Hälfte',
      '{comment: Vers 2}',
      '[C]Zweiter Vers',
      '{comment: Chorus}',
      '[C]Refrain',
      '{comment: Bridge}',
      '[C]Brücke',
    ].join('\n'),
  });

  it('setzt die Teile in Flow-Reihenfolge, Wiederholung voll, Nicht-Genanntes weg', () => {
    const labels = geschrieben(FLOW).filter((t) => /^(INTRO|VERS \d|CHORUS|BRIDGE)$/.test(t));
    expect(labels).toEqual(['INTRO', 'VERS 1', 'CHORUS', 'VERS 2', 'CHORUS']);
  });

  it('der Flow steht als Wegweiser im Kopf', () => {
    expect(geschrieben(FLOW)).toContain('Ablauf: Intro – Vers 1 – Chorus – Vers 2 – Chorus');
  });

  it('---- steht nirgends auf dem Blatt', () => {
    const texte = geschrieben(FLOW);
    expect(texte.some((t) => t.includes('----'))).toBe(false);
    expect(texte.join(' ')).toContain('Zweite');
  });

  it('ohne Flow: kein Wegweiser, Reihenfolge wie im Text', () => {
    const texte = geschrieben(song({ chordpro: '{comment: B}\nb\n{comment: A}\na' }));
    expect(texte.some((t) => t.startsWith('Ablauf:'))).toBe(false);
    expect(texte.filter((t) => t === 'A' || t === 'B')).toEqual(['B', 'A']);
  });

  it('die Abschnitts-Transponierung folgt dem Teil – auch bei der Wiederholung', () => {
    // Chorus ist im Original Teil 3 → +2 Halbtöne: C wird D, und zwar BEIDE Male.
    const akkorde = geschrieben(FLOW, { sectionSemitones: { 3: 2 } }).filter((t) =>
      /^[A-G]$/.test(t),
    );
    expect(akkorde).toEqual(['C', 'C', 'C', 'D', 'C', 'D']);
  });
});

/** Höhe der Seite `nr` (1-basiert) in mm. */
function hoehe(d: jsPDF, nr = 1): number {
  d.setPage(nr);
  return d.internal.pageSize.getHeight();
}

describe('generateChordPdf – Rolle für den Scroll-Modus (#607)', () => {
  it('ein langes Lied wird EINE Seite, so hoch wie sein Inhalt', () => {
    const lang = longSong(150);
    const a4 = generateChordPdf(lang);
    const rolle = generateChordPdf(lang, { rolle: true });
    expect(a4.getNumberOfPages()).toBeGreaterThan(1);
    expect(rolle.getNumberOfPages()).toBe(1);
    expect(hoehe(rolle)).toBeGreaterThan(297);
    // Kürzer als die aneinandergereihten A4-Seiten: Die Lücken am Seitenende fallen weg.
    expect(hoehe(rolle)).toBeLessThan(a4.getNumberOfPages() * 297);
    expect(hoehe(rolle)).toBe(rollenHoehe(lang));
  });

  it('ein kurzes Lied ist kein schmaler Streifen – und keine volle A4-Seite', () => {
    const h = hoehe(generateChordPdf(SHORT, { rolle: true }));
    expect(h).toBeGreaterThanOrEqual(120);
    expect(h).toBeLessThan(297);
  });

  it('zwei Spalten gibt es auf der Rolle nicht', () => {
    // Lange Zeilen: In einer halben Spalte brächen sie um, die Rolle würde höher.
    const zeile =
      '[C]Eine lange Zeile, die in einer halben Spalte [G]sicher umbricht und weiterläuft';
    const lang = song({
      chordpro: `{comment: Vers}\n${Array.from({ length: 40 }, () => zeile).join('\n')}`,
    });
    expect(rollenHoehe(lang, { cols: 2 })).toBe(rollenHoehe(lang, { cols: 1 }));
  });

  it('die CCLI-Angabe steht direkt unter dem letzten Teil – nicht am Ende einer A4-Seite', () => {
    // Lang genug, dass die Mindesthöhe der Rolle nicht greift.
    const zeilenText = Array.from({ length: 40 }, (_, i) => `[C]Zeile ${i}`).join('\n');
    const lied = song({ ccli: '123', chordpro: `{comment: Vers}\n${zeilenText}\n[C]Eine Zeile` });
    const zeilen: { text: string; y: number }[] = [];
    const d = generateChordPdf(lied, { rolle: true });
    const h = hoehe(d);
    const probe = new jsPDF({ unit: 'mm', format: [210, h] });
    vi.spyOn(probe, 'text').mockImplementation(((t: string, _x: number, y: number) => {
      zeilen.push({ text: t, y });
      return probe;
    }) as unknown as typeof probe.text);
    generateChordPdf(lied, { rolle: true }, probe);
    const ccli = zeilen.find((z) => z.text.startsWith('CCLI'));
    const text = zeilen.find((z) => z.text.startsWith('Eine'));
    expect(ccli && text).toBeTruthy();
    // UNTER der letzten Zeile, aber gleich danach – und die Seite reicht über beides hinaus.
    expect(ccli!.y).toBeGreaterThan(text!.y);
    expect(ccli!.y - text!.y).toBeLessThan(15);
    expect(h).toBeGreaterThan(ccli!.y);
    expect(h - ccli!.y).toBeLessThan(20);
  });

  it('Ablauf mit Rolle: eine Seite je Lied, Besitzer auf der Rollen-Seite, A4-Lieder bleiben A4', () => {
    const lieder = [longSong(60, 'A'), { ...SHORT, id: 2 }];
    const { doc, owners } = generateSetlistPdfWithOwners(lieder, (s) => ({ rolle: s.id !== 2 }));
    expect(owners.map((o) => [o.songId, o.localPage])).toEqual([
      [1, ROLLEN_SEITE],
      [2, 0],
    ]);
    expect(hoehe(doc, 1)).toBe(rollenHoehe(lieder[0]));
    // Ohne ausdrückliches Format hätte `addPage()` das der ersten Seite genommen – also die Rolle.
    expect(hoehe(doc, 2)).toBeCloseTo(297, 0);
  });
});
