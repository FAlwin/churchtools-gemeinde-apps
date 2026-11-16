import { describe, expect, it } from 'vitest';
import {
  anlegbareTypenAus,
  darfStruktur,
  gruppenRechteAus,
  KEINE_GRUPPENRECHTE,
  mitgliederRechte,
  mitgliederRechteOderNichts,
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
      rechteVerwalten: false,
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
      rechteVerwalten: false,
    });
  });

  it('„Berechtigungen verwalten“ (churchcore: administer persons) ist ein eigenes Recht, unabhängig von „Gruppen verwalten“', () => {
    const nurGruppen = orgRechteAus({ churchdb: { 'administer groups': true } }, fehler);
    expect([nurGruppen.gruppenVerwalten, nurGruppen.rechteVerwalten]).toEqual([true, false]);
    const nurRechte = orgRechteAus(
      { churchdb: { 'administer groups': false }, churchcore: { 'administer persons': true } },
      fehler,
    );
    expect([nurRechte.gruppenVerwalten, nurRechte.rechteVerwalten]).toEqual([false, true]);
    // Dieselbe Lesart wie `rechteAus` (Musik-App, Dienstplaner): nur ein wahrer Wert zählt.
    expect(
      orgRechteAus({ churchcore: { 'administer persons': false }, churchdb: {} }, fehler)
        .rechteVerwalten,
    ).toBe(false);
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
    rechteVerwalten: false,
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
    rechteVerwalten: false,
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
      '+edit groupmemberstatus': true,
    },
  });

  it('je Gruppe: Leitung darf aufnehmen und Rolle ändern, aber nicht beenden', () => {
    expect(leitung).toEqual({
      aufnehmen: true,
      rolleAendern: true,
      beenden: false,
      statusAendern: true,
    });
    expect(mitgliederRechte(r({}), leitung, lobpreis)).toEqual(leitung);
  });

  it('je Gruppe erlaubt auch Austragen (wo ChurchTools es der Rolle gibt) – ohne globales Recht', () => {
    const mitAustragen = {
      aufnehmen: false,
      rolleAendern: false,
      beenden: true,
      statusAendern: false,
    };
    expect(mitgliederRechte(r({}), mitAustragen, lobpreis)).toEqual(mitAustragen);
  });

  it('nur Mitglied (alles false) oder Antwort ohne churchdb → nichts', () => {
    expect(gruppenRechteAus({ churchdb: { '+add person': false } })).toEqual(KEINE_GRUPPENRECHTE);
    expect(gruppenRechteAus(null)).toEqual(KEINE_GRUPPENRECHTE);
    // nur `true` zählt – ChurchTools nutzt bei anderen Rechten Zahlen (Stufen)
    expect(gruppenRechteAus({ churchdb: { '+add person': 1 } }).aufnehmen).toBe(false);
  });

  it('global: Gruppen-Admin, „edit group memberships“, Liste je Gruppe oder je Typ → alles', () => {
    const alles = { aufnehmen: true, rolleAendern: true, beenden: true, statusAendern: true };
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

  it('Status ändern (O9-3): nur `+edit groupmemberstatus` – ohne aufnehmen/austragen; global alles', () => {
    const nurStatus = gruppenRechteAus({ churchdb: { '+edit groupmemberstatus': true } });
    expect(nurStatus).toEqual({ ...KEINE_GRUPPENRECHTE, statusAendern: true });
    expect(gruppenRechteAus({ churchdb: { '+edit groupmemberstatus': 1 } }).statusAendern).toBe(
      false,
    );
    expect(mitgliederRechte(r({}), nurStatus, lobpreis).statusAendern).toBe(true);
    expect(mitgliederRechte(r({}), nurStatus, lobpreis).aufnehmen).toBe(false);
    expect(
      mitgliederRechte(r({ gruppenVerwalten: true }), KEINE_GRUPPENRECHTE, lobpreis).statusAendern,
    ).toBe(true);
    expect(mitgliederRechte(r({}), KEINE_GRUPPENRECHTE, lobpreis).statusAendern).toBe(false);
  });

  it('mitgliederRechteOderNichts: ohne gelesene Rechte und ohne globales Recht weiß man es nicht', () => {
    expect(mitgliederRechteOderNichts(r({}), null, lobpreis)).toBeNull();
    expect(mitgliederRechteOderNichts(r({ gruppenVerwalten: true }), null, lobpreis)).toEqual({
      aufnehmen: true,
      rolleAendern: true,
      beenden: true,
      statusAendern: true,
    });
    // gelesen und „nichts erlaubt“ ist etwas anderes als „nicht gelesen“
    expect(mitgliederRechteOderNichts(r({}), KEINE_GRUPPENRECHTE, lobpreis)).toEqual(
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
