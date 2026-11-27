import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { hatSichtbarenPlatz, ohneLeereTermine } from './leereTermine';
import { termineAus, type RohTermin } from './termine';

const DIENSTE = diensteAus([{ id: 6, name: 'Ton', serviceGroupId: 3 }]);

function termin(id: number, plaetze: object[] | null | undefined): RohTermin {
  return {
    id,
    name: `T${id}`,
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:00:00Z',
    eventServices: plaetze,
  };
}
const PLATZ_FREI = { serviceId: 6, personId: null, name: null };
const PLATZ_EIGEN = { serviceId: 6, personId: 1, name: 'Alwin', isAccepted: true };

describe('ohneLeereTermine', () => {
  const roh = [
    termin(1, [PLATZ_FREI]),
    termin(2, []),
    termin(3, [PLATZ_EIGEN]),
    termin(4, undefined),
    termin(5, [{ ...PLATZ_FREI, isValid: false }]),
  ];

  it('Termin mit Plätzen bleibt, leerer verschwindet, nur eigener Platz bleibt', () => {
    expect(ohneLeereTermine(roh, false).map((t) => t.id)).toEqual([1, 3]);
  });

  it('wer alle Dienstgruppen sieht, behält alle Termine', () => {
    expect(ohneLeereTermine(roh, true).map((t) => t.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('stimmt mit den Plätzen überein, die `termineAus` kennt: wer sichtbar bleibt, hat dort einen Platz', () => {
    const o = {
      ichId: 1,
      dienste: DIENSTE,
      planbar: () => false,
      zeitzone: 'Europe/Berlin',
    };
    for (const t of roh) {
      const z = termineAus([t], o)[0];
      const hatPlatz = z.freiePlaetze.length + z.meine.length + z.team.length > 0;
      expect(hatSichtbarenPlatz(t)).toBe(hatPlatz);
    }
  });
});
