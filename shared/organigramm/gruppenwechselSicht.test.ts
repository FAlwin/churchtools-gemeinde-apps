import { describe, expect, it } from 'vitest';
import { plusTage } from '../ct/datum';
import { GRUNDWERTE, sommerferienAus, wechseljahre, type Wechseljahr } from './gruppenwechsel';
import { einrichtungAus, type Einrichtung } from './gruppenwechselEinrichtung';
import {
  aktuellesWechseljahr,
  gruppenSicht,
  kjMitgliederAus,
  kjZugang,
  phaseAm,
  pflegeAus,
  type GruppenStand,
  type KjDaten,
  type KjMitglied,
  type MitgliedStatus,
} from './gruppenwechselSicht';

// ── Erzeuger statt Literale: Einrichtung über `einrichtungAus`, Jahre über `sommerferienAus` + `wechseljahre` ──────────

const SCHAF = 1;
const FISCHE = 2;
const JUNGSCHAR = 3;
const W_SCHAF = 11; // Schäfchen → Fische
const W_FISCHE = 12; // Fische → Jungschar
const BEREICH = 9;

const EINRICHTUNG: Einrichtung = einrichtungAus({
  einstellung: {
    ...GRUNDWERTE,
    stufen: [
      { gruppeId: SCHAF, name: 'Schäfchen', abAlter: 4 },
      { gruppeId: FISCHE, name: 'Fische', abAlter: 7 },
      { gruppeId: JUNGSCHAR, name: 'Jungschar', abAlter: 10 },
    ],
  },
  bereichGruppeId: BEREICH,
  wechselGruppen: [
    { vonGruppeId: SCHAF, nachGruppeId: FISCHE, gruppeId: W_SCHAF },
    { vonGruppeId: FISCHE, nachGruppeId: JUNGSCHAR, gruppeId: W_FISCHE },
  ],
})!;

const JAHRE: Wechseljahr[] = wechseljahre(
  sommerferienAus(
    [
      { titel: 'Sommerferien Nordrhein-Westfalen 2027', beginn: '2027-07-19', ende: '2027-08-31' },
      { titel: 'Sommerferien Nordrhein-Westfalen 2028', beginn: '2028-07-10', ende: '2028-08-22' },
    ],
    GRUNDWERTE.ferienStichwort,
  ),
  GRUNDWERTE,
);
const J27 = JAHRE[0];

const kind = (personId: number, status: MitgliedStatus = 'active'): KjMitglied => ({
  personId,
  name: `Kind ${personId}`,
  leitung: false,
  status,
});
const leiter = (personId: number, name: string): KjMitglied => ({
  personId,
  name,
  leitung: true,
  status: 'active',
});
const sichtbar = (...mitglieder: KjMitglied[]): GruppenStand => ({ art: 'sichtbar', mitglieder });

/** Geburtstage um den Stichtag 30.09.2027 herum: genau 10 an dem Tag = wechselt zur Jungschar. */
const GEBURTSTAGE = new Map<number, string | null>([
  [201, '2017-09-30'], // Fische, am Stichtag 10 → wechselt
  [202, '2017-10-01'], // Fische, am Stichtag 9 → bleibt
  [203, null], // Fische, ohne Geburtstag
  [204, '2016-05-05'], // Fische, 11 → alt genug, aber Ausnahme
  [101, '2020-09-30'], // Schäfchen, am Stichtag 7 → wechselt zu den Fischen
  [301, '2009-01-01'], // Jungschar, am Stichtag 18
]);

const daten = (ueber: Partial<Record<number, GruppenStand>> = {}): KjDaten => ({
  gruppen: new Map<number, GruppenStand>(
    Object.entries({
      [SCHAF]: sichtbar(leiter(1, 'Sara'), kind(101)),
      [FISCHE]: sichtbar(
        leiter(2, 'Jana'),
        kind(201),
        kind(202),
        kind(203),
        kind(204),
        kind(205, 'requested'),
      ),
      [JUNGSCHAR]: sichtbar(leiter(3, 'Tobi'), kind(301)),
      [W_SCHAF]: sichtbar(leiter(1, 'Sara'), leiter(2, 'Jana')),
      [W_FISCHE]: sichtbar(leiter(2, 'Jana'), leiter(3, 'Tobi'), kind(204, 'to_delete')),
      ...ueber,
    }).map(([k, v]) => [Number(k), v]),
  ),
  geburtstage: GEBURTSTAGE,
});

const vorAnkuendigung = plusTage(J27.ankuendigung, -1);
const ids = (xs: readonly { personId: number }[] | null) => xs?.map((x) => x.personId) ?? null;

describe('kjZugang', () => {
  it('Admins und die Leitung der Bereichsgruppe sehen alle Stufen', () => {
    expect(kjZugang(EINRICHTUNG, [], true)).toEqual({ art: 'bereich' });
    expect(kjZugang(EINRICHTUNG, [BEREICH], false)).toEqual({ art: 'bereich' });
  });

  it('Leitungen sehen nur ihre Stufen – in der Reihenfolge der Stufen', () => {
    expect(kjZugang(EINRICHTUNG, [JUNGSCHAR, 77, FISCHE], false)).toEqual({
      art: 'leitung',
      stufen: [FISCHE, JUNGSCHAR],
    });
  });

  it('wer nur eine Wechsel-Gruppe oder gar nichts davon leitet, bekommt keinen Reiter', () => {
    expect(kjZugang(EINRICHTUNG, [W_FISCHE, 77], false)).toBeNull();
  });
});

