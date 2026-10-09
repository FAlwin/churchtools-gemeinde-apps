// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pullAnnotations, pushField, resetSync as resetAnno } from './annotations';
import { pullSettings, resetSync as resetEinst } from './userSettings';
import { setSessionExpiredHandler } from './api';

/**
 * **Was auf dem Konto fehlt, bleibt nicht auf dem Gerät stehen** (09.10.2026). Vorher übernahm der
 * Abgleich nur, was das Konto liefert: Eine anderswo GANZ geleerte Seite und eine anderswo
 * zurückgesetzte Einstellung blieben hier als alte Kopie sichtbar. Geprüft wird über die echten
 * Abgleiche – und jede Schutzbedingung einzeln, denn hier wird gelöscht.
 */
const SEITE = 'worship_docdraw_song7_a70_voriginal_0';
const SEITE9 = 'worship_docdraw_song9_a90_voriginal_0';
const SEITE11 = 'worship_docdraw_song11_a110_voriginal_0';
const ANDERES_LIED = 'worship_docdraw_song8_a80_voriginal_0';
const ANNO_UMGEZOGEN = 'worship_anno_migrated_v1';
const EINST_UMGEZOGEN = 'worship_settings_migrated_v1';

function antwort(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  resetAnno();
  resetEinst();
  setSessionExpiredHandler(null);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Anmerkungen', () => {
  it('eine anderswo ganz geleerte Seite verschwindet – Texte und Zoom mit', async () => {
    localStorage.setItem(ANNO_UMGEZOGEN, '1');
    localStorage.setItem(SEITE, 'data:image/png;base64,AAA');
    localStorage.setItem(`${SEITE}_text`, '[{"id":1}]');
    localStorage.setItem(ANDERES_LIED, 'data:image/png;base64,BBB');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(antwort({}))),
    );
    await pullAnnotations([7]);
    expect(localStorage.getItem(SEITE)).toBeNull();
    expect(localStorage.getItem(`${SEITE}_text`)).toBeNull();
    // Nach Lied 8 wurde nicht gefragt – darüber sagt die Antwort nichts.
    expect(localStorage.getItem(ANDERES_LIED)).not.toBeNull();
  });

  it('wartet die Seite noch aufs Hochladen, bleibt sie', async () => {
    vi.useFakeTimers();
    localStorage.setItem(ANNO_UMGEZOGEN, '1');
    localStorage.setItem(SEITE, 'data:image/png;base64,NEU');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(antwort({}))),
    );
    pushField(SEITE, 'strokes', 'data:image/png;base64,NEU'); // noch nicht hochgeladen
    await pullAnnotations([7]);
    expect(localStorage.getItem(SEITE)).toBe('data:image/png;base64,NEU');
  });

  it('ohne übertragenen Altbestand wird nichts entfernt', async () => {
    // Eigenes Lied: Die Warteschlange im Speicher überlebt `resetSync` – die Seite aus dem Test davor
    // stünde dort noch und schützte diese aus dem falschen Grund (Gegenprobe 09.10.2026).
    localStorage.setItem(SEITE9, 'data:image/png;base64,ALT');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(antwort({}))),
    );
    await pullAnnotations([9]);
    expect(localStorage.getItem(SEITE9)).toBe('data:image/png;base64,ALT');
  });

  it('scheitert der Abgleich, bleibt alles', async () => {
    localStorage.setItem(ANNO_UMGEZOGEN, '1');
    localStorage.setItem(SEITE11, 'data:image/png;base64,AAA');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    await pullAnnotations([11]);
    expect(localStorage.getItem(SEITE11)).not.toBeNull();
  });
});

describe('Lied-Einstellungen', () => {
  it('eine anderswo zurückgesetzte Tonart verschwindet, was das Konto kennt, bleibt', async () => {
    localStorage.setItem(EINST_UMGEZOGEN, '1');
    localStorage.setItem('worship_key_7_original', 'D');
    localStorage.setItem('worship_capo_7_original', '2');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(antwort({ worship_capo_7_original: '2' }))),
    );
    await pullSettings([7]);
    expect(localStorage.getItem('worship_key_7_original')).toBeNull();
    expect(localStorage.getItem('worship_capo_7_original')).toBe('2');
  });

  it('ohne übertragenen Altbestand wird nichts entfernt', async () => {
    localStorage.setItem('worship_key_7_original', 'D');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(antwort({}))),
    );
    await pullSettings([7]);
    expect(localStorage.getItem('worship_key_7_original')).toBe('D');
  });
});
