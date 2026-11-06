import { describe, it, expect } from 'vitest';
import type { SongSelectTreffer } from '@shared/types/index';
import {
  CCLI_NUMMER_STELLEN_FUER_AUTO,
  automatischSuchen,
  sucheArt,
  trefferUnterzeile,
} from './suchRegeln';

/** Die Such-Regeln der Liedwahl (bis 06.11.2026 in `liedFormular.test.ts`). */

const TREFFER: SongSelectTreffer = {
  songNumber: 5841527,
  title: 'Treu',
  authors: ['Autor A', 'Autor B'],
  defaultKey: 'E',
  isPublicDomain: false,
  hasLyrics: true,
  hasChordPro: true,
  hasChordSheet: true,
};

describe('trefferUnterzeile', () => {
  it('nennt Autoren und Nummer – die Merkmale, die unscharfe Treffer unterscheidbar machen', () => {
    expect(trefferUnterzeile(TREFFER)).toBe('Autor A, Autor B · Nr. 5841527 · Akkorde');
  });

  it('sagt, wenn es nur ein PDF oder nur Text gibt', () => {
    expect(trefferUnterzeile({ ...TREFFER, hasChordPro: false })).toContain('nur Notenblatt (PDF)');
    expect(trefferUnterzeile({ ...TREFFER, hasChordPro: false, hasChordSheet: false })).toContain(
      'nur Text',
    );
  });

  it('kommt ohne Autoren aus', () => {
    expect(trefferUnterzeile({ ...TREFFER, authors: [] })).toBe('Nr. 5841527 · Akkorde');
  });

  it('nennt gemeinfrei', () => {
    expect(trefferUnterzeile({ ...TREFFER, isPublicDomain: true })).toContain('gemeinfrei');
  });
});

describe('sucheArt – Titel oder CCLI-Nummer', () => {
  it('reine Ziffern sind eine Nummer', () => {
    expect(sucheArt('5841527')).toEqual({ art: 'nummer', nummer: 5841527 });
  });

  it('Leerzeichen drumherum stören nicht', () => {
    expect(sucheArt('  5841527  ')).toEqual({ art: 'nummer', nummer: 5841527 });
  });

  it('alles mit Buchstaben ist ein Titel – auch mit Zahl darin', () => {
    // „Psalm 23" ist ein Titel. Nur wenn NICHTS außer Ziffern da ist, wird abgefragt.
    expect(sucheArt('Psalm 23')).toEqual({ art: 'titel', titel: 'Psalm 23' });
    expect(sucheArt('Treu')).toEqual({ art: 'titel', titel: 'Treu' });
  });

  it('eine Zahl mit Bindestrich oder Punkt ist ein Titel', () => {
    // Sonst würde aus einer Jahresangabe oder einem Datum stillschweigend eine Nummer.
    expect(sucheArt('2019-2020').art).toBe('titel');
    expect(sucheArt('1.2.3').art).toBe('titel');
  });

  it('liefert den Titel getrimmt zurück', () => {
    expect(sucheArt('  Treu  ')).toEqual({ art: 'titel', titel: 'Treu' });
  });
});

describe('automatischSuchen – wann von selbst gesucht wird', () => {
  const MIN = 3;

  it('ein Titel ab der Mindestlänge', () => {
    expect(automatischSuchen('Tr', MIN)).toBe(false);
    expect(automatischSuchen('Tre', MIN)).toBe(true);
  });

  it('eine Nummer erst, wenn sie vollständig aussieht', () => {
    /**
     * Gemessen: Alle 46 CCLI-Nummern im Bestand haben 7 Stellen. Ohne diese Schwelle würde beim Tippen
     * von „5841527" viermal „findet CCLI kein Lied" erscheinen, bevor die Nummer fertig ist.
     */
    expect(automatischSuchen('584', MIN)).toBe(false);
    expect(automatischSuchen('584152', MIN)).toBe(false);
    expect(automatischSuchen('5841527', MIN)).toBe(true);
  });

  it('nutzt die Schwelle aus der Konstante, nicht eine eigene Zahl', () => {
    const knapp = '9'.repeat(CCLI_NUMMER_STELLEN_FUER_AUTO - 1);
    const genau = '9'.repeat(CCLI_NUMMER_STELLEN_FUER_AUTO);
    expect(automatischSuchen(knapp, MIN)).toBe(false);
    expect(automatischSuchen(genau, MIN)).toBe(true);
  });

  it('zählt Leerzeichen nicht mit', () => {
    expect(automatischSuchen('  Tre  ', MIN)).toBe(true);
    expect(automatischSuchen('   ', MIN)).toBe(false);
  });
});
