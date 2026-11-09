import { describe, expect, it } from 'vitest';
import { andereTermineText } from './planEntwuerfe';
import { daten, entwurf } from './entwurfAnschluss.testutil';

describe('andereTermineText – Hinweis im Senden-Fach der Termin-Ansicht (F1)', () => {
  const an = (eventId: number, index: number) => entwurf({ ort: { eventId, serviceId: 7, index } });

  it('keine Entwürfe anderswo → kein Satz', () => {
    expect(andereTermineText(daten([an(7, 1), an(7, 2)]), 7)).toBeUndefined();
  });

  it('gezählt werden Termine, nicht Entwürfe – einer und mehrere', () => {
    expect(andereTermineText(daten([an(7, 1), an(20, 1), an(20, 2)]), 7)).toBe(
      'An einem anderen Termin liegen noch Entwürfe – die sendest du unter „Planen“.',
    );
    expect(andereTermineText(daten([an(20, 1), an(21, 1), an(21, 2)]), 7)).toBe(
      'An 2 anderen Terminen liegen noch Entwürfe – die sendest du unter „Planen“.',
    );
  });
});
