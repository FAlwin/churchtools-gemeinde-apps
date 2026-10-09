import { describe, expect, it } from 'vitest';
import { fensterAnsicht } from './useChartOverlay';

/** Was aus dem EINEN Fenster-Feld folgt (#283, herausgelöst in #465) – vorher inline im JSX. */
describe('fensterAnsicht', () => {
  it('ChartOverlays sieht nur seine eigenen Namen', () => {
    for (const eigen of ['key', 'capo', 'sec', 'appearance', 'menu'] as const)
      expect(fensterAnsicht(eigen).chartOverlay).toBe(eigen);
    for (const fremd of ['tempo', 'files', 'stammdaten', 'werkzeuge'] as const)
      expect(fensterAnsicht(fremd).chartOverlay).toBeNull();
  });

  it('Werkzeug-Fenster: Werkzeuge-Menü, Aussehen, Tempo', () => {
    expect(fensterAnsicht('appearance').offenesWerkzeug).toBe('aussehen');
    expect(fensterAnsicht('tempo').offenesWerkzeug).toBe('tempo');
    expect(fensterAnsicht('menu').offenesWerkzeug).toBeNull();
    expect(fensterAnsicht('werkzeuge').werkzeugeOffen).toBe(true);
    for (const o of ['werkzeuge', 'appearance', 'tempo'] as const)
      expect(fensterAnsicht(o).werkzeugFensterOffen).toBe(true);
    expect(fensterAnsicht('menu').werkzeugFensterOffen).toBe(false);
  });

  it('Lied-Fenster: Menü, Tonart, Kapo, Abschnitte, Dateien, Stammdaten', () => {
    for (const o of ['menu', 'key', 'capo', 'sec', 'files', 'stammdaten'] as const)
      expect(fensterAnsicht(o).liedFensterOffen).toBe(true);
    for (const o of ['appearance', 'tempo', 'werkzeuge', null] as const)
      expect(fensterAnsicht(o).liedFensterOffen).toBe(false);
  });
});
