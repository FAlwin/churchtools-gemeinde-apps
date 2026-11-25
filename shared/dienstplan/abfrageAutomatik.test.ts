import { describe, expect, it } from 'vitest';
import {
  einrichtenPlan,
  gruppenIdsDerDienste,
  hilfsgruppenBeschreibung,
  hilfsgruppenName,
  istHilfsgruppenTyp,
  istUnsereRoutine,
  personenIdsAusRecht,
  planerListe,
  routinenName,
  type EinrichtenIst,
} from './abfrageAutomatik';

/** **Erinnerungen in ChurchTools einrichten – die Regeln** (R-5a): Namen, Planer-Liste, Soll gegen Ist. */
describe('Namen', () => {
  it('Gruppe, Routine und Beschreibung nennen die Dienstgruppe', () => {
    expect(hilfsgruppenName('Musik')).toBe('Dienstplaner: Antwort fehlt – Musik');
    expect(routinenName('Musik')).toBe('Dienstplaner: Erinnerungen Musik');
    const b = hilfsgruppenBeschreibung('Musik');
    expect(b).toContain('Musik');
    expect(b).toContain('trägt Personen ein und wieder aus');
  });

  it('nur der Gruppentyp „Dienstplaner“ passt (Leerzeichen am Rand egal)', () => {
    expect(istHilfsgruppenTyp('Dienstplaner')).toBe(true);
    expect(istHilfsgruppenTyp(' Dienstplaner ')).toBe(true);
    for (const x of ['dienstplaner', 'Dienstplaner 2', 'Dienst', null, 5])
      expect(istHilfsgruppenTyp(x)).toBe(false);
  });

  it('unsere Routine erkennt man am Namen – gegen die Erzeuger', () => {
    expect(istUnsereRoutine(routinenName('Technik'))).toBe(true);
    expect(istUnsereRoutine('Gruppenwechsel X: aufräumen')).toBe(false);
    expect(istUnsereRoutine(undefined)).toBe(false);
  });
});

describe('Planer-Liste', () => {
  it('beide Quellen, sortiert, ohne Doppel', () => {
    expect(planerListe({ recht: [5, 2, 9], leitungen: [9, 3, 2] })).toEqual([2, 3, 5, 9]);
  });

  it('jede Quelle allein zählt; beide leer = niemand', () => {
    expect(planerListe({ recht: [4], leitungen: [] })).toEqual([4]);
    expect(planerListe({ recht: [], leitungen: [7] })).toEqual([7]);
    expect(planerListe({ recht: [], leitungen: [] })).toEqual([]);
  });

  it('die Gruppen der Dienste: nur die der Dienstgruppe, jede einmal (Kamera teilt eine)', () => {
    const dienste = [
      { dienstgruppeId: 4, gruppenIds: [21, 22] },
      { dienstgruppeId: 4, gruppenIds: [22] },
      { dienstgruppeId: 3, gruppenIds: [30] },
      { dienstgruppeId: null, gruppenIds: [99] },
    ];
    expect(gruppenIdsDerDienste(dienste, 4)).toEqual([21, 22]);
    expect(gruppenIdsDerDienste(dienste, 3)).toEqual([30]);
    expect(gruppenIdsDerDienste(dienste, 8)).toEqual([]);
  });

  it('die Antwort des Rechts wird in der gemessenen Form streng gelesen: eine halbe Liste ist keine Liste', () => {
    // Gemessen 25.11.2026 (Test-Instanz), nach dem Auspacken von `data`.
    const antwort = (personIds: unknown, dataId: unknown = 4) => ({
      authId: 305,
      selections: [{ dataId, personIds }],
    });
    expect(personenIdsAusRecht(antwort([1, 19]), 4)).toEqual([1, 19]);
    expect(personenIdsAusRecht(antwort([]), 4)).toEqual([]);
    // Nur der Eintrag DIESER Dienstgruppe zählt.
    expect(personenIdsAusRecht(antwort([1], 3), 4)).toBeNull();
    for (const roh of [
      null,
      {},
      'x',
      [1, 2],
      { selections: 'x' },
      antwort('x'),
      antwort([1, null]),
      antwort([0]),
      antwort([1.5]),
      antwort([true]),
    ])
      expect(personenIdsAusRecht(roh, 4)).toBeNull();
  });
});

