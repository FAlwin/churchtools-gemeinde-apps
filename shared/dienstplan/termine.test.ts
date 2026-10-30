import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import {
  WEITERE,
  filtere,
  istFrei,
  nachMonat,
  termineAus,
  veranstaltungsArten,
  type RohTermin,
} from './termine';

const ICH = 1;
// Dienste wie an der Test-Instanz gemessen: Ton/Licht in Technik (3), Gesang in Musik (4).
const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3 },
  { id: 7, name: 'Licht', serviceGroupId: 3 },
  { id: 9, name: 'Gesang', serviceGroupId: 4 },
]);

function termin(id: number, name: string, startDate: string, plaetze: object[] = []): RohTermin {
  return {
    id,
    name,
    startDate,
    endDate: startDate,
    eventServices: plaetze,
  };
}

const zeilen = (roh: RohTermin[], planbar: number[] = []) =>
  termineAus(roh, {
    ichId: ICH,
    dienste: DIENSTE,
    planbar: (d, admin) =>
      admin || (d.dienstgruppeId !== null && planbar.includes(d.dienstgruppeId)),
    zeitzone: 'Europe/Berlin',
  });

describe('istFrei – allein der Name entscheidet', () => {
  it('ohne Namen frei; Gast ohne Person besetzt; verborgene Person (-2) mit Namen besetzt', () => {
    expect(istFrei({ personId: null, name: null })).toBe(true);
    expect(istFrei({ personId: -2, name: null })).toBe(true);
    expect(istFrei({ personId: null, name: 'Gast' })).toBe(false);
    expect(istFrei({ personId: -2, name: 'jemand' })).toBe(false);
    expect(istFrei({ personId: 5, name: '  ' })).toBe(true);
  });
});

describe('termineAus', () => {
  it('Ortszeit, eigene Dienste mit zugesagt/angefragt, freie Plätze nur in geplanten Gruppen', () => {
    const [z] = zeilen(
      [
        termin(1, 'Gottesdienst', '2026-10-18T08:00:00Z', [
          { serviceId: 6, personId: ICH, name: 'Alwin', isAccepted: true },
          { serviceId: 9, personId: ICH, name: 'Alwin', isAccepted: false },
          { serviceId: 7, personId: null, name: null },
          { serviceId: 9, personId: null, name: null },
        ]),
      ],
      [3],
    );
    expect(z).toEqual({
      id: 1,
      name: 'Gottesdienst',
      beginn: '2026-10-18T08:00:00Z',
      ende: '2026-10-18T08:00:00Z',
      tag: '2026-10-18',
      uhrzeit: '10:00',
      abgesagt: false,
      meine: [
        { dienst: 'Ton', zugesagt: true },
        { dienst: 'Gesang', zugesagt: false },
      ],
      geplant: 2,
      frei: 1,
      freiNachGruppe: { 3: 1 },
      team: [],
    });
  });

  it('Nicht-Planer sehen keine freien Plätze; ein leerer Platz mit meiner ID ist nicht „meiner“', () => {
    const [z] = zeilen([
      termin(1, 'X', '2026-10-18T08:00:00Z', [{ serviceId: 6, personId: ICH, name: null }]),
    ]);
    expect(z.meine).toEqual([]);
    expect([z.geplant, z.frei]).toEqual([0, 0]);
  });

  it('sortiert nach Zeit; abgesagt kommt mit; Termin um 0:30 Uhr liegt auf dem Ortstag', () => {
    const z = zeilen([
      { ...termin(2, 'B', '2026-10-20T08:00:00Z'), isCanceled: true },
      termin(1, 'A', '2026-10-03T22:30:00Z'),
    ]);
    expect(z.map((x) => [x.id, x.tag, x.uhrzeit, x.abgesagt])).toEqual([
      [1, '2026-10-04', '00:30', false],
      [2, '2026-10-20', '10:00', true],
    ]);
  });
});

