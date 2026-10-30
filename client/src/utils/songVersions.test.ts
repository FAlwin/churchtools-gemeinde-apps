// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { SetlistSong } from '@shared/types/index';
import { einstellungenMitnehmen, notierteTonart, setLsSong, setLsVersion } from './songVersions';
import { pushSetting } from '../services/userSettings';

vi.mock('../services/userSettings', () => ({ pushSetting: vi.fn() }));

/**
 * #398: Jede Version kennt ihre Tonart – und diese Funktion ist die EINE Stelle, die sie nennt.
 *
 * Vorher stand in der Anzeige überall `song.originalKey`, für jede Version. Eine in D geschriebene
 * Fassung eines G-Liedes wurde damit von G aus verschoben. Wer den Versatz an einer zweiten Stelle
 * rechnet, muss hier durch – sonst ist es wieder die halbe Regel.
 */
const song = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({
    id: 1,
    originalKey: 'G',
    targetKey: 'G',
    chordpro: '[G]Original',
    versions: [
      { key: 'akustik', name: 'Akustik', text: '{key: D}\n[D]Text', writtenKey: 'D' },
      { key: 'alt', name: 'Alt', text: '[G]Text', writtenKey: null },
    ],
    documents: [],
    ...over,
  }) as unknown as SetlistSong;

describe('notierteTonart', () => {
  it('das Original steht immer in originalKey', () => {
    expect(notierteTonart(song(), 'original')).toBe('G');
  });

  it('eine Version mit eigener Tonart-Zeile steht in DIESER Tonart', () => {
    expect(notierteTonart(song(), 'akustik')).toBe('D');
  });

  it('ohne eigene Zeile gilt die Tonart des Originals', () => {
    expect(notierteTonart(song(), 'alt')).toBe('G');
  });

  it('eine unbekannte Version fällt auf das Original zurück – nicht auf einen leeren Wert', () => {
    expect(notierteTonart(song(), 'gibt-es-nicht')).toBe('G');
  });
});

describe('setLsSong / setLsVersion – voller Gerätespeicher (#457)', () => {
  it('die Einstellung geht trotzdem ans Konto', () => {
    // Vorher warf `localStorage.setItem` vor `pushSetting` – die Tonart blieb dann nur im Speicher der Seite.
    const voll = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('voll', 'QuotaExceededError');
    });
    expect(() => setLsSong('key', 7, 'A')).not.toThrow();
    expect(() => setLsVersion('key', 7, 'akustik', 'D')).not.toThrow();
    voll.mockRestore();
    expect(vi.mocked(pushSetting).mock.calls.map((c) => c[1])).toEqual(['A', 'D']);
  });
});

/**
 * **Das Aussehen geht mit** (Alwin, 30.10.2026): Nach dem Speichern im Editor stand die neue Version in Schrift 20, einer
 * Spalte und mit Akkorden da – die Einstellungen gelten je Version, und die neue hatte keine.
 */
describe('einstellungenMitnehmen', () => {
  const setze = (werte: Record<string, string>) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(werte)) localStorage.setItem(k, v);
  };

  it('neue Version: Schrift, Spalten, Nur Text, Kapo, Zählweise – nicht Tonart und Abschnitte', () => {
    setze({
      worship_fs_9_original: '28',
      worship_cols_9_original: '2',
      worship_lyrics_9_original: '1',
      worship_capo_9_original: '2',
      worship_zaehl_9_original: '2',
      worship_key_9_original: 'D',
      worship_secshift_9_original: '{"1":2}',
    });
    expect(einstellungenMitnehmen(9, 'original', 'live', 'neu')).toBe(5);
    expect(localStorage.getItem('worship_fs_9_live')).toBe('28');
    expect(localStorage.getItem('worship_cols_9_live')).toBe('2');
    expect(localStorage.getItem('worship_lyrics_9_live')).toBe('1');
    expect(localStorage.getItem('worship_capo_9_live')).toBe('2');
    expect(localStorage.getItem('worship_zaehl_9_live')).toBe('2');
    expect(localStorage.getItem('worship_key_9_live')).toBeNull();
    expect(localStorage.getItem('worship_secshift_9_live')).toBeNull();
  });

  it('umbenannt: alles, auch Tonart und Abschnitte', () => {
    setze({
      worship_key_9_akustik: 'D',
      worship_secshift_9_akustik: '{"1":2}',
      worship_fs_9_akustik: '24',
    });
    expect(einstellungenMitnehmen(9, 'akustik', 'unplugged', 'umbenannt')).toBe(3);
    expect(localStorage.getItem('worship_key_9_unplugged')).toBe('D');
    expect(localStorage.getItem('worship_secshift_9_unplugged')).toBe('{"1":2}');
  });

  it('überschreibt nichts, was an der neuen Version schon steht – und geht ans Konto', () => {
    setze({ worship_fs_9_original: '28', worship_fs_9_live: '16' });
    vi.mocked(pushSetting).mockClear();
    expect(einstellungenMitnehmen(9, 'original', 'live', 'neu')).toBe(0);
    expect(localStorage.getItem('worship_fs_9_live')).toBe('16');
    setze({ worship_cols_9_original: '2' });
    einstellungenMitnehmen(9, 'original', 'live', 'neu');
    expect(vi.mocked(pushSetting)).toHaveBeenCalledWith('worship_cols_9_live', '2');
  });

  it('das Original liest auch seine alten Schlüssel ohne Version (Umzug)', () => {
    setze({ worship_fs_9: '30' });
    einstellungenMitnehmen(9, 'original', 'live', 'neu');
    expect(localStorage.getItem('worship_fs_9_live')).toBe('30');
  });

  it('gleicher Schlüssel (Text geändert, Name gleich): nichts zu tun', () => {
    setze({ worship_fs_9_akustik: '28' });
    expect(einstellungenMitnehmen(9, 'akustik', 'akustik', 'umbenannt')).toBe(0);
  });
});
