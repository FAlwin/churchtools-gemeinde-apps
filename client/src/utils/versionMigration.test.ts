// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { SetlistSong } from '@shared/types/index';
import { versionNameBisher, versionNameOf, versionSlug } from '@shared/ct/arrangementFiles';
import { versionKopien, versionMigrationAnwenden } from './versionMigration';

/**
 * Versions-Schlüssel berichtigt (07.10.2026, Durchklick 3b-2): Bei Liedern mit Bindestrich im Titel las
 * die App „2 — Akustik" statt „Akustik". Geprüft gegen die ERZEUGER (`versionNameOf`, `versionSlug`),
 * nicht gegen abgeschriebene Schlüssel.
 */
const DATEI = { name: 'Testlied 3b-2 — Akustik (App).chordpro', fileUrl: 'x' };
const NEU = versionSlug(versionNameOf(DATEI) ?? '');
const ALT = versionSlug(versionNameBisher(DATEI) ?? '');

const song = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({
    id: 24,
    arrangementId: 30,
    chordpro: '',
    versions: [{ key: NEU, alterKey: ALT, name: 'Akustik', text: '', writtenKey: null }],
    documents: [],
    ...over,
  }) as SetlistSong;

beforeEach(() => localStorage.clear());

describe('Erkennung des Versionsnamens', () => {
  it('der LETZTE „ — " trennt – ein Bindestrich im Liedtitel zählt nicht', () => {
    expect(versionNameOf(DATEI)).toBe('Akustik');
    expect(NEU).toBe('akustik');
    expect(ALT).toBe('2-akustik'); // so war es bis 07.10.2026
  });

  it('Bestandsdateien bleiben lesbar', () => {
    expect(versionNameOf({ name: 'Treu — Akustik (App).chordpro', fileUrl: 'x' })).toBe('Akustik');
    expect(versionNameOf({ name: 'Lied — Name (ECG).chordpro', fileUrl: 'x' })).toBe('Name');
    expect(versionNameOf({ name: 'Lied-Name (ECG).chordpro', fileUrl: 'x' })).toBe('Name');
    expect(versionNameOf({ name: 'Lied — Bearbeitet.chordpro', fileUrl: 'x' })).toBe('Bearbeitet');
    expect(versionNameOf({ name: 'Lied.chordpro', fileUrl: 'x' })).toBeNull();
  });
});

describe('versionKopien', () => {
  const vorhanden = [
    `worship_docdraw_song24_a30_v${ALT}_0`,
    `worship_docdraw_song24_a30_v${ALT}_0_text`,
    `worship_docdraw_song24_v${ALT}_lyr_1`,
    `worship_doczoom_song24_a30_v${ALT}_0_dlarge2`,
    `worship_key_24_${ALT}`,
    `worship_capo_24_${ALT}_dlarge`,
    // NICHT: anderes Lied, andere Version, gleiche Version an anderem Lied mit ähnlicher ID
    `worship_docdraw_song240_a30_v${ALT}_0`,
    `worship_key_24_original`,
  ];

  it('nimmt Anmerkungen, Zoom und Einstellungen mit – und sonst nichts', () => {
    expect(versionKopien(vorhanden, 24, ALT, NEU).map((k) => k.nach)).toEqual([
      `worship_docdraw_song24_a30_v${NEU}_0`,
      `worship_docdraw_song24_a30_v${NEU}_0_text`,
      `worship_docdraw_song24_v${NEU}_lyr_1`,
      `worship_doczoom_song24_a30_v${NEU}_0_dlarge2`,
      `worship_key_24_${NEU}`,
      `worship_capo_24_${NEU}_dlarge`,
    ]);
  });

  it('überschreibt nichts, was es unter dem neuen Schlüssel schon gibt', () => {
    const k = versionKopien([...vorhanden, `worship_key_24_${NEU}`], 24, ALT, NEU);
    expect(k.map((x) => x.nach)).not.toContain(`worship_key_24_${NEU}`);
  });
});

describe('versionMigrationAnwenden', () => {
  it('kopiert (der Bestand bleibt) und zieht die gewählte Version mit', () => {
    localStorage.setItem(`worship_key_24_${ALT}`, 'D');
    localStorage.setItem('worship_ver_24', ALT);
    expect(versionMigrationAnwenden(song())).toBe(1);
    expect(localStorage.getItem(`worship_key_24_${NEU}`)).toBe('D');
    expect(localStorage.getItem(`worship_key_24_${ALT}`)).toBe('D');
    expect(localStorage.getItem('worship_ver_24')).toBe(NEU);
  });

  it('ein zweiter Lauf findet nichts mehr', () => {
    localStorage.setItem(`worship_key_24_${ALT}`, 'D');
    versionMigrationAnwenden(song());
    expect(versionMigrationAnwenden(song())).toBe(0);
  });

  it('ohne alterKey passiert nichts', () => {
    localStorage.setItem(`worship_key_24_${ALT}`, 'D');
    const ohne = song({
      versions: [{ key: NEU, name: 'Akustik', text: '', writtenKey: null }],
    });
    expect(versionMigrationAnwenden(ohne)).toBe(0);
  });
});
