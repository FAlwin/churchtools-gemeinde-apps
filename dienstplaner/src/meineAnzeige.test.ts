import { describe, expect, it } from 'vitest';
import type { DatenDatei } from '@shared/ct/personenAblage';
import { ANZEIGE_FELDER, STANDARD_ANZEIGE, anzeigeAus } from './meineAnzeige';

const datei = (felder: Record<string, unknown>): DatenDatei => ({
  v: 1,
  felder: Object.fromEntries(Object.entries(felder).map(([k, w]) => [k, { w, t: 5 }])),
});

describe('anzeigeAus – aus der Personen-Datei die Anzeige (L4-5, A15)', () => {
  it('ohne Datei oder ohne Felder: alles an (Standard)', () => {
    expect(anzeigeAus(datei({}))).toEqual(STANDARD_ANZEIGE);
    expect(ANZEIGE_FELDER.every((k) => STANDARD_ANZEIGE[k] === true)).toBe(true);
    expect(ANZEIGE_FELDER).toHaveLength(6);
  });

  it('jedes der sechs Felder wirkt für sich – und nur auf sich', () => {
    for (const k of ANZEIGE_FELDER) {
      const a = anzeigeAus(datei({ [k]: false }));
      expect(a[k]).toBe(false);
      for (const andere of ANZEIGE_FELDER.filter((x) => x !== k)) expect(a[andere]).toBe(true);
    }
  });

  it('ein Wert, der kein Ja/Nein ist, und unbekannte Felder (spätere Schalter) ändern nichts: Standard an', () => {
    const a = anzeigeAus(
      datei({ rueckblick: 'nein', spalteSchnitt: 0, minutenKnoepfe: null, zukunft: false }),
    );
    expect(a).toEqual(STANDARD_ANZEIGE);
  });

  it('ein Feld wieder auf „an“ gesetzt: an', () => {
    expect(anzeigeAus(datei({ rueckblick: true })).rueckblick).toBe(true);
  });
});