describe('kjMitgliederAus', () => {
  const leitung = (rolle: number | null) => rolle === 48;

  it('behält „zu löschen“ (die Ausnahme) und erkennt die Leitung an der Rolle', () => {
    expect(
      kjMitgliederAus(
        [
          {
            personId: 1,
            groupTypeRoleId: 48,
            groupMemberStatus: 'active',
            person: { title: 'Jana' },
          },
          {
            personId: 204,
            groupTypeRoleId: 45,
            groupMemberStatus: 'to_delete',
            person: { title: 'Anton' },
          },
        ],
        leitung,
      ),
    ).toEqual([
      { personId: 1, name: 'Jana', leitung: true, status: 'active' },
      { personId: 204, name: 'Anton', leitung: false, status: 'to_delete' },
    ]);
  });

  it('lässt beendete Mitgliedschaften, unbekannte Status und Zeilen ohne Person weg', () => {
    expect(
      kjMitgliederAus(
        [
          { personId: 5, groupMemberStatus: 'active', memberEndDate: '2026-01-01' },
          { personId: 6, groupMemberStatus: 'irgendwas' },
          { groupMemberStatus: 'active' },
        ],
        leitung,
      ),
    ).toEqual([]);
  });
});

describe('aktuellesWechseljahr / phaseAm', () => {
  it('bis zum Ende der Aufnahme gilt dieses Jahr, danach das nächste, nach dem letzten keins', () => {
    expect(aktuellesWechseljahr(JAHRE, plusTage(J27.aufnahmeBis, -1))?.jahr).toBe(2027);
    expect(aktuellesWechseljahr(JAHRE, J27.aufnahmeBis)?.jahr).toBe(2028);
    expect(aktuellesWechseljahr(JAHRE, JAHRE[1].aufnahmeBis)).toBeNull();
  });

  it('Phasen mit ihren Grenzen: Ankündigung und Wechseltag zählen schon zur neuen Phase', () => {
    expect(phaseAm(J27, vorAnkuendigung)).toBe('ruhig');
    expect(phaseAm(J27, J27.ankuendigung)).toBe('angekuendigt');
    expect(phaseAm(J27, plusTage(J27.wechseltag, -1))).toBe('angekuendigt');
    expect(phaseAm(J27, J27.wechseltag)).toBe('wechsel');
  });
});

describe('gruppenSicht – eine Stufe', () => {
  it('teilt in „wechseln“ (samt Ausnahme) und „bleiben“, ohne Leitung und Anfragen', () => {
    const s = gruppenSicht(EINRICHTUNG, FISCHE, daten(), J27, vorAnkuendigung, 'immer')!;
    expect(ids(s.wechseln)).toEqual([201, 204]);
    expect(s.wechseln.map((k) => k.wechsel.art)).toEqual(['wechselt', 'ausnahme']);
    expect(ids(s.bleiben)).toEqual([202, 203]);
    expect(s.bleiben.map((k) => k.wechsel.art)).toEqual(['bleibt', 'ohneGeburtstag']);
    expect(s.leitung).toEqual(['Jana']);
    expect(s.naechste?.name).toBe('Jungschar');
    expect(s.ausnahmenBekannt).toBe(true);
  });

  it('das Alter ist das am Stichtag – genau 10 am 30.09. wechselt, einen Tag jünger nicht', () => {
    const s = gruppenSicht(EINRICHTUNG, FISCHE, daten(), J27, vorAnkuendigung, 'immer')!;
    const alter = new Map(s.kinder.map((k) => [k.personId, k.alter]));
    expect([alter.get(201), alter.get(202), alter.get(203)]).toEqual([10, 9, null]);
  });

  it('ist die Wechsel-Gruppe nicht lesbar, sind die Ausnahmen unbekannt – und das wird gesagt', () => {
    const s = gruppenSicht(
      EINRICHTUNG,
      FISCHE,
      daten({ [W_FISCHE]: { art: 'verborgen' } }),
      J27,
      vorAnkuendigung,
      'immer',
    )!;
    expect(s.ausnahmenBekannt).toBe(false);
    expect(s.wechseln.map((k) => k.wechsel.art)).toEqual(['wechselt', 'wechselt']);
  });

  it('die letzte Stufe wechselt nicht; „wird 18“ steht am Kind', () => {
    const s = gruppenSicht(EINRICHTUNG, JUNGSCHAR, daten(), J27, vorAnkuendigung, 'immer')!;
    expect(s.wechseln).toEqual([]);
    expect(s.naechste).toBeNull();
    expect(s.kinder.find((k) => k.personId === 301)?.wird18).toBe(true);
  });

  it('eine Person, die sich nicht lesen ließ, ist „unbekannt“ – nicht „ohne Geburtstag“ und nicht in „Daten pflegen“', () => {
    const d = { ...daten(), geburtstage: new Map([...GEBURTSTAGE].filter(([id]) => id !== 201)) };
    const s = gruppenSicht(EINRICHTUNG, FISCHE, d, J27, vorAnkuendigung, 'immer')!;
    expect(s.kinder.find((k) => k.personId === 201)?.wechsel.art).toBe('unbekannt');
    expect(ids(s.bleiben)).toContain(201);
    expect(pflegeAus([s]).ohneGeburtstag.map((k) => k.personId)).toEqual([203]);
  });

  it('eine Gruppe ohne Leserecht: Stand „verborgen“, keine Kinder', () => {
    const s = gruppenSicht(
      EINRICHTUNG,
      FISCHE,
      daten({ [FISCHE]: { art: 'verborgen' } }),
      J27,
      vorAnkuendigung,
      'immer',
    )!;
    expect(s.stand).toBe('verborgen');
    expect(s.kinder).toEqual([]);
  });

  it('unbekannte Stufe → null', () => {
    expect(gruppenSicht(EINRICHTUNG, 77, daten(), J27, vorAnkuendigung, 'immer')).toBeNull();
  });
});

