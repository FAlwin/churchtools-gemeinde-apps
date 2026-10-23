import { describe, expect, it } from 'vitest';
import { anlegbareTypenAus, darfStruktur, orgRechteAus, type OrgRechte } from './rechte';

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
      bearbeitbareTypen: [],
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
    expect(r).toEqual({
      gruppenVerwalten: false,
      anlegbareTypen: [],
      bearbeitbareGruppen: [],
      bearbeitbareTypen: [],
    });
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

describe('darfStruktur / anlegbareTypenAus (O5)', () => {
  const r = (x: Partial<OrgRechte>): OrgRechte => ({
    gruppenVerwalten: false,
    anlegbareTypen: [],
    bearbeitbareGruppen: [],
    bearbeitbareTypen: [],
    ...x,
  });
  const technik = { id: 7, typId: 2 };

  it('Gruppen-Admin darf jede Gruppe ändern und in jedem Typ anlegen', () => {
    expect(darfStruktur(r({ gruppenVerwalten: true }), technik)).toBe(true);
    expect(anlegbareTypenAus(r({ gruppenVerwalten: true }), [1, 2, 9])).toEqual([1, 2, 9]);
  });

  it('ohne Sonderrecht (auch als Leitung): nichts', () => {
    expect(darfStruktur(r({}), technik)).toBe(false);
    expect(anlegbareTypenAus(r({}), [1, 2])).toEqual([]);
  });

  it('„edit group“ für genau diese Gruppe – oder für alle (null)', () => {
    expect(darfStruktur(r({ bearbeitbareGruppen: [7] }), technik)).toBe(true);
    expect(darfStruktur(r({ bearbeitbareGruppen: [8] }), technik)).toBe(false);
    expect(darfStruktur(r({ bearbeitbareGruppen: null }), technik)).toBe(true);
  });

  it('„edit groups of grouptype“ für den Typ der Gruppe; Gruppe ohne Typ nur bei „alle“', () => {
    expect(darfStruktur(r({ bearbeitbareTypen: [2] }), technik)).toBe(true);
    expect(darfStruktur(r({ bearbeitbareTypen: [1] }), technik)).toBe(false);
    expect(darfStruktur(r({ bearbeitbareTypen: [2] }), { id: 7, typId: null })).toBe(false);
    expect(darfStruktur(r({ bearbeitbareTypen: null }), { id: 7, typId: null })).toBe(true);
  });

  it('anlegen nur in freigegebenen Typen, die es gibt', () => {
    expect(anlegbareTypenAus(r({ anlegbareTypen: [2, 5] }), [1, 2, 9])).toEqual([2]);
    expect(anlegbareTypenAus(r({ anlegbareTypen: null }), [1, 2])).toEqual([1, 2]);
  });

  it('liest „edit groups of grouptype“ aus der Antwort', () => {
    expect(
      orgRechteAus({ churchdb: { 'edit groups of grouptype': [1, 2] } }, fehler).bearbeitbareTypen,
    ).toEqual([1, 2]);
  });
});
