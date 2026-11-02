import { describe, expect, it } from 'vitest';
import type { TerminDatei } from '@shared/ct/terminDateien';
import { terminDateiAnzeige } from './terminDatei';

const datei = (name: string, groesse: number | null = null): TerminDatei => ({
  id: 1,
  name,
  art: 'datei',
  url: 'https://x.church.tools/?q=public/filedownload&id=1',
  groesse,
});

describe('terminDateiAnzeige', () => {
  it('Art über dieselbe Erkennung wie bei Lied-Dateien, Größe nur wenn bekannt', () => {
    expect(terminDateiAnzeige(datei('Folien.pdf', 2.4 * 1024 * 1024))).toEqual({
      symbol: 'dokument',
      unter: 'PDF · 2,4 MB',
    });
    expect(terminDateiAnzeige(datei('Plakat.JPG'))).toEqual({ symbol: 'bild', unter: 'Bild' });
    expect(terminDateiAnzeige(datei('Video.mp4', 5))).toEqual({
      symbol: 'anhang',
      unter: 'Datei · 5 B',
    });
  });

  it('ChordPro am Termin ist eine Datei, kein „Notenblatt“', () => {
    expect(terminDateiAnzeige(datei('Lied.chordpro')).unter).toBe('Datei');
  });

  it('Link: Symbol und Host', () => {
    expect(
      terminDateiAnzeige({ ...datei('Liedtexte'), art: 'link', url: 'https://example.org/a?b' }),
    ).toEqual({ symbol: 'link', unter: 'Link · example.org' });
    expect(terminDateiAnzeige({ ...datei('kaputt'), art: 'link', url: 'nix' }).unter).toBe('Link');
  });
});
