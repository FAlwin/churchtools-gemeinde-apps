import { describe, expect, it } from 'vitest';
import { inhaltAus } from '../ct/modulDaten';
import {
  EINSTELLUNGEN_ART,
  EINSTELLUNGEN_FASSUNG,
  einstellungenAlsWert,
  einstellungenAus,
  STANDARD_EINSTELLUNGEN,
} from './einstellungen';

/** So liest die Seite den Wert: `inhaltAus` (gemeinsam für alle Erweiterungen) und dann `einstellungenAus`. */
const lesen = (value: string) =>
  einstellungenAus(
    inhaltAus({ id: 1, dataCategoryId: 2, value }, EINSTELLUNGEN_ART, EINSTELLUNGEN_FASSUNG),
  );

describe('Einstellungen', () => {
  it('hin und zurück unverändert', () => {
    const e = { kalender: 1, suchwort: 'Gebetsabend' };
    expect(lesen(einstellungenAlsWert(e))).toEqual(e);
  });

  it('nichts gespeichert oder fremder Wert → Vorgabe (kein Kalender, Suchwort „Gebet“)', () => {
    expect(einstellungenAus(null)).toEqual(STANDARD_EINSTELLUNGEN);
    expect(lesen('kein json')).toEqual(STANDARD_EINSTELLUNGEN);
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