describe('Soll gegen Ist', () => {
  const leer: EinrichtenIst = {
    gruppe: false,
    routine: false,
    eingetragen: false,
    leiter: [],
    teilnehmer: [],
  };
  const alles: EinrichtenIst = {
    gruppe: true,
    routine: true,
    eingetragen: true,
    leiter: [1, 2, 3],
    teilnehmer: [],
  };

  it('nichts da → alles anlegen, alle Planer eintragen', () => {
    expect(einrichtenPlan([3, 1, 2], leer)).toEqual({
      gruppeAnlegen: true,
      routineAnlegen: true,
      einrichtungSchreiben: true,
      leiterNachtragen: [1, 2, 3],
      planerAlsTeilnehmer: [],
      leiterZuviel: [],
      nichtsZuTun: false,
    });
  });

  it('alles da → nichts zu tun', () => {
    expect(einrichtenPlan([1, 2, 3], alles)).toMatchObject({
      gruppeAnlegen: false,
      routineAnlegen: false,
      einrichtungSchreiben: false,
      leiterNachtragen: [],
      nichtsZuTun: true,
    });
  });

  it('ein Leiter fehlt → nur der', () => {
    const p = einrichtenPlan([1, 2, 3], { ...alles, leiter: [1, 3] });
    expect(p).toMatchObject({ leiterNachtragen: [2], gruppeAnlegen: false, routineAnlegen: false });
    expect(p.nichtsZuTun).toBe(false);
  });

  it('die Gruppe fehlt → auch die Routine; Mitglieder einer alten Lage zählen nicht', () => {
    const p = einrichtenPlan([1, 2], { ...alles, gruppe: false, routine: true });
    expect(p).toMatchObject({
      gruppeAnlegen: true,
      routineAnlegen: true,
      leiterNachtragen: [1, 2],
    });
  });

  it('nur die Routine fehlt → nur sie, die Leiter bleiben', () => {
    expect(einrichtenPlan([1, 2, 3], { ...alles, routine: false })).toMatchObject({
      gruppeAnlegen: false,
      routineAnlegen: true,
      einrichtungSchreiben: true,
      leiterNachtragen: [],
    });
  });

  it('Gruppe und Routine stehen, das Dokument kennt sie noch nicht → nur das Dokument', () => {
    expect(einrichtenPlan([1, 2, 3], { ...alles, eingetragen: false })).toMatchObject({
      gruppeAnlegen: false,
      routineAnlegen: false,
      einrichtungSchreiben: true,
      nichtsZuTun: false,
    });
  });

  it('Leiter, die keine Planer mehr sind, werden NICHT entfernt, nur gemeldet', () => {
    const p = einrichtenPlan([1], { ...alles, leiter: [1, 8, 7] });
    expect(p.leiterZuviel).toEqual([7, 8]);
    expect(p.leiterNachtragen).toEqual([]);
    expect(p.nichtsZuTun).toBe(true);
  });

  it('ein Planer, der Teilnehmer ist, wird nicht umgestellt (das beendete seinen Lauf), nur gemeldet', () => {
    const p = einrichtenPlan([1, 2], { ...alles, leiter: [1], teilnehmer: [2] });
    expect(p.planerAlsTeilnehmer).toEqual([2]);
    expect(p.leiterNachtragen).toEqual([]);
  });

  it('wer Leiter ist und Teilnehmer, zählt als Leiter', () => {
    expect(einrichtenPlan([1], { ...alles, leiter: [1], teilnehmer: [1] })).toMatchObject({
      planerAlsTeilnehmer: [],
      leiterNachtragen: [],
    });
  });
});
