// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leseAuswahl, merkeAuswahl, VORGABE } from './auswahl';
import { leseAnsicht, VORGABE_ANSICHT } from './planenAnsicht';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Im Gerät merken (geraet.ts)', () => {
  it('Speicher wirft (privater Modus) → Vorgabe beim Lesen, Merken stört nicht', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    expect(leseAuswahl()).toEqual(VORGABE);
    expect(leseAnsicht()).toEqual(VORGABE_ANSICHT);
    expect(() => merkeAuswahl({ nurMeine: false, ausgeblendet: [] })).not.toThrow();
  });

  it('Unsinn im Speicher → Vorgabe bzw. nur die gültigen Teile', () => {
    localStorage.setItem('dienstplaner.termine.auswahl', '{kaputt');
    expect(leseAuswahl()).toEqual(VORGABE);
    localStorage.setItem(
      'dienstplaner.planen.ansicht',
      JSON.stringify({ breite: 'xl', unteransicht: 'personen', ausgeblendeteGruppen: [3, 'ohne'] }),
    );
    expect(leseAnsicht()).toEqual({
      breite: 'm',
      unteransicht: 'personen',
      ausgeblendeteGruppen: ['ohne'],
      ausgeblendeteArten: [],
    });
  });
});
