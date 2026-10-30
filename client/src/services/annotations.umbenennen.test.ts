// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ANNO_DRAW_NS, ANNO_ZOOM_NS, songPageKey } from '@shared/keys/index';
import { VIEW_NS } from './teamNotes';
import { anmerkungenMitnehmen, resetSync, setAnnotationsSyncErrorHandler } from './annotations';
import { textSchluessel } from '../utils/annotationKeys';
import { markReachable } from './reachability';
import { setSessionExpiredHandler } from './api';

/**
 * **Anmerkungen einer umbenannten Version gehen mit** (30.10.2026). Ein neuer Versionsname ist ein neuer Schlüssel –
 * vorher lagen Striche, Texte und Zoom danach unter dem alten und waren auf jedem Gerät unsichtbar.
 *
 * Die Schlüssel kommen aus den Erzeugern (`songPageKey`, `textSchluessel`, Namensräume aus `@shared/keys`), nicht aus
 * handgeschriebenen Literalen – sonst bliebe der Test genau bei dem Fehler grün, für den er geschrieben ist.
 */
const ALT = songPageKey(12, 'akustik', false, 1);
const ALT_LYR = songPageKey(12, 'akustik', true, 2);
const NEU = songPageKey(12, 'unplugged', false, 1);
const NEU_LYR = songPageKey(12, 'unplugged', true, 2);
const ANDERE = songPageKey(12, 'live', false, 1);

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetSync();
  markReachable(true);
  setSessionExpiredHandler(null);
  setAnnotationsSyncErrorHandler(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetSync();
});

describe('anmerkungenMitnehmen', () => {
  it('Striche, Texte und Zoom stehen danach unter dem neuen Schlüssel – der alte bleibt', async () => {
    localStorage.setItem(ANNO_DRAW_NS + ALT, 'STRICHE');
    localStorage.setItem(
      textSchluessel(ANNO_DRAW_NS + ALT),
      JSON.stringify([{ id: 't1', text: 'leise' }]),
    );
    localStorage.setItem(ANNO_ZOOM_NS + ALT, JSON.stringify({ s: 1.5 }));
    localStorage.setItem(ANNO_DRAW_NS + ALT_LYR, 'NUR-TEXT-STRICHE');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200)));

    expect(anmerkungenMitnehmen(12, 'akustik', 'unplugged')).toBe(2);
    expect(localStorage.getItem(ANNO_DRAW_NS + NEU)).toBe('STRICHE');
    expect(localStorage.getItem(textSchluessel(ANNO_DRAW_NS + NEU))).toContain('leise');
    expect(localStorage.getItem(ANNO_ZOOM_NS + NEU)).toContain('1.5');
    expect(localStorage.getItem(ANNO_DRAW_NS + NEU_LYR)).toBe('NUR-TEXT-STRICHE');
    expect(localStorage.getItem(ANNO_DRAW_NS + ALT)).toBe('STRICHE');
    // Die Warteschlange ist modulweit – den Upload abschließen, sonst zählt ihn der nächste Test mit.
    await vi.advanceTimersByTimeAsync(700);
  });

  it('geht über den normalen Upload-Weg ans Konto – eine Seite, alle Felder', async () => {
    localStorage.setItem(ANNO_DRAW_NS + ALT, 'STRICHE');
    localStorage.setItem(ANNO_ZOOM_NS + ALT, JSON.stringify({ s: 1.5 }));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    anmerkungenMitnehmen(12, 'akustik', 'unplugged');
    await vi.advanceTimersByTimeAsync(700);

    const puts = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(puts).toHaveLength(1);
    const [url, init] = puts[0] as [string, RequestInit];
    expect(decodeURIComponent(url)).toContain(`/api/annotations/${NEU}`);
    expect(JSON.parse(String(init.body))).toEqual({ strokes: 'STRICHE', zoom: { s: 1.5 } });
  });

  it('überschreibt nichts, nimmt fremde Notizen (Team-Ansicht) und andere Versionen nicht mit', () => {
    localStorage.setItem(ANNO_DRAW_NS + ALT, 'ALT');
    localStorage.setItem(ANNO_DRAW_NS + NEU, 'SCHON-DA');
    localStorage.setItem(VIEW_NS + ALT, 'FREMD');
    localStorage.setItem(ANNO_DRAW_NS + ANDERE, 'LIVE');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200)));

    expect(anmerkungenMitnehmen(12, 'akustik', 'unplugged')).toBe(0);
    expect(localStorage.getItem(ANNO_DRAW_NS + NEU)).toBe('SCHON-DA');
    expect(localStorage.getItem(VIEW_NS + NEU)).toBeNull();
    const unterNeu = Object.keys(localStorage).filter((k) => k.includes('_vunplugged'));
    expect(unterNeu).toEqual([ANNO_DRAW_NS + NEU]);
  });

  it('gleicher Schlüssel: nichts zu tun', () => {
    localStorage.setItem(ANNO_DRAW_NS + ALT, 'ALT');
    expect(anmerkungenMitnehmen(12, 'akustik', 'akustik')).toBe(0);
  });
});