describe('Veranstaltungsarten und Filter', () => {
  const liste = zeilen([
    termin(1, 'Gottesdienst', '2026-10-18T08:00:00Z', [
      { serviceId: 6, personId: ICH, name: 'Alwin', isAccepted: true },
    ]),
    termin(2, 'Gebetsabend', '2026-10-21T17:00:00Z'),
    termin(3, 'Gottesdienst', '2026-10-25T09:00:00Z'),
    termin(4, 'Gebetsabend', '2026-10-28T18:00:00Z'),
    termin(5, 'Gottesdienst', '2026-11-01T09:00:00Z'),
    termin(6, 'Gemeindeversammlung', '2026-11-08T17:00:00Z'),
  ]);

  it('Reihen (mind. zweimal) werden Arten, häufigste zuerst; Einzelne unter „Weitere“', () => {
    expect(veranstaltungsArten(liste)).toEqual(['Gottesdienst', 'Gebetsabend', WEITERE]);
  });

  it('ohne Einzeltermine gibt es kein „Weitere“', () => {
    expect(veranstaltungsArten(liste.filter((z) => z.id !== 6))).not.toContain(WEITERE);
  });

  it('„Meine“ zeigt nur Termine mit eigenem Dienst', () => {
    expect(filtere(liste, { nurMeine: true, ausgeblendet: [] }).map((z) => z.id)).toEqual([1]);
  });

  it('ausgeblendete Arten fallen weg – auch „Weitere“', () => {
    expect(
      filtere(liste, { nurMeine: false, ausgeblendet: ['Gebetsabend', WEITERE] }).map((z) => z.id),
    ).toEqual([1, 3, 5]);
  });

  it('nach Monat gruppiert, in Listenreihenfolge', () => {
    expect(nachMonat(liste).map((m) => [m.monat, m.zeilen.length])).toEqual([
      ['2026-10', 4],
      ['2026-11', 2],
    ]);
  });
});

describe('Team, Ende und freie Plätze je Gruppe (Startseite, E3-3)', () => {
  it('Team: besetzte Plätze anderer mit Dienst und Zusage; ich selbst und freie Plätze fehlen', () => {
    const [z] = zeilen([
      termin(1, 'X', '2026-10-18T08:00:00Z', [
        { serviceId: 6, personId: ICH, name: 'Alwin', isAccepted: true },
        { serviceId: 7, personId: 46, name: 'Anna Test', isAccepted: true },
        { serviceId: 9, personId: null, name: 'Gast', isAccepted: false },
        { serviceId: 9, personId: null, name: null },
      ]),
    ]);
    expect(z.team).toEqual([
      { dienst: 'Licht', name: 'Anna Test', zugesagt: true },
      { dienst: 'Gesang', name: 'Gast', zugesagt: false },
    ]);
  });

  it('„Namen verbergen“ (personId -2): der mitgeschickte echte Name erscheint NIE', () => {
    const [z] = zeilen([
      termin(1, 'X', '2026-10-18T08:00:00Z', [
        { serviceId: 7, personId: -2, name: 'Echter Name', isAccepted: true },
      ]),
    ]);
    expect(JSON.stringify(z)).not.toContain('Echter Name');
  });

  it('freie Plätze je geplanter Gruppe; nicht geplante Gruppen fehlen', () => {
    const [z] = zeilen(
      [
        termin(1, 'X', '2026-10-18T08:00:00Z', [
          { serviceId: 6, personId: null, name: null },
          { serviceId: 7, personId: null, name: null },
          { serviceId: 9, personId: null, name: null },
        ]),
      ],
      [3],
    );
    expect(z.freiNachGruppe).toEqual({ 3: 2 });
  });

  it('Ende so, wie ChurchTools es liefert (für Abwesenheiten); vor dem Beginn → der Beginn', () => {
    const roh = { ...termin(1, 'X', '2026-10-18T08:00:00Z'), endDate: '2026-10-18T09:30:00Z' };
    expect(zeilen([roh])[0]).toMatchObject({ ende: '2026-10-18T09:30:00Z' });
    const frueh = { ...termin(2, 'Y', '2026-10-18T08:00:00Z'), endDate: '2026-10-18T07:00:00Z' };
    expect(zeilen([frueh])[0]).toMatchObject({ ende: '2026-10-18T08:00:00Z' });
  });
});

describe('Termin-Admin (E3-4)', () => {
  it('Admin eines Termins plant dort jeden Dienst – adminIds oder eventAdminIds', () => {
    const roh = (extra: object) => ({
      ...termin(1, 'X', '2026-10-18T08:00:00Z', [{ serviceId: 9, personId: null, name: null }]),
      ...extra,
    });
    expect(zeilen([roh({ adminIds: [ICH] })])[0].frei).toBe(1);
    expect(zeilen([roh({ eventAdminIds: [ICH] })])[0].frei).toBe(1);
    expect(zeilen([roh({ adminIds: [99], eventAdminIds: [] })])[0].frei).toBe(0);
  });
});
