import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { hinweiseAus, type HinweisDaten } from './hinweise';
import { rollenAus } from './mitglieder';
import type { PersonEinsatz } from './einsaetze';

const ROLLEN = rollenAus([
  { id: 15, name: 'Mitarbeiter', isLeader: false, sortKey: 0 },
  { id: 16, name: 'Leiter', isLeader: true, sortKey: 1 },
]);
const e = (vergangen: number, kommend = 0): PersonEinsatz => ({
  vergangen,
  kommend,
  letzter: null,
  jeDienst: new Map(),
});
const BASIS: HinweisDaten = {
  // 7: mit Leitung; 52: ohne Leitung; 60: leer; 70: Dienst-Team
  mitglieder: new Map([
    [
      7,
      [
        { personId: 1, rolleId: 16 },
        { personId: 2, rolleId: 15 },
      ],
    ],
    [52, [{ personId: 3, rolleId: 15 }]],
    [60, []],
    [
      70,
      [
        { personId: 4, rolleId: 16 },
        { personId: 5, rolleId: 15 },
      ],
    ],
  ]),
  angefragt: new Map([[7, [{ personId: 9, rolleId: 15 }]]]),
  rollen: ROLLEN,
  einsaetze: {
    jePerson: new Map([
      [1, e(30)],
      [2, e(24)],
      [4, e(3)],
      [5, e(0, 1)],
    ]),
    offenJeDienst: new Map(),
  },
  dienste: diensteAus([{ id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [70, 52] }]),
  bereich: null,
};
const titel = (d: HinweisDaten) => hinweiseAus(d).map((h) => h.titel);
const finde = (d: HinweisDaten, start: string) =>
  hinweiseAus(d).find((h) => h.titel.includes(start));

describe('hinweiseAus (O3)', () => {
  it('alle vier Arten, wenn alles da ist', () => {
    expect(titel(BASIS)).toEqual([
      '1 Team ohne Leitung',
      '2 Personen dienen fast jede Woche',
      '1 Person in einem Dienst-Team ohne Einsatz',
      '1 offene Mitgliedsanfrage',
    ]);
  });

  it('Team ohne Leitung: nur Gruppen MIT Mitgliedern (leere Gruppe zählt nicht)', () => {
    expect(finde(BASIS, 'ohne Leitung')!.gruppen).toEqual([52]);
  });

  it('fast jede Woche: ab 24, die meisten zuerst', () => {
    expect(finde(BASIS, 'fast jede Woche')!.personen).toEqual([1, 2]);
  });

  it('ohne Einsatz: nur in Dienst-Teams und weder vergangen noch kommend (5 ist kommend eingeteilt)', () => {
    expect(finde(BASIS, 'ohne Einsatz')!.personen).toEqual([3]);
  });

  it('Einsätze nicht geladen → kein „fast jede Woche“ und kein „ohne Einsatz“ (sonst wäre jeder „ohne Einsatz“)', () => {
    expect(titel({ ...BASIS, einsaetze: null })).toEqual([
      '1 Team ohne Leitung',
      '1 offene Mitgliedsanfrage',
    ]);
  });

  it('nur im Sichtbereich', () => {
    const d = { ...BASIS, bereich: new Set([70]) };
    expect(titel(d)).toEqual([]);
    const d2 = { ...BASIS, bereich: new Set([7]) };
    expect(titel(d2)).toEqual(['2 Personen dienen fast jede Woche', '1 offene Mitgliedsanfrage']);
  });
});
