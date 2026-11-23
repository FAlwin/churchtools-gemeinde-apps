import { describe, expect, it } from 'vitest';
import { buchbareRessourcen, verwaltbareRessourcen } from './ressourcenRechte';

/** Rechte für Ressourcen (W15-2): `churchresource` → `create bookings` / `administer bookings`, gemessen 23.11.2026. */
const rechte = {
  churchresource: { 'create bookings': [1, 2, '5'], 'administer bookings': [2] },
};

describe('buchbareRessourcen / verwaltbareRessourcen', () => {
  it('liest die ID-Listen – Zahlen und Zahlentexte', () => {
    expect([...buchbareRessourcen(rechte)]).toEqual([1, 2, 5]);
    expect([...verwaltbareRessourcen(rechte)]).toEqual([2]);
  });

  it('die beiden Rechte sind getrennt: buchen ist nicht verwalten', () => {
    const nurBuchen = { churchresource: { 'create bookings': [3] } };
    expect(buchbareRessourcen(nurBuchen).has(3)).toBe(true);
    expect(verwaltbareRessourcen(nurBuchen).size).toBe(0);
  });

  it('fehlt der Eintrag oder hat er eine andere Form: keine Ressourcen', () => {
    for (const roh of [
      null,
      undefined,
      {},
      { churchresource: {} },
      { churchresource: { 'create bookings': true } },
      { churchresource: { 'create bookings': 'alle' } },
    ])
      expect(buchbareRessourcen(roh).size).toBe(0);
  });

  it('Unsinn in der Liste (0, negativ, Text, Kommazahl) wird verworfen', () => {
    expect([
      ...buchbareRessourcen({ churchresource: { 'create bookings': [0, -1, 'x', 1.5, 4] } }),
    ]).toEqual([4]);
  });
});
