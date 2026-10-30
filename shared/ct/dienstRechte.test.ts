import { describe, expect, it } from 'vitest';
import {
  darfDienstgruppePlanen,
  darfDienstPlanen,
  dienstRechteAus,
  siehtAlleDienstgruppen,
  dienstgruppenSichtAus,
  siehtDienstGanz,
  siehtDienstgruppe,
} from './dienstRechte';
import { idsAusRecht } from './rechte';

const fehler = (status: number, meldung: string) => Object.assign(new Error(meldung), { status });

/** `churchservice` so, wie die Test-Instanz es am 13.10.2026 für Alwin (alles) und Spike (Mitglied) lieferte. */
const ALWIN = {
  churchcore: { 'administer persons': true },
  churchservice: {
    view: true,
    'view servicegroup': [1, 3, 4],
    'edit servicegroup': [1, 3, 4],
    'edit agenda': [1, 2, 3, 4, 5],
    'manage absent': true,
  },
};
const SPIKE = {
  churchcore: { 'administer persons': false },
  churchservice: {
    view: false,
    'view servicegroup': [],
    'edit servicegroup': [],
    'view agenda': [1, 2, 3, 4, 5],
    'edit agenda': [],
    'manage absent': false,
  },
};

describe('dienstRechteAus', () => {
  it('Planer: Dienstgruppen, Ablauf-Kalender und Abwesenheiten aus der gemessenen Antwort', () => {
    expect(dienstRechteAus(ALWIN, fehler)).toEqual({
      planbareDienstgruppen: [1, 3, 4],
      sichtbareDienstgruppen: [1, 3, 4],
      ablaufKalender: [1, 2, 3, 4, 5],
      abwesenheitenAller: true,
    });
  });

  it('Mitglied ohne Sonderrecht: überall leer – „Ablauf sehen“ ist kein Bearbeiten', () => {
    expect(dienstRechteAus(SPIKE, fehler)).toEqual({
      planbareDienstgruppen: [],
      sichtbareDienstgruppen: [],
      ablaufKalender: [],
      abwesenheitenAller: false,
    });
  });

  it('leere Antwort ist ein Aussetzer: wirft 502 statt „keine Rechte“', () => {
    expect(() => dienstRechteAus({}, fehler)).toThrow('Leere Rechte-Antwort');
    expect(() => dienstRechteAus(null, fehler)).toThrow('Leere Rechte-Antwort');
  });

  it('ohne churchservice-Block (andere Module da): wirklich keine Rechte, kein Wurf', () => {
    expect(dienstRechteAus({ churchcore: { x: true } }, fehler).planbareDienstgruppen).toEqual([]);
  });

  it('„manage absent“ zählt nur als echtes true – eine Liste oder ein Text ist kein Ja', () => {
    const roh = { churchservice: { 'manage absent': 'ja' } };
    expect(dienstRechteAus(roh, fehler).abwesenheitenAller).toBe(false);
  });
});

describe('idsAusRecht – die eine Lesart für Rechte in Listenform', () => {
  it('null in der Liste erfindet keine ID 0; "0" als Text ist die echte ID 0', () => {
    expect(idsAusRecht([null, '0', 3, 'x'])).toEqual([0, 3]);
  });

  it('false/undefined → kein Recht, true → Recht ohne Aufzählung (null)', () => {
    expect(idsAusRecht(false)).toEqual([]);
    expect(idsAusRecht(undefined)).toEqual([]);
    expect(idsAusRecht(true)).toBeNull();
  });
});

describe('darfDienstgruppePlanen', () => {
  const rechte = dienstRechteAus(ALWIN, fehler);
  it('nur die genannten Dienstgruppen', () => {
    expect(darfDienstgruppePlanen(rechte, 3)).toBe(true);
    expect(darfDienstgruppePlanen(rechte, 2)).toBe(false);
  });

  it('Recht ohne Aufzählung (null) → jede Dienstgruppe', () => {
    expect(darfDienstgruppePlanen({ ...rechte, planbareDienstgruppen: null }, 99)).toBe(true);
  });
});

describe('darfDienstPlanen – die drei Wege (E0 §2)', () => {
  const MITGLIED_RECHTE = dienstRechteAus(SPIKE, fehler);
  const PLANER_RECHTE = dienstRechteAus(ALWIN, fehler);
  const TON = { dienstgruppeId: 3, gruppenIds: [7] };
  const keine = new Set<number>();

  it('1. globales Recht für die Dienstgruppe', () => {
    expect(darfDienstPlanen(PLANER_RECHTE, TON, keine)).toBe(true);
  });

  it('2. Leitung einer ChurchTools-Gruppe des Dienstes – auch ohne globales Recht', () => {
    expect(darfDienstPlanen(MITGLIED_RECHTE, TON, new Set([7]))).toBe(true);
    expect(darfDienstPlanen(MITGLIED_RECHTE, TON, new Set([9]))).toBe(false);
  });

  it('3. Admin des Termins – für jeden Dienst darin', () => {
    expect(darfDienstPlanen(MITGLIED_RECHTE, TON, keine, true)).toBe(true);
  });

  it('nichts davon → nein; Dienst ohne Dienstgruppe und ohne Gruppen → nur als Admin', () => {
    expect(darfDienstPlanen(MITGLIED_RECHTE, TON, keine)).toBe(false);
    const lose = { dienstgruppeId: null, gruppenIds: [] };
    expect(darfDienstPlanen(PLANER_RECHTE, lose, keine)).toBe(false);
    expect(darfDienstPlanen(PLANER_RECHTE, lose, keine, true)).toBe(true);
  });
});

