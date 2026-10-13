import { describe, expect, it } from 'vitest';
import { SYSTEMFELDER } from './formular';
import { felderNeuZuordnen, systemfeldAnlage } from './felder';

describe('Gruppenfelder (A3, #486)', () => {
  it('Systemfelder: beim Anmelden befüllbar nur, was die Seite beim Anmelden schreibt', () => {
    const anlage = SYSTEMFELDER.map(systemfeldAnlage);
    expect(anlage.find((f) => f.name === 'Betrag')).toMatchObject({
      fieldTypeCode: 'text',
      useInRegistrationForm: true,
    });
    expect(anlage.find((f) => f.name === 'Bezahlt')).toMatchObject({
      fieldTypeCode: 'checkbox',
      useInRegistrationForm: false,
    });
    expect(
      anlage.every((f) => f.securityLevel === 1 && f.requiredInRegistrationForm === false),
    ).toBe(true);
  });

  it('nach dem Kopieren über den Namen auf die neuen Nummern', () => {
    expect(
      felderNeuZuordnen(
        { betrag: 33, bezahlt: 34 },
        [
          { id: 33, name: 'Betrag' },
          { id: 34, name: 'Bezahlt' },
        ],
        [
          { id: 91, name: 'Bezahlt' },
          { id: 90, name: 'Betrag' },
        ],
      ),
    ).toEqual({ betrag: 90, bezahlt: 91 });
  });

  it('fehlt ein Feld in der Kopie → Fehler statt Antworten im falschen Feld', () => {
    expect(() =>
      felderNeuZuordnen(
        { bezahlt: 34 },
        [{ id: 34, name: 'Bezahlt' }],
        [{ id: 90, name: 'Betrag' }],
      ),
    ).toThrow('„Bezahlt“ fehlt');
  });
});
