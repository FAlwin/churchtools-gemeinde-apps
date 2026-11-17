// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leseAuswahl, merkeAuswahl, VORGABE } from './auswahl';
import { leseAnsicht, VORGABE_ANSICHT } from './planenAnsicht';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Im Gerät merken (@ui/bedienung/geraet)', () => {
  it('Speicher wirft (privater Modus) → Vorgabe beim Lesen, Merken stört nicht', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    expect(leseAuswahl()).toEqual(VORGABE);
    expect(leseAnsicht()).toEqual(VORGABE_ANSICHT);
    expect(() =>
      merkeAuswahl({ nurMeine: false, ausgeblendet: [], ausgeblendeteKalender: [] }),
    ).not.toThrow();
  });

  it('Unsinn im Speicher → Vorgabe bzw. nur die gültigen Teile', () => {
    localStorage.setItem('dienstplaner.termine.auswahl', '{kaputt');
    expect(leseAuswahl()).toEqual(VORGABE);
    localStorage.setItem(
      'dienstplaner.planen.ansicht',
      JSON.stringify({
        breite: 'xl',
        unteransicht: 'personen',
        ausgeblendeteGruppen: [3, 'ohne'],
        // Dienste nur als Zahlen (Wunsch 10).
        ausgeblendeteDienste: [7, '8', 7, null],
        // Direkte Dienste (P2m, Vorgabe „Anfrage | direkt“): nur Zahlen, ohne Doppelte.
        direktDienste: [6, '9', 6, null],
        // Kalender nur als ganze Zahlen über 0, ohne Doppelte (Wunsch 6).
        ausgeblendeteKalender: [12, '2', 12, 0, 2.5, -1],
        zeitraum: { art: 'eigen', von: '2026-02-30', bis: '2026-03-10' },
        // Unsinn bei „Wer wie oft?“ wird dessen Vorgabe, die letzten 3 Monate (E9-3) – nicht „ab heute“.
        zeitraumWer: { art: 'letzte', monate: 4 },
        // Nur `true` klappt den Ablauf zu (E6-6a) – Text zählt nicht. Dasselbe für „Infos & Dateien“ (T1b).
        ablaufZu: 'ja',
        infosZu: 1,
      }),
    );
    expect(leseAnsicht()).toEqual({
      breite: 'schmal',
      // Der alte Wert `'personen'` (bis 16.11.2026 „Wer wie oft?“) wird zu `werWieOft`.
      unteransicht: 'werWieOft',
      ausgeblendeteGruppen: ['ohne'],
      ausgeblendeteDienste: [7],
      direktDienste: [6],
      ausgeblendeteArten: [],
      ausgeblendeteKalender: [12],
      zeitraum: { art: 'abHeute' },
      zeitraumWer: { art: 'letzte', monate: 3 },
      ablaufZu: false,
      infosZu: false,
    });
  });

  it('die Ansicht: der alte Wert „personen“ war „Wer wie oft?“ und bleibt es – „raster“ ist die neue Ansicht „Personen“', () => {
    const gemerkt = (u: unknown) => {
      localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: u }));
      return leseAnsicht().unteransicht;
    };
    expect(gemerkt('personen')).toBe('werWieOft');
    expect(gemerkt('werWieOft')).toBe('werWieOft');
    expect(gemerkt('raster')).toBe('raster');
    expect(gemerkt('matrix')).toBe('matrix');
    expect(gemerkt('unsinn')).toBe('matrix');
    expect(gemerkt(7)).toBe('matrix');
    // Ohne Eintrag: die Matrix.
    localStorage.removeItem('dienstplaner.planen.ansicht');
    expect(leseAnsicht().unteransicht).toBe('matrix');
  });

  it('gemerktes S/M/L wird schmal/breit (29.10.2026): S und M schmal, L breit', () => {
    for (const [alt, neu] of [
      ['s', 'schmal'],
      ['m', 'schmal'],
      ['l', 'breit'],
      ['schmal', 'schmal'],
      ['breit', 'breit'],
    ]) {
      localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ breite: alt }));
      expect(leseAnsicht().breite).toBe(neu);
    }
  });

  it('ein gemerkter Monat bzw. eigener Zeitraum bleibt (Zeitraum-Knopf, 14.10.2026)', () => {
    for (const zeitraum of [
      { art: 'monat', monat: '2026-11' },
      { art: 'eigen', von: '2026-10-20', bis: '2026-11-10' },
    ]) {
      localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ zeitraum }));
      expect(leseAnsicht().zeitraum).toEqual(zeitraum);
    }
  });
});
