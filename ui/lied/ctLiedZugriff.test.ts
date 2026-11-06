import { describe, it, expect, vi } from 'vitest';
import * as ct from '../ct/lieder';
import { ApiError } from '../ct/fehler';
import { ctLiedZugriff } from './ctLiedZugriff';
import { anlegenUngewissAus, liedRechteAus, notenblattTextAus } from './liedZugriff';

/**
 * Der Liedzugriff einer Erweiterung, die ChurchTools direkt anspricht (Dienstplaner, LW2b, 06.11.2026): dieselben
 * Wege wie die Musik-App als Erweiterung (`ui/ct/lieder`), also auch dieselben Zwischenspeicher.
 */
const app = {
  useRechte: () => ({ statistik: true, ccli: false, liederAendern: true }),
  liedansicht: () => 'blaettern' as const,
  useBlattLogo: () => null,
  nachAenderung: vi.fn(),
};

describe('ctLiedZugriff', () => {
  it('nimmt die gemeinsamen Lied-Wege – keine eigene Fassung', () => {
    const z = ctLiedZugriff(app);
    expect(z.liederliste).toBe(ct.lieder);
    expect(z.nutzung).toBe(ct.liedNutzung);
    expect(z.liedtextVorschau).toBe(ct.liedtextVorschau);
    expect(z.songSelectSuche).toBe(ct.songSelectSuche);
    expect(z.songSelectLied).toBe(ct.songSelectLiedHolen);
    expect(z.songSelectLiedtext).toBe(ct.songSelectLiedtextHolen);
    expect(z.kategorien).toBe(ct.bearbeitbareKategorien);
    expect(z.liedAnlegen).toBe(ct.liedNeu);
    expect(z.stammdaten).toBe(ct.liedStammdatenAnsicht);
    expect(z.liedAendern).toBe(ct.liedAendern);
    expect(z.arrangements).toBe(ct.arrangementVerwaltung);
    expect(z.arrangementAendern).toBe(ct.arrangement);
    expect(z.anlegenUngewiss).toBe(anlegenUngewissAus);
  });

  it('ohne Server keine Suche im Liedtext (#300)', () => {
    expect(ctLiedZugriff(app).liedtextSuche).toBeUndefined();
  });

  it('übernimmt, was die App beisteuert', () => {
    const z = ctLiedZugriff(app);
    expect(z.useRechte).toBe(app.useRechte);
    expect(z.liedansicht).toBe(app.liedansicht);
    expect(z.useBlattLogo).toBe(app.useBlattLogo);
    expect(z.nachAenderung).toBe(app.nachAenderung);
  });

  it('Notenblatt lesen, schreiben und aus SongSelect holen – über die gemeinsamen Wege', async () => {
    const blatt = vi
      .spyOn(ct, 'blatt')
      .mockResolvedValue({ chordpro: '' } as Awaited<ReturnType<typeof ct.blatt>>);
    const schreiben = vi.spyOn(ct, 'notenblatt').mockResolvedValue([]);
    const ccli = vi.spyOn(ct, 'notenblattAusCcli').mockResolvedValue([]);
    const z = ctLiedZugriff(app);
    expect(await z.notenblattLesen(7, 70)).toBeNull();
    expect(blatt).toHaveBeenCalledWith(7, 70);
    await z.notenblattSpeichern(7, 70, '{title: X}');
    expect(schreiben).toHaveBeenCalledWith(7, 70, '{title: X}');
    await z.notenblattAusSongSelect(7, 70, 123);
    expect(ccli).toHaveBeenCalledWith(7, 70, 123);
  });
});

/** Die Regeln, die Musik-App und Dienstplaner teilen (LW2b) – je Zweig für sich. */
describe('gemeinsame Regeln des Liedzugriffs', () => {
  it('liedRechteAus: jedes Recht für sich, fehlende sind „nein“', () => {
    expect(
      liedRechteAus({ canViewSongStatistics: true, canUseCcli: false, canEditSongs: false }),
    ).toEqual({
      statistik: true,
      ccli: false,
      liederAendern: false,
    });
    expect(
      liedRechteAus({ canViewSongStatistics: false, canUseCcli: true, canEditSongs: false }).ccli,
    ).toBe(true);
    expect(
      liedRechteAus({ canViewSongStatistics: false, canUseCcli: false, canEditSongs: true })
        .liederAendern,
    ).toBe(true);
  });

  it('anlegenUngewissAus: nur ein 502 ist „vielleicht doch angelegt“', () => {
    expect(anlegenUngewissAus(new ApiError(502, 'ohne Arrangement'))).toBe(true);
    expect(anlegenUngewissAus(new ApiError(409, 'CCLI schon vergeben'))).toBe(false);
    expect(anlegenUngewissAus(new ApiError(403, 'abgelehnt'))).toBe(false);
    expect(anlegenUngewissAus(new Error('Netz'))).toBe(false);
  });

  it('notenblattTextAus: ohne Text kein Blatt', () => {
    expect(notenblattTextAus({ chordpro: '{title: X}' })).toBe('{title: X}');
    expect(notenblattTextAus({ chordpro: '' })).toBeNull();
    expect(notenblattTextAus({ chordpro: null })).toBeNull();
    expect(notenblattTextAus({})).toBeNull();
  });
});
