// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Die Weiche in `annotations.ts` und `userSettings.ts` im **Extension-Modus** (#334): Geholt und
 * geschrieben wird über die Personen-Dateien, nicht über den eigenen Server – und ein fehlendes Recht
 * (`KeinSpeicherRecht`) schaltet den Abgleich ab und SAGT es, statt alle fünf Sekunden vergeblich zu
 * wiederholen oder still aufzuhören. Die Ablage selbst ist in `personenAblage.test.ts` geprüft; hier
 * ist sie ersetzt.
 */
vi.mock('./ctRuntime', async (original) => ({
  ...(await original<typeof import('./ctRuntime')>()),
  istExtension: true,
}));
vi.mock('./personenAblage', () => ({
  holeAnmerkungen: vi.fn(),
  schreibeAnmerkung: vi.fn(),
  holeEinstellungen: vi.fn(),
  schreibeEinstellungen: vi.fn(),
}));

import * as ablage from './personenAblage';
import { KeinSpeicherRecht } from './ctRuntime';
import {
  pullAnnotations,
  pushField,
  resetSync as resetAnno,
  setAnnotationsSyncErrorHandler,
} from './annotations';
import {
  pullSettings,
  pushSetting,
  resetSync as resetSettings,
  setSettingsSyncErrorHandler,
} from './userSettings';
import { markReachable } from './reachability';

const SEITE = 'song7_voriginal_0';
const kein = () => new KeinSpeicherRecht('Darfst du nicht.');

async function debounce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(700);
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetAnno();
  resetSettings();
  markReachable(true);
  setAnnotationsSyncErrorHandler(null);
  setSettingsSyncErrorHandler(null);
  vi.mocked(ablage.schreibeAnmerkung).mockResolvedValue(undefined);
  vi.mocked(ablage.schreibeEinstellungen).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  resetAnno();
  resetSettings();
});

describe('Anmerkungen in der Extension', () => {
  it('schreiben über die Personen-Dateien, nicht über fetch an den eigenen Server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    pushField(`worship_docdraw_${SEITE}`, 'strokes', 'data:image/png;base64,AA==');
    await debounce();
    expect(ablage.schreibeAnmerkung).toHaveBeenCalledWith(SEITE, {
      strokes: 'data:image/png;base64,AA==',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('holen über die Personen-Dateien und in den localStorage spiegeln', async () => {
    vi.mocked(ablage.holeAnmerkungen).mockResolvedValue({ [SEITE]: { strokes: 'data:x' } });
    await pullAnnotations([7]);
    expect(ablage.holeAnmerkungen).toHaveBeenCalledWith([7]);
    expect(localStorage.getItem(`worship_docdraw_${SEITE}`)).toBe('data:x');
  });

  it('fehlendes Recht: einmal sagen, Abgleich aus, Merker bleibt für später', async () => {
    const meldung = vi.fn();
    setAnnotationsSyncErrorHandler(meldung);
    vi.mocked(ablage.schreibeAnmerkung).mockRejectedValue(kein());
    pushField(`worship_docdraw_${SEITE}`, 'strokes', 'data:a');
    await debounce();
    expect(meldung).toHaveBeenCalledTimes(1);
    expect(meldung).toHaveBeenCalledWith('Darfst du nicht.');
    // Kein Wiederholen alle 5 s – und keine weiteren Versuche bei neuen Strichen.
    await vi.advanceTimersByTimeAsync(20_000);
    pushField(`worship_docdraw_${SEITE}`, 'strokes', 'data:b');
    await debounce();
    expect(ablage.schreibeAnmerkung).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('worship_anno_pending_v1')).toContain(SEITE);
  });
});

describe('Einstellungen in der Extension', () => {
  it('schreiben über die Personen-Dateien', async () => {
    pushSetting('worship_key_7', 'G');
    await debounce();
    expect(ablage.schreibeEinstellungen).toHaveBeenCalledWith({ worship_key_7: 'G' });
  });

  it('holen über die Personen-Dateien', async () => {
    vi.mocked(ablage.holeEinstellungen).mockResolvedValue({ worship_key_7: 'A' });
    await pullSettings([7]);
    expect(localStorage.getItem('worship_key_7')).toBe('A');
  });

  it('fehlendes Recht: einmal sagen, Abgleich aus, Merker bleibt für später', async () => {
    const meldung = vi.fn();
    setSettingsSyncErrorHandler(meldung);
    vi.mocked(ablage.schreibeEinstellungen).mockRejectedValue(kein());
    pushSetting('worship_key_7', 'G');
    await debounce();
    expect(meldung).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    pushSetting('worship_key_7', 'A');
    await debounce();
    expect(ablage.schreibeEinstellungen).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('worship_settings_pending_v1')).toContain('worship_key_7');
  });
});
