import { describe, expect, it } from 'vitest';
import { GRUPPE_AB, listenForm, TABELLE_AB } from './useKastenBreite';

describe('listenForm – Karten, Tabelle, Tabelle ohne Gruppe', () => {
  it('unbekannte Breite: Karten (so startet jede Seite, auch ohne ResizeObserver)', () => {
    expect(listenForm(null)).toBe('karten');
  });
  it('unter 720 px Karten, ab 720 Tabelle ohne Gruppe, ab 860 mit Gruppe', () => {
    expect(listenForm(TABELLE_AB - 1)).toBe('karten');
    expect(listenForm(TABELLE_AB)).toBe('tabelleOhneGruppe');
    expect(listenForm(GRUPPE_AB - 1)).toBe('tabelleOhneGruppe');
    expect(listenForm(GRUPPE_AB)).toBe('tabelle');
    expect(listenForm(1100)).toBe('tabelle');
  });
});
