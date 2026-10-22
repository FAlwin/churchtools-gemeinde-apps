import { describe, expect, it } from 'vitest';
import { orgRechteAus } from './rechte';

const fehler = (status: number, meldung: string) => Object.assign(new Error(meldung), { status });

describe('orgRechteAus – wie an der Test-Instanz gemessen (22.10.2026)', () => {
  it('Admin: verwalten, Typen und Gruppen als Listen', () => {
    const r = orgRechteAus(
      {
        churchdb: {
          'administer groups': true,
          'create groups of grouptype': [1, 2, 3, 4, 5],
          'edit group': [6, 7, 10],
        },
      },
      fehler,
    );
    expect(r).toEqual({
      gruppenVerwalten: true,
      anlegbareTypen: [1, 2, 3, 4, 5],
      bearbeitbareGruppen: [6, 7, 10],
    });
  });

  it('Mitglied ohne Sonderrecht (Spike): nichts', () => {
    const r = orgRechteAus(
      {
        churchdb: {
          'administer groups': false,
          'create groups of grouptype': [],
          'edit group': [],
        },
      },
      fehler,
    );
    expect(r).toEqual({ gruppenVerwalten: false, anlegbareTypen: [], bearbeitbareGruppen: [] });
  });

  it('ohne churchdb-Block (andere Module da) → keine Rechte, kein Fehler', () => {
    expect(orgRechteAus({ churchservice: { view: true } }, fehler).gruppenVerwalten).toBe(false);
  });

  it('Recht ohne Aufzählung → null (= alle, nicht selbst eingrenzen); nur `true` gilt als verwalten', () => {
    const r = orgRechteAus(
      { churchdb: { 'create groups of grouptype': true, 'administer groups': 1 } },
      fehler,
    );
    expect(r.anlegbareTypen).toBeNull();
    expect(r.gruppenVerwalten).toBe(false);
  });

  it('leere Antwort = Aussetzer → wirft (vorübergehend, nicht „keine Rechte“)', () => {
    expect(() => orgRechteAus({}, fehler)).toThrow(/Leere Rechte-Antwort/);
    expect(() => orgRechteAus(null, fehler)).toThrow();
  });
});
