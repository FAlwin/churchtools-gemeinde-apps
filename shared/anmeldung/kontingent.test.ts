import { describe, expect, it } from 'vitest';
import { mehrAlsVorgesehen, optionRest, optionenBelegt } from './kontingent';
import type { PreisOption } from './preis';

/** Kontingent je Auswahl (A6-5b, #616): je Anmeldung einmal, wenn jemand einen Platz hat. */
const opt = (name: string, kontingent = 6, belegt = 0, personenJe = 0): PreisOption => ({
  name,
  preisCent: 0,
  kontingent,
  belegt,
  personenJe,
});
const ZWEI = opt('Zweibettzimmer');
const VIER = opt('Vierbettzimmer');

describe('optionenBelegt', () => {
  it('eine Familie (eine Anmelde-Nr.) belegt EIN Zimmer, egal wie viele Personen', () => {
    expect(
      optionenBelegt(
        [ZWEI, VIER],
        [
          { aktiv: true, nr: 'AAAAAA', auswahl: 'Zweibettzimmer' },
          { aktiv: true, nr: 'AAAAAA', auswahl: null },
          { aktiv: true, nr: 'AAAAAA', auswahl: null },
          { aktiv: true, nr: 'BBBBBB', auswahl: 'Vierbettzimmer' },
        ],
      ),
    ).toEqual([1, 1]);
  });

  it('nur auf der Warteliste → belegt nichts; ein Kind mit Platz reicht', () => {
    expect(
      optionenBelegt(
        [ZWEI],
        [
          { aktiv: false, nr: 'AAAAAA', auswahl: 'Zweibettzimmer' },
          { aktiv: false, nr: 'BBBBBB', auswahl: 'Zweibettzimmer' },
          { aktiv: true, nr: 'BBBBBB', auswahl: null },
        ],
      ),
    ).toEqual([1]);
  });

  it('ältere Anmeldungen ohne Nr. zählen je Mitglied mit Auswahl; Leitung ohne Auswahl zählt nicht', () => {
    expect(
      optionenBelegt(
        [ZWEI],
        [
          { aktiv: true, nr: null, auswahl: 'Zweibettzimmer' },
          { aktiv: true, nr: null, auswahl: 'Zweibettzimmer' },
          { aktiv: true, nr: null, auswahl: null },
        ],
      ),
    ).toEqual([2]);
  });
});

describe('optionRest, mehrAlsVorgesehen', () => {
  it('Rest nie unter 0; ohne Kontingent unbegrenzt', () => {
    expect([
      optionRest(opt('a', 6, 4)),
      optionRest(opt('a', 6, 7)),
      optionRest(opt('a', 0, 9)),
    ]).toEqual([2, 0, null]);
  });
  it('mehr Personen als vorgesehen – nur mit Angabe', () => {
    expect([
      mehrAlsVorgesehen(opt('a', 6, 0, 2), 3),
      mehrAlsVorgesehen(opt('a', 6, 0, 2), 2),
      mehrAlsVorgesehen(opt('a', 6, 0, 0), 9),
    ]).toEqual([true, false, false]);
  });
});