describe('siehtDienstGanz – liefert ChurchTools alle Plätze? (gemessen 13.10.2026, drei Rollen)', () => {
  const MITGLIED = dienstRechteAus(SPIKE, fehler);
  const GESANG = { dienstgruppeId: 4, gruppenIds: [9] };
  const keine = new Set<number>();

  it('Mitglied ohne Recht, Gruppe nicht für alle: nur die eigenen Einträge → nein', () => {
    expect(siehtDienstGanz(MITGLIED, GESANG, false, keine)).toBe(false);
  });

  it('Dienstgruppe „für alle sichtbar“ → ja', () => {
    expect(siehtDienstGanz(MITGLIED, GESANG, true, keine)).toBe(true);
  });

  it('Recht „Dienstgruppe sehen“ – für diese Gruppe, oder ohne Aufzählung für alle', () => {
    expect(
      siehtDienstGanz({ ...MITGLIED, sichtbareDienstgruppen: [4] }, GESANG, false, keine),
    ).toBe(true);
    expect(
      siehtDienstGanz({ ...MITGLIED, sichtbareDienstgruppen: [3] }, GESANG, false, keine),
    ).toBe(false);
    expect(
      siehtDienstGanz({ ...MITGLIED, sichtbareDienstgruppen: null }, GESANG, false, keine),
    ).toBe(true);
  });

  it('wer planen darf, sieht ganz: Bearbeiten-Recht oder Leitung einer Gruppe des Dienstes', () => {
    expect(siehtDienstGanz({ ...MITGLIED, planbareDienstgruppen: [4] }, GESANG, false, keine)).toBe(
      true,
    );
    expect(siehtDienstGanz(MITGLIED, GESANG, false, new Set([9]))).toBe(true);
    expect(siehtDienstGanz(MITGLIED, GESANG, false, new Set([7]))).toBe(false);
  });

  it('Dienst ohne Dienstgruppe: nur über eine Leitung', () => {
    const lose = { dienstgruppeId: null, gruppenIds: [9] };
    expect(siehtDienstGanz({ ...MITGLIED, sichtbareDienstgruppen: null }, lose, false, keine)).toBe(
      false,
    );
    expect(siehtDienstGanz(MITGLIED, lose, false, new Set([9]))).toBe(true);
  });
});

/**
 * Wer sieht welche Dienstgruppe – danach filtert ChurchTools auch die Gruppen-Infos am Ablaufpunkt (#676, gemessen
 * 22.10.2026: Spike mit Sicht nur auf Technik bekam Programm (`viewAll`) und Technik, nicht Musik).
 */
describe('siehtDienstgruppe / siehtAlleDienstgruppen (#676)', () => {
  const GRUPPEN = [
    { id: 1, fuerAlle: true }, // Programm – für alle sichtbar
    { id: 3, fuerAlle: false }, // Technik
    { id: 4, fuerAlle: false }, // Musik
  ];
  const rechte = (sicht: number[] | null, planen: number[] | null = []) => ({
    sichtbareDienstgruppen: sicht,
    planbareDienstgruppen: planen,
  });

  it('für alle sichtbar, sehen oder bearbeiten – jeder Weg reicht', () => {
    expect(siehtDienstgruppe(rechte([]), GRUPPEN[0])).toBe(true);
    expect(siehtDienstgruppe(rechte([3]), GRUPPEN[1])).toBe(true);
    expect(siehtDienstgruppe(rechte([], [4]), GRUPPEN[2])).toBe(true);
    expect(siehtDienstgruppe(rechte(null), GRUPPEN[2])).toBe(true);
    expect(siehtDienstgruppe(rechte([], null), GRUPPEN[2])).toBe(true);
    expect(siehtDienstgruppe(rechte([3]), GRUPPEN[2])).toBe(false);
  });

  it('Spike wie gemessen (sieht nur Technik) → nicht alle; Alwin (alle Listen) → alle', () => {
    expect(siehtAlleDienstgruppen(rechte([3], [3]), GRUPPEN)).toBe(false);
    expect(siehtAlleDienstgruppen(rechte([1, 3, 4], [1, 3, 4]), GRUPPEN)).toBe(true);
    expect(siehtAlleDienstgruppen(rechte([3], [4]), GRUPPEN)).toBe(true);
  });

  it('aus den Rohantworten – Dienstgruppen nicht als Liste → unbekannt (`undefined`), kein Wurf', () => {
    const roh = (id: number, viewAll: boolean) => ({ id, name: `G${id}`, viewAll });
    const gruppen = [roh(1, true), roh(3, false), roh(4, false)];
    expect(dienstgruppenSichtAus(ALWIN, gruppen)?.siehtAlle).toBe(true);
    expect(dienstgruppenSichtAus(SPIKE, gruppen)?.siehtAlle).toBe(false);
    expect(dienstgruppenSichtAus(SPIKE, [roh(1, true)])?.siehtAlle).toBe(true);
    expect(dienstgruppenSichtAus(ALWIN, null)).toBeUndefined();
    expect(dienstgruppenSichtAus(ALWIN, { data: [] })).toBeUndefined();
  });

  it('Infos je Gruppe (E6-4): nur die Gruppen, die man sieht – wie ChurchTools die Infos filtert', () => {
    const roh = (id: number, viewAll: boolean) => ({ id, name: `G${id}`, viewAll });
    const gruppen = [roh(1, true), roh(3, false), roh(4, false)];
    // Spike sieht hier keine Dienstgruppe selbst – nur die „für alle sichtbare“.
    expect(dienstgruppenSichtAus(SPIKE, gruppen)?.infoGruppen).toEqual([{ id: 1, name: 'G1' }]);
    expect(dienstgruppenSichtAus(ALWIN, gruppen)?.infoGruppen.map((g) => g.id)).toEqual([1, 3, 4]);
  });
});
