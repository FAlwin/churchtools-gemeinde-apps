import { describe, expect, it } from 'vitest';
import { terminVorlagenAus } from '../ct/terminVorlagen';
import { vorlageRechnen, type VorlagenStand } from './vorlage';

/** Die Vorlage über den Parser – wie sie aus ChurchTools kommt, nicht von Hand gebaut. */
const vorlage = (...dienste: [number, number][]) =>
  terminVorlagenAus([
    {
      id: 3,
      templateName: 'Abendmahl',
      calendarId: 1,
      services: dienste.map(([serviceId, count]) => ({ serviceId, count })),
    },
  ])[0];

const stand = (...z: [number, string, number, number?][]) =>
  new Map<number, VorlagenStand>(
    z.map(([id, name, anzahl, entwuerfe = 0]) => [id, { name, anzahl, entwuerfe }]),
  );
const NAMEN = new Map([
  [6, 'Ton'],
  [9, 'Gesang'],
  [24, 'Abendmahl'],
  [1, 'Predigt'],
]);

describe('vorlageRechnen', () => {
  it('erhöht auf die Zahl der Vorlage (0 → 1, 3 → 5)', () => {
    const r = vorlageRechnen(vorlage([24, 1], [9, 5]), {
      stand: stand([24, 'Abendmahl', 0], [9, 'Gesang', 3]),
      namen: NAMEN,
    });
    expect(r.aendern).toEqual([
      { serviceId: 24, name: 'Abendmahl', von: 0, nach: 1 },
      { serviceId: 9, name: 'Gesang', von: 3, nach: 5 },
    ]);
    expect(r.uebersprungen).toEqual([]);
  });

  it('verringert nie: mehr Plätze als die Vorlage → nichts zu tun', () => {
    const r = vorlageRechnen(vorlage([9, 2]), { stand: stand([9, 'Gesang', 4]), namen: NAMEN });
    expect(r.aendern).toEqual([]);
    expect(r.schonErfuellt).toBe(1);
  });

  it('gleich viele Plätze → schon erfüllt', () => {
    const r = vorlageRechnen(vorlage([6, 1]), { stand: stand([6, 'Ton', 1]), namen: NAMEN });
    expect(r).toEqual({ aendern: [], uebersprungen: [], schonErfuellt: 1 });
  });

  it('Dienst, den man nicht planen darf (nicht im Stand) → übersprungen', () => {
    const r = vorlageRechnen(vorlage([1, 1], [24, 1]), {
      stand: stand([24, 'Abendmahl', 0]),
      namen: NAMEN,
    });
    expect(r.uebersprungen).toEqual([{ serviceId: 1, name: 'Predigt', grund: 'nicht-planbar' }]);
    expect(r.aendern.map((s) => s.serviceId)).toEqual([24]);
  });

  it('Dienst nicht in der Dienstliste von ChurchTools → übersprungen (unbekannt)', () => {
    const r = vorlageRechnen(vorlage([99, 1]), { stand: stand(), namen: NAMEN });
    expect(r.uebersprungen).toEqual([{ serviceId: 99, name: 'Dienst 99', grund: 'unbekannt' }]);
    expect(r.aendern).toEqual([]);
  });

  it('liegt ein Entwurf am Dienst und fehlen Plätze → übersprungen', () => {
    const r = vorlageRechnen(vorlage([9, 4]), {
      stand: stand([9, 'Gesang', 2, 1]),
      namen: NAMEN,
    });
    expect(r.uebersprungen).toEqual([{ serviceId: 9, name: 'Gesang', grund: 'entwurf' }]);
    expect(r.aendern).toEqual([]);
  });

  it('liegt ein Entwurf am Dienst, aber die Plätze reichen schon → nichts zu melden', () => {
    const r = vorlageRechnen(vorlage([9, 2]), {
      stand: stand([9, 'Gesang', 2, 1]),
      namen: NAMEN,
    });
    expect(r).toEqual({ aendern: [], uebersprungen: [], schonErfuellt: 1 });
  });
});
