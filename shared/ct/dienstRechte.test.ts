import { describe, expect, it } from 'vitest';
import { darfDienstgruppePlanen, darfDienstPlanen, dienstRechteAus } from './dienstRechte';
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
      ablaufKalender: [1, 2, 3, 4, 5],
      abwesenheitenAller: true,
    });
  });

  it('Mitglied ohne Sonderrecht: überall leer – „Ablauf sehen“ ist kein Bearbeiten', () => {
    expect(dienstRechteAus(SPIKE, fehler)).toEqual({
      planbareDienstgruppen: [],
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
