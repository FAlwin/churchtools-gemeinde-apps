import { describe, expect, it } from 'vitest';
import {
  anlegbareTypenAus,
  darfStruktur,
  gruppenRechteAus,
  KEINE_GRUPPENRECHTE,
  mitgliederRechte,
  orgRechteAus,
  type OrgRechte,
} from './rechte';

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
      mitgliederAlle: false,
      mitgliederGruppen: [],
      mitgliederTypen: [],
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
      mitgliederAlle: false,
      mitgliederGruppen: [],
      mitgliederTypen: [],
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
    mitgliederAlle: false,
    mitgliederGruppen: [],
    mitgliederTypen: [],
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

describe('Mitglieder pflegen (O6, gemessen 23.10.2026)', () => {
  const r = (x: Partial<OrgRechte>): OrgRechte => ({
    gruppenVerwalten: false,
    anlegbareTypen: [],
    bearbeitbareGruppen: [],
    bearbeitbareTypen: [],
    mitgliederAlle: false,
    mitgliederGruppen: [],
    mitgliederTypen: [],
    ...x,
  });
  const lobpreis = { id: 9, typId: 2 };
  // Leitung von Lobpreisteam in der Test-Instanz
  const leitung = gruppenRechteAus({
    churchdb: {
      '+add person': true,
      '+edit group memberships': true,
      '+edit basic group memberships': true,
      '+remove from group': false,
    },
  });

  it('je Gruppe: Leitung darf aufnehmen und Rolle ändern, aber nicht beenden', () => {
    expect(leitung).toEqual({ aufnehmen: true, rolleAendern: true, beenden: false });
    expect(mitgliederRechte(r({}), leitung, lobpreis)).toEqual(leitung);
  });

  it('je Gruppe erlaubt auch Austragen (wo ChurchTools es der Rolle gibt) – ohne globales Recht', () => {
    const mitAustragen = { aufnehmen: false, rolleAendern: false, beenden: true };
    expect(mitgliederRechte(r({}), mitAustragen, lobpreis)).toEqual(mitAustragen);
  });

  it('nur Mitglied (alles false) oder Antwort ohne churchdb → nichts', () => {
    expect(gruppenRechteAus({ churchdb: { '+add person': false } })).toEqual(KEINE_GRUPPENRECHTE);
    expect(gruppenRechteAus(null)).toEqual(KEINE_GRUPPENRECHTE);
    // nur `true` zählt – ChurchTools nutzt bei anderen Rechten Zahlen (Stufen)
    expect(gruppenRechteAus({ churchdb: { '+add person': 1 } }).aufnehmen).toBe(false);
  });

  it('global: Gruppen-Admin, „edit group memberships“, Liste je Gruppe oder je Typ → alles', () => {
    const alles = { aufnehmen: true, rolleAendern: true, beenden: true };
    expect(mitgliederRechte(r({ gruppenVerwalten: true }), KEINE_GRUPPENRECHTE, lobpreis)).toEqual(
      alles,
    );
    expect(mitgliederRechte(r({ mitgliederAlle: true }), KEINE_GRUPPENRECHTE, lobpreis)).toEqual(
      alles,
    );
    expect(mitgliederRechte(r({ mitgliederGruppen: [9] }), KEINE_GRUPPENRECHTE, lobpreis)).toEqual(
      alles,
    );
    expect(mitgliederRechte(r({ mitgliederTypen: [2] }), KEINE_GRUPPENRECHTE, lobpreis)).toEqual(
      alles,
    );
    expect(mitgliederRechte(r({ mitgliederGruppen: [7] }), KEINE_GRUPPENRECHTE, lobpreis)).toEqual(
      KEINE_GRUPPENRECHTE,
    );
  });

  it('liest die globalen Listen aus der Antwort', () => {
    const x = orgRechteAus(
      {
        churchdb: {
          'edit group memberships': true,
          'edit group memberships of group': [6, 9],
          'edit group memberships of grouptype': [1, 2],
        },
      },
      fehler,
    );
    expect([x.mitgliederAlle, x.mitgliederGruppen, x.mitgliederTypen]).toEqual([
      true,
      [6, 9],
      [1, 2],
    ]);
  });
});
