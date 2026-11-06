import { describe, it, expect, vi } from 'vitest';

/**
 * Der Liedzugriff der Musik-App (LW1a, 06.11.2026) – er muss genau das weitergeben, was die Liedwahl vor dem Umzug
 * selbst gefragt hat: die Liedtext-Suche nur, wo `funktionen` sie kennt (nicht in der Erweiterung), und die Rechte
 * aus `useCapabilities`.
 */
const f = vi.hoisted(() => ({ liedtextSuche: false }));
const caps = vi.hoisted((): { data: unknown } => ({ data: undefined }));
vi.mock('../services/funktionen', () => ({ funktionen: f }));
vi.mock('./useServices', () => ({ useCapabilities: () => caps }));
// Für den Editor (LW1b-1): Erkennungsmarken statt der echten Funktionen – geprüft wird, DASS sie durchgereicht werden.
const editor = vi.hoisted(() => ({ ansicht: vi.fn(() => 'scrollen'), logo: vi.fn(() => null) }));
vi.mock('../utils/devicePrefs', () => ({ getLiedansicht: editor.ansicht }));
vi.mock('./useAppLogo', () => ({ useAppLogo: editor.logo }));

describe('musikLiedZugriff', () => {
  it('hat keine Liedtext-Suche, wo funktionen sie nicht kennt (Erweiterung)', async () => {
    vi.resetModules();
    f.liedtextSuche = false;
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    expect(musikLiedZugriff.liedtextSuche).toBeUndefined();
  });

  it('hat sie mit Server', async () => {
    vi.resetModules();
    f.liedtextSuche = true;
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    expect(musikLiedZugriff.liedtextSuche).toBeTypeOf('function');
  });

  it('gibt die Rechte für Statistik und SongSelect weiter – und nichts, solange sie laden', async () => {
    vi.resetModules();
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    caps.data = undefined;
    expect(musikLiedZugriff.useRechte()).toBeUndefined();
    caps.data = { canViewSongStatistics: true, canUseCcli: false };
    expect(musikLiedZugriff.useRechte()).toEqual({
      statistik: true,
      ccli: false,
      liederAendern: false,
    });
    caps.data = { canViewSongStatistics: false, canUseCcli: true, canEditSongs: true };
    expect(musikLiedZugriff.useRechte()).toEqual({
      statistik: false,
      ccli: true,
      liederAendern: true,
    });
  });

  it('gibt dem Editor die Liedansicht des Geräts und das Logo der Gemeinde – dieselben wie das Liedblatt', async () => {
    vi.resetModules();
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    expect(musikLiedZugriff.liedansicht()).toBe('scrollen');
    expect(editor.ansicht).toHaveBeenCalled();
    expect(musikLiedZugriff.useBlattLogo).toBe(editor.logo);
  });

  /* ------------------------------------------------------------ „Neues Lied" und Liedinfo (LW1b-2) */

  it('nennt nur einen 502 beim Anlegen „ungewiss" – andere Fehler sind eindeutig abgelehnt', async () => {
    vi.resetModules();
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    const { ApiError } = await import('../services/api');
    expect(musikLiedZugriff.anlegenUngewiss(new ApiError(502, 'ohne Arrangement'))).toBe(true);
    expect(musikLiedZugriff.anlegenUngewiss(new ApiError(409, 'CCLI schon vergeben'))).toBe(false);
    expect(musikLiedZugriff.anlegenUngewiss(new ApiError(403, 'abgelehnt'))).toBe(false);
    expect(musikLiedZugriff.anlegenUngewiss(new Error('Netz'))).toBe(false);
  });

  it('lädt nach einer Änderung genau die Musik-App-Speicher neu, die vorher in useServices/useNotenblatt standen', async () => {
    vi.resetModules();
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    const { schluessel } = await import('./abfrageSchluessel');
    const qc = {
      invalidateQueries: vi.fn(),
    } as unknown as import('@tanstack/react-query').QueryClient;
    const neu = () =>
      (qc.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => (c[0] as { queryKey: unknown }).queryKey,
      );

    musikLiedZugriff.nachAenderung(qc, { art: 'lied', songId: 7 });
    expect(neu()).toEqual([schluessel.liedblaetter(7), schluessel.agendaAlle()]);

    (qc.invalidateQueries as ReturnType<typeof vi.fn>).mockClear();
    musikLiedZugriff.nachAenderung(qc, { art: 'arrangement', songId: 7 });
    expect(neu()).toEqual([schluessel.liedblaetter(7), schluessel.liedArrangements(7)]);

    (qc.invalidateQueries as ReturnType<typeof vi.fn>).mockClear();
    musikLiedZugriff.nachAenderung(qc, { art: 'notenblatt', songId: 7 });
    expect(neu()).toEqual([schluessel.liedblaetter(7)]);
  });

  it('liest das Notenblatt aus dem Liedblatt – ohne Text gibt es keins', async () => {
    vi.resetModules();
    const api = await import('../services/churchtoolsApi');
    const blatt = vi.spyOn(api, 'getSongChart');
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    blatt.mockResolvedValueOnce({ chordpro: '{title: Treu}' } as Awaited<
      ReturnType<typeof api.getSongChart>
    >);
    expect(await musikLiedZugriff.notenblattLesen(77, 500)).toBe('{title: Treu}');
    expect(blatt).toHaveBeenCalledWith(77, 500);
    blatt.mockResolvedValueOnce({ chordpro: '' } as Awaited<ReturnType<typeof api.getSongChart>>);
    expect(await musikLiedZugriff.notenblattLesen(77, 500)).toBeNull();
  });
});
