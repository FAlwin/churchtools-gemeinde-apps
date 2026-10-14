// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLiedansicht, setLiedansicht } from './devicePrefs';
import { clearDeviceData } from './clearDeviceData';

/** Liedansicht blättern/scrollen (#551): eine Vorliebe dieses Geräts, nicht des Kontos. */
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Liedansicht', () => {
  it('ohne Angabe: blättern, wie bisher', () => {
    expect(getLiedansicht()).toBe('blaettern');
  });

  it('merkt sich scrollen und wieder blättern', () => {
    setLiedansicht('scrollen');
    expect(getLiedansicht()).toBe('scrollen');
    setLiedansicht('blaettern');
    expect(getLiedansicht()).toBe('blaettern');
  });

  it('Unsinn im Speicher gilt als blättern', () => {
    localStorage.setItem('worship:liedansicht', 'quer');
    expect(getLiedansicht()).toBe('blaettern');
  });

  it('gesperrter Speicher (privater Modus): blättern, kein Fehler', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    expect(getLiedansicht()).toBe('blaettern');
  });

  it('übersteht das Abmelden – es ist eine Geräte-Vorliebe ohne Personenbezug', async () => {
    setLiedansicht('scrollen');
    await clearDeviceData();
    expect(getLiedansicht()).toBe('scrollen');
  });
});
