import { describe, expect, it } from 'vitest';
import { plusTage } from '../ct/datum';
import { GRUNDWERTE, sommerferienAus, wechseljahre, type Wechseljahr } from './gruppenwechsel';
import { einrichtungAus, type Einrichtung } from './gruppenwechselEinrichtung';
import { KEINE_GRUPPENRECHTE, type GruppenRechte } from './rechte';
import {
  aktuellesWechseljahr,
  ausnahmeStand,
  ausnahmeVomVorjahr,
  vorigerWechseltag,
  gruppenSicht,
  kjMitgliederAus,
  kjZugang,
  phaseAm,
  pflegeAus,
  teilnehmerRolleAus,
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

const kind = (
  personId: number,
  status: MitgliedStatus = 'active',
  statusGeaendert: string | null = null,
): KjMitglied => ({
  personId,
  name: `Kind ${personId}`,
  leitung: false,
  status,
  statusGeaendert,
});
const leiter = (personId: number, name: string): KjMitglied => ({
  personId,
  name,
  leitung: true,
  status: 'active',
  statusGeaendert: null,
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
      { personId: 1, name: 'Jana', leitung: true, status: 'active', statusGeaendert: null },
      { personId: 204, name: 'Anton', leitung: false, status: 'to_delete', statusGeaendert: null },
    ]);
  });

  it('liest den Zeitpunkt der letzten Statusänderung (ChurchTools: statusChangedDate)', () => {
    const [a, b, c] = kjMitgliederAus(
      [
        { personId: 1, groupMemberStatus: 'to_delete', statusChangedDate: '2026-11-16T11:53:12Z' },
        { personId: 2, groupMemberStatus: 'to_delete', statusChangedDate: '' },
        { personId: 3, groupMemberStatus: 'to_delete', statusChangedDate: 5 },
      ],
      leitung,
    );
    expect([a.statusGeaendert, b.statusGeaendert, c.statusGeaendert]).toEqual([
      '2026-11-16T11:53:12Z',
      null,
      null,
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

// ── O9-3: Ausnahme vom Vorjahr ─────────────────────────────────────────────────────────────────────────────────────

describe('ausnahmeVomVorjahr / vorigerWechseltag', () => {
  const tag = (t: string) => `${t}T12:00:00Z`;
  const J28 = JAHRE[1];
  const grenze = vorigerWechseltag(JAHRE, J28)!; // Wechseltag 2027

  it('der Wechseltag des Vorjahres kommt aus dem Ferienkalender – fehlt das Vorjahr, gibt es keinen', () => {
    expect(grenze).toBe(J27.wechseltag);
    expect(vorigerWechseltag(JAHRE, J27)).toBeNull();
  });

  it('vor dem Wechseltag des Vorjahres gesetzt → Vorjahr; am Wechseltag selbst und danach → dieses Jahr', () => {
    expect(ausnahmeVomVorjahr(tag(plusTage(grenze, -1)), grenze, 'UTC')).toBe(true);
    expect(ausnahmeVomVorjahr(tag(grenze), grenze, 'UTC')).toBe(false);
  });

  it('vor der Ankündigung DIESES Jahres gesetzt (Bereichsleitung, O9-F7) ist keine Vorjahres-Ausnahme', () => {
    expect(ausnahmeVomVorjahr(tag(plusTage(J28.ankuendigung, -10)), grenze, 'UTC')).toBe(false);
  });

  it('zählt der Tag in der Gemeinde-Zeitzone, nicht der UTC-Tag', () => {
    // 23:30 UTC am Vortag ist in Berlin schon der Wechseltag
    const spaetAmVortag = `${plusTage(grenze, -1)}T23:30:00Z`;
    expect(ausnahmeVomVorjahr(spaetAmVortag, grenze, 'UTC')).toBe(true);
    expect(ausnahmeVomVorjahr(spaetAmVortag, grenze, 'Europe/Berlin')).toBe(false);
  });

  it('ohne Zeitpunkt oder ohne bekanntes Vorjahr lässt es sich nicht sagen → gilt als dieses Jahr', () => {
    expect(ausnahmeVomVorjahr(null, grenze, 'UTC')).toBe(false);
    expect(ausnahmeVomVorjahr(tag('2020-01-01'), null, 'UTC')).toBe(false);
  });

  it('die Sicht trägt es am Kind und sammelt die Vorjahres-Ausnahmen', () => {
    const mit = (geaendert: string | null) =>
      daten({
        [W_FISCHE]: sichtbar(leiter(2, 'Jana'), kind(204, 'to_delete', geaendert)),
      });
    const alt = gruppenSicht(
      EINRICHTUNG,
      FISCHE,
      mit(tag(plusTage(J27.ankuendigung, -30))),
      J27,
      J27.ankuendigung,
      'immer',
      { zeitzone: 'UTC', vorigerWechseltag: plusTage(J27.ankuendigung, -10) },
    )!;
    expect(alt.wechseln.find((k) => k.personId === 204)?.wechsel).toMatchObject({
      art: 'ausnahme',
      vomVorjahr: true,
    });
    expect(ids(alt.ausVorjahr)).toEqual([204]);
    // Ohne bekannten Wechseltag des Vorjahres: nie „vom Vorjahr“.
    const ohneGrenze = gruppenSicht(
      EINRICHTUNG,
      FISCHE,
      mit(tag(plusTage(J27.ankuendigung, -30))),
      J27,
      J27.ankuendigung,
      'immer',
      { zeitzone: 'UTC' },
    )!;
    expect(ohneGrenze.ausVorjahr).toEqual([]);
    const neu = gruppenSicht(
      EINRICHTUNG,
      FISCHE,
      mit(tag(J27.ankuendigung)),
      J27,
      J27.ankuendigung,
      'immer',
      { zeitzone: 'UTC', vorigerWechseltag: plusTage(J27.ankuendigung, -10) },
    )!;
    expect(neu.wechseln.find((k) => k.personId === 204)?.wechsel).toMatchObject({
      vomVorjahr: false,
    });
    expect(neu.ausVorjahr).toEqual([]);
  });
});

// ── O9-3: Wer darf eine Ausnahme setzen ────────────────────────────────────────────────────────────────────────────

describe('ausnahmeStand', () => {
  const nur = (x: Partial<GruppenRechte>): ReadonlyMap<number, GruppenRechte> =>
    new Map([[W_FISCHE, { ...KEINE_GRUPPENRECHTE, ...x }]]);
  const ruhig = vorAnkuendigung;
  const angekuendigt = J27.ankuendigung;
  const wechsel = J27.wechseltag;
  /** Die Zeile eines Kindes der Fische, so wie die Sicht sie baut. */
  const zeile = (d: KjDaten, id: number, heute: string) =>
    gruppenSicht(EINRICHTUNG, FISCHE, d, J27, heute, 'immer', { zeitzone: 'UTC' })!.kinder.find(
      (k) => k.personId === id,
    )!;
  const stand = (
    id: number,
    heute: string,
    rechte: ReadonlyMap<number, GruppenRechte>,
    d: KjDaten = daten(),
  ) => ausnahmeStand(EINRICHTUNG, FISCHE, zeile(d, id, heute), d, J27, heute, rechte);
  /** 201 steht nach der Ankündigung als aktiver Teilnehmer in der Wechsel-Gruppe. */
  const mitKindDrin = daten({
    [W_FISCHE]: sichtbar(leiter(2, 'Jana'), kind(201), kind(204, 'to_delete')),
  });

  it('Kind noch nicht in der Wechsel-Gruppe: braucht „aufnehmen“ – Status-Recht allein reicht nicht', () => {
    expect(stand(201, angekuendigt, nur({ aufnehmen: true }))).toEqual({
      art: 'schalter',
      gruppeId: W_FISCHE,
      an: false,
      mitglied: false,
    });
    expect(stand(201, angekuendigt, nur({ statusAendern: true }))).toEqual({
      art: 'hinweis',
      grund: 'rechtFehlt',
    });
  });

  it('Kind schon in der Wechsel-Gruppe: braucht das Status-Recht – „aufnehmen“ allein reicht nicht', () => {
    expect(stand(201, angekuendigt, nur({ statusAendern: true }), mitKindDrin)).toEqual({
      art: 'schalter',
      gruppeId: W_FISCHE,
      an: false,
      mitglied: true,
    });
    expect(stand(201, angekuendigt, nur({ aufnehmen: true }), mitKindDrin)).toEqual({
      art: 'hinweis',
      grund: 'rechtFehlt',
    });
  });

  it('eine bestehende Ausnahme zeigt den Schalter an (zum Aufheben)', () => {
    expect(stand(204, angekuendigt, nur({ statusAendern: true }))).toMatchObject({
      art: 'schalter',
      an: true,
      mitglied: true,
    });
  });

  it('vor der Ankündigung ohne das Recht: der Hinweis nennt die Ankündigung; mit Recht (Bereichsleitung) gibt es den Schalter', () => {
    expect(stand(201, ruhig, nur({}))).toEqual({ art: 'hinweis', grund: 'abAnkuendigung' });
    expect(stand(201, ruhig, nur({ aufnehmen: true }))).toMatchObject({ art: 'schalter' });
  });

  it('ab dem Wechseltag kein Schalter mehr – auch mit allen Rechten', () => {
    const alle = nur({ aufnehmen: true, statusAendern: true });
    expect(stand(201, wechsel, alle)).toEqual({ art: 'hinweis', grund: 'zuSpaet' });
    expect(stand(204, wechsel, alle)).toEqual({ art: 'hinweis', grund: 'zuSpaet' });
    // einen Tag vorher noch
    expect(stand(201, plusTage(wechsel, -1), alle)).toMatchObject({ art: 'schalter' });
  });

  it('Rechte nicht gelesen → „unbekannt“, nicht „fehlt“; Wechsel-Gruppe nicht lesbar → „nichtLesbar“', () => {
    expect(stand(201, angekuendigt, new Map())).toEqual({
      art: 'hinweis',
      grund: 'rechtUnbekannt',
    });
    expect(
      stand(
        201,
        angekuendigt,
        nur({ aufnehmen: true }),
        daten({ [W_FISCHE]: { art: 'verborgen' } }),
      ),
    ).toEqual({ art: 'hinweis', grund: 'nichtLesbar' });
  });

  it('kein Schalter für Kinder, die nicht wechseln, und in der letzten Stufe', () => {
    const alle = nur({ aufnehmen: true, statusAendern: true });
    expect(stand(202, angekuendigt, alle)).toEqual({ art: 'keiner' }); // bleibt
    expect(stand(203, angekuendigt, alle)).toEqual({ art: 'keiner' }); // ohne Geburtstag
    const jungschar = gruppenSicht(EINRICHTUNG, JUNGSCHAR, daten(), J27, angekuendigt, 'immer', {
      zeitzone: 'UTC',
    })!.kinder[0];
    expect(
      ausnahmeStand(EINRICHTUNG, JUNGSCHAR, jungschar, daten(), J27, angekuendigt, alle),
    ).toEqual({ art: 'keiner' });
  });
});

describe('teilnehmerRolleAus', () => {
  it('nimmt die Teilnehmer-Rolle, bei mehreren die Standardrolle, nie eine versteckte oder die Leitung', () => {
    expect(
      teilnehmerRolleAus([
        { groupTypeRoleId: 48, type: 'leader' },
        { groupTypeRoleId: 44, type: 'participant', isDefault: false },
        { groupTypeRoleId: 45, type: 'participant', isDefault: true },
        { groupTypeRoleId: 46, type: 'participant', isDefault: true, isHidden: true },
      ]),
    ).toBe(45);
    expect(teilnehmerRolleAus([{ groupTypeRoleId: 44, type: 'participant' }])).toBe(44);
  });

  it('keine Teilnehmer-Rolle oder unlesbare Antwort → null', () => {
    expect(teilnehmerRolleAus([{ groupTypeRoleId: 48, type: 'leader' }])).toBeNull();
    expect(teilnehmerRolleAus([{ type: 'participant' }])).toBeNull();
    expect(teilnehmerRolleAus(null)).toBeNull();
  });
});
