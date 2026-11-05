import { describe, expect, it } from 'vitest';
import { einstellungenAus, STANDARD_EINSTELLUNGEN } from './einstellungen';

// Hin und zurück durch den Speicher prüft `ablage.test.ts`; hier nur, was aus einem Inhalt wird.

describe('Einstellungen', () => {
  it('gültige Einstellungen bleiben unverändert', () => {
    const e = { kalender: 1, suchwort: 'Gebetsabend' };
    expect(einstellungenAus(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it('nichts gespeichert oder fremder Wert → Vorgabe (kein Kalender, Suchwort „Gebet“)', () => {
    expect(einstellungenAus(null)).toEqual(STANDARD_EINSTELLUNGEN);
    expect(einstellungenAus('kein Objekt')).toEqual(STANDARD_EINSTELLUNGEN);
    expect(STANDARD_EINSTELLUNGEN).toEqual({ kalender: null, suchwort: 'Gebet' });
  });

  it('kaputter Kalender gilt als „keiner“, Suchwort wird getrimmt (leer bleibt leer = alle Termine)', () => {
    expect(einstellungenAus({ kalender: '4', suchwort: '  Gebet ' })).toEqual({
      kalender: null,
      suchwort: 'Gebet',
    });
    expect(einstellungenAus({ kalender: 0, suchwort: '' })).toEqual({
      kalender: null,
      suchwort: '',
    });
    expect(einstellungenAus({ kalender: 2.5 }).kalender).toBeNull();
  });
});
