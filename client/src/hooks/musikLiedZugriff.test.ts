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
    expect(musikLiedZugriff.useRechte()).toEqual({ statistik: true, ccli: false });
    caps.data = { canViewSongStatistics: false, canUseCcli: true };
    expect(musikLiedZugriff.useRechte()).toEqual({ statistik: false, ccli: true });
  });

  it('gibt dem Editor die Liedansicht des Geräts und das Logo der Gemeinde – dieselben wie das Liedblatt', async () => {
    vi.resetModules();
    const { musikLiedZugriff } = await import('./musikLiedZugriff');
    expect(musikLiedZugriff.liedansicht()).toBe('scrollen');
    expect(editor.ansicht).toHaveBeenCalled();
    expect(musikLiedZugriff.useBlattLogo).toBe(editor.logo);
  });
});
