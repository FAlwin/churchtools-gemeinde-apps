// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { SetlistSong, SongDocument } from '@shared/types/index';
import { loadSettings } from './chartSettings';
import { clearDeviceData } from './clearDeviceData';
import { setLsSong } from './songVersions';
import { gemeindeAnsicht, merkeGemeindeAnsicht, standardQuelle } from './standardAnsicht';

/**
 * Was ein Lied beim ersten Öffnen zeigt (07.10.2026, Anfrage einer Gemeinde ohne ChordPro-Dateien).
 * Alwin: „beides" – Lieder ohne ChordPro automatisch als PDF, dazu „PDF zuerst" für die Gemeinde.
 */
const BILD: SongDocument = { fileId: 31, name: 'noten.png', type: 'image' };
const PDF: SongDocument = { fileId: 32, name: 'leadsheet.pdf', type: 'pdf' };

const song = (over: Partial<SetlistSong> = {}): SetlistSong => ({
  id: 5,
  arrangementId: 1,
  arrangementName: 'Standard',
  arrangementCount: 1,
  title: 'Test',
  author: '',
  originalKey: 'C',
  targetKey: 'C',
  bpm: null,
  timeSig: null,
  ccli: null,
  chordpro: '{key: C}\n[C]Text',
  versions: [],
  documents: [BILD, PDF],
  ...over,
});
const ohneChordpro = (over: Partial<SetlistSong> = {}) => song({ chordpro: '', ...over });

beforeEach(() => localStorage.clear());

describe('standardQuelle – Gemeinde „Akkorde" (Standard)', () => {
  it('Lied mit ChordPro → Akkorde, auch wenn es ein PDF hat', () => {
    expect(standardQuelle(song(), 'akkorde')).toBe('chords');
  });

  it('Lied OHNE ChordPro → sein PDF (das erste PDF, nicht das Bild davor)', () => {
    expect(standardQuelle(ohneChordpro(), 'akkorde')).toBe(PDF.fileId);
  });

  it('ohne PDF → das erste Bild', () => {
    expect(standardQuelle(ohneChordpro({ documents: [BILD] }), 'akkorde')).toBe(BILD.fileId);
  });

  it('nur benannte Versionen (kein Original) zählt als „mit ChordPro"', () => {
    const versionen = [
      { key: 'akustik', name: 'Akustik', text: '[C]x' },
    ] as SetlistSong['versions'];
    expect(standardQuelle(ohneChordpro({ versions: versionen }), 'akkorde')).toBe('chords');
  });

  it('Datei nur gerade NICHT GELADEN → bleibt bei den Akkorden (vorübergehend ist nicht ungültig)', () => {
    expect(standardQuelle(ohneChordpro({ chordproFailed: true }), 'akkorde')).toBe('chords');
  });

  it('ohne Dokument → Akkorde, auch ohne ChordPro', () => {
    expect(standardQuelle(ohneChordpro({ documents: [] }), 'akkorde')).toBe('chords');
  });
});

describe('standardQuelle – Gemeinde „PDF zuerst"', () => {
  it('Lied mit Dokument → das Dokument, auch wenn es ChordPro hat', () => {
    expect(standardQuelle(song(), 'dokument')).toBe(PDF.fileId);
  });

  it('ohne Dokument → Akkorde', () => {
    expect(standardQuelle(song({ documents: [] }), 'dokument')).toBe('chords');
  });
});

describe('loadSettings – die eigene Wahl am Lied geht vor', () => {
  it('nichts gewählt + Gemeinde „PDF zuerst" → das Dokument', () => {
    merkeGemeindeAnsicht('dokument');
    expect(loadSettings(song()).viewSource).toBe(PDF.fileId);
  });

  it('ausdrücklich „Akkorde" gewählt → bleibt Akkorde, auch bei „PDF zuerst"', () => {
    merkeGemeindeAnsicht('dokument');
    setLsSong('view', 5, 'chords');
    expect(loadSettings(song()).viewSource).toBe('chords');
  });

  it('ausdrücklich „Akkorde" bei einem Lied ohne ChordPro → bleibt Akkorde', () => {
    setLsSong('view', 5, 'chords');
    expect(loadSettings(ohneChordpro()).viewSource).toBe('chords');
  });

  it('ein gewähltes Dokument, das es nicht mehr gibt → wieder der Standard', () => {
    setLsSong('view', 5, '999');
    expect(loadSettings(ohneChordpro()).viewSource).toBe(PDF.fileId);
  });
});

describe('Gemerkte Ansicht der Gemeinde', () => {
  it('ohne Angabe gilt „Akkorde"', () => {
    expect(gemeindeAnsicht()).toBe('akkorde');
    merkeGemeindeAnsicht('dokument');
    merkeGemeindeAnsicht(undefined);
    expect(gemeindeAnsicht()).toBe('akkorde');
  });

  it('übersteht das Abmelden – sie ist keine Konto-Angabe', async () => {
    merkeGemeindeAnsicht('dokument');
    await clearDeviceData();
    expect(gemeindeAnsicht()).toBe('dokument');
  });
});