describe('gruppenSicht – kommen neu dazu', () => {
  it('erste Stufe: niemand kommt aus einer Stufe davor', () => {
    expect(gruppenSicht(EINRICHTUNG, SCHAF, daten(), J27, vorAnkuendigung, 'immer')!.neu).toEqual(
      [],
    );
  });

  it('Leitungen sehen vor der Ankündigung nichts (4.25)', () => {
    expect(
      gruppenSicht(EINRICHTUNG, JUNGSCHAR, daten(), J27, vorAnkuendigung, 'abAnkuendigung')!.neu,
    ).toBeNull();
  });

  it('vor der Ankündigung (Bereichsleitung): Vorschau aus der Stufe davor – ohne Ausnahmen', () => {
    const s = gruppenSicht(EINRICHTUNG, JUNGSCHAR, daten(), J27, vorAnkuendigung, 'immer')!;
    expect(ids(s.neu)).toEqual([201]);
    expect(s.neu?.[0].von.name).toBe('Fische');
  });

  it('ab der Ankündigung: die aktiven Teilnehmer der Wechsel-Gruppe – so nimmt die neue Gruppe auf', () => {
    // In der Wechsel-Gruppe steht ein Kind, das die Vorschau nicht kennt: Die Wechsel-Gruppe gewinnt.
    const d = daten({
      [W_FISCHE]: sichtbar(leiter(2, 'Jana'), kind(201), kind(204, 'to_delete'), kind(206)),
    });
    const s = gruppenSicht(EINRICHTUNG, JUNGSCHAR, d, J27, J27.ankuendigung, 'abAnkuendigung')!;
    expect(ids(s.neu)).toEqual([201, 206]);
  });

  it('wer schon in der neuen Gruppe ist, kommt nicht mehr „neu dazu“ (die Routine räumt erst später auf)', () => {
    const d = daten({
      [JUNGSCHAR]: sichtbar(leiter(3, 'Tobi'), kind(301), kind(201)),
      [W_FISCHE]: sichtbar(kind(201), kind(206)),
    });
    const s = gruppenSicht(EINRICHTUNG, JUNGSCHAR, d, J27, J27.wechseltag, 'abAnkuendigung')!;
    expect(ids(s.neu)).toEqual([206]);
  });

  it('ab der Ankündigung ohne lesbare Wechsel-Gruppe: zurück zur Vorschau, wenn die Stufe davor lesbar ist', () => {
    const d = daten({ [W_FISCHE]: { art: 'fehler' } });
    // Ohne Wechsel-Gruppe sind auch die Ausnahmen der Fische unbekannt → keine Vorschau, lieber nichts als Falsches.
    expect(gruppenSicht(EINRICHTUNG, JUNGSCHAR, d, J27, J27.ankuendigung, 'immer')!.neu).toBeNull();
  });

  it('weder Wechsel-Gruppe noch Stufe davor lesbar → nicht zu sehen', () => {
    const d = daten({ [W_FISCHE]: { art: 'verborgen' }, [FISCHE]: { art: 'verborgen' } });
    expect(gruppenSicht(EINRICHTUNG, JUNGSCHAR, d, J27, J27.ankuendigung, 'immer')!.neu).toBeNull();
  });
});

describe('pflegeAus', () => {
  it('sammelt fehlende Geburtstage und „wird 18“ über alle gezeigten Stufen', () => {
    const sichten = [FISCHE, JUNGSCHAR].map(
      (id) => gruppenSicht(EINRICHTUNG, id, daten(), J27, vorAnkuendigung, 'immer')!,
    );
    const p = pflegeAus(sichten);
    expect(p.ohneGeburtstag.map((k) => [k.personId, k.stufe.name])).toEqual([[203, 'Fische']]);
    expect(p.wird18.map((k) => [k.personId, k.stufe.name])).toEqual([[301, 'Jungschar']]);
  });
});
