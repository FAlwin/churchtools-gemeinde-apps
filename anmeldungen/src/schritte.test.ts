import { describe, expect, it } from 'vitest';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import {
  blauerSchritt,
  freigebenPlatz,
  naechsterSchritt,
  schritteBisZurFreigabe,
} from './schritte';

/**
 * Der wandernde blaue Knopf (E24, B7): für JEDEN Stand einer Veranstaltung – welcher Schritt blau ist, wo „Freigeben“ steht.
 * Die Schritte kommen aus dem Erzeuger (`schritteBisZurFreigabe`), nicht aus handgeschriebenen Listen.
 */
const ZONE = 'Europe/Berlin';
const AB = '2026-10-01T22:00:00Z';
const TERMIN = { beginn: '2026-11-15T10:00', ende: null, ort: '', terminId: 1 };

const ohneTermin = () => ({ ...neueEinstellungen('einfach'), termin: null });
const mitTermin = () => ({ ...neueEinstellungen('einfach'), termin: TERMIN });
const kostetOhneBank = () => {
  const x = mitTermin();
  x.preis = { ...x.preis, grundpreis: { ...x.preis.grundpreis, betragCent: 1000 } };
  x.bezahlung = { ...x.bezahlung, iban: '' };
  return x;
};
const kostetMitBank = () => {
  const x = kostetOhneBank();
  x.bezahlung = { ...x.bezahlung, iban: 'DE02120300000000202051' };
  return x;
};

/** Jeder Stand vor der Freigabe, mit dem Schritt, der laut Regel dran ist. */
const STAENDE = [
  { name: 'ohne Termin', e: ohneTermin(), ab: null, dran: 'termin' },
  { name: 'Termin, aber kein Anmeldebeginn', e: mitTermin(), ab: null, dran: 'anmeldung' },
  { name: 'Termin und Beginn, kostenlos', e: mitTermin(), ab: AB, dran: 'freigeben' },
  { name: 'kostet, Bankverbindung fehlt', e: kostetOhneBank(), ab: AB, dran: 'bezahlung' },
  { name: 'kostet, Bankverbindung da', e: kostetMitBank(), ab: AB, dran: 'freigeben' },
] as const;

describe('Wandernder blauer Knopf (E24)', () => {
  for (const s of STAENDE) {
    describe(s.name, () => {
      const schritte = schritteBisZurFreigabe(s.e, { ab: s.ab }, ZONE);

      it(`Leitung im Entwurf: blau ist „${s.dran}“ – und das ist der erste nicht erledigte Schritt`, () => {
        expect(blauerSchritt(schritte, true, true)).toBe(s.dran);
        expect(blauerSchritt(schritte, true, true)).toBe(naechsterSchritt(schritte).id);
      });

      it('„Freigeben“ steht im Band, wenn es dran ist, sonst im ⋯-Menü', () => {
        expect(freigebenPlatz(schritte, true, true)).toBe(
          s.dran === 'freigeben' ? 'band' : 'menue',
        );
      });

      it('nach der Freigabe oder ohne Recht: kein blauer Schritt, „Freigeben“ nirgends', () => {
        expect(blauerSchritt(schritte, false, true)).toBeNull();
        expect(blauerSchritt(schritte, true, false)).toBeNull();
        expect(freigebenPlatz(schritte, false, true)).toBeNull();
        expect(freigebenPlatz(schritte, true, false)).toBeNull();
      });
    });
  }

  it('der blaue Knopf wandert: bei den fünf Ständen kommen alle möglichen Schritte vor außer dem Formular', () => {
    const dran = STAENDE.map((s) => s.dran);
    expect(new Set(dran)).toEqual(new Set(['termin', 'anmeldung', 'bezahlung', 'freigeben']));
  });
});
