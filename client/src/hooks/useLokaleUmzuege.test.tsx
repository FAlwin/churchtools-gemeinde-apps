// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SetlistSong } from '@shared/types/index';
import { versionNameBisher, versionNameOf, versionSlug } from '@shared/ct/arrangementFiles';
import { useLokaleUmzuege } from './useLokaleUmzuege';

vi.mock('../services/userSettings', () => ({ pushSetting: vi.fn() }));

/**
 * Die zwei Schlüssel-Umzüge des Liedblatts (#465: aus `useMemo` in `useLayoutEffect`). Geprüft wird,
 * dass sie wirklich laufen und dass die Einstellungen danach NEU gelesen werden – `useSongSettings`
 * hat sie beim ersten Rendern schon vom alten Stand gelesen.
 */
const DATEI = { name: 'Testlied 3b-2 — Akustik (App).chordpro', fileUrl: 'x' };
const NEU = versionSlug(versionNameOf(DATEI) ?? '');
const ALT = versionSlug(versionNameBisher(DATEI) ?? '');
const lied = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({
    id: 24,
    arrangementId: 30,
    chordpro: '',
    versions: [{ key: NEU, alterKey: ALT, name: 'Akustik', text: '', writtenKey: null }],
    documents: [],
    ...over,
  }) as SetlistSong;

beforeEach(() => localStorage.clear());

describe('useLokaleUmzuege', () => {
  it('Versions-Umzug: Schlüssel kopiert, gewählte Version mitgezogen, Einstellungen neu gelesen', () => {
    localStorage.setItem(`worship_key_24_${ALT}`, 'D');
    localStorage.setItem('worship_ver_24', ALT);
    const reload = vi.fn();
    const songs = [lied()];
    renderHook(() => useLokaleUmzuege(songs, songs, reload));
    expect(localStorage.getItem(`worship_key_24_${NEU}`)).toBe('D');
    expect(localStorage.getItem('worship_ver_24')).toBe(NEU);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('nichts umzuziehen → kein unnötiges Neulesen', () => {
    const reload = vi.fn();
    const songs = [lied({ versions: [] })];
    renderHook(() => useLokaleUmzuege(songs, songs, reload));
    expect(reload).not.toHaveBeenCalled();
  });

  it('Arrangement-Umzug: Bestandsnotizen unter dem neuen Schlüssel (#320)', () => {
    localStorage.setItem('worship_docdraw_song24_voriginal_0', 'striche');
    const songs = [lied({ versions: [] })];
    renderHook(() => useLokaleUmzuege(songs, songs, vi.fn()));
    expect(localStorage.getItem('worship_docdraw_song24_a30_voriginal_0')).toBe('striche');
  });
});
