import { describe, expect, it } from 'vitest';
import {
  EINSTELLUNGEN_KENNUNG,
  einstellungenAlsText,
  type OeffentlicheEinstellungen,
  type TerminAngabe,
} from './formular';
import {
  anmeldestand,
  aufmerksamkeit,
  belegungAus,
  einteilen,
  istVeranstaltung,
  LOGO_KENNUNG,
  phaseVon,
  veranstaltungAus,
  verborgeneUntergruppen,
  type Veranstaltung,
  type VeranstaltungDetails,
  type VeranstaltungRoh,
} from './uebersicht';
import { neueEinstellungen } from './vorlagen';

/**
 * Übersicht der Veranstaltungen (A2, #480). Die Beschreibungen entstehen mit `einstellungenAlsText` –
 * demselben Erzeuger, mit dem die Erweiterung sie später schreibt –, nicht als handgeschriebener Text.
 */
const HEUTE = '2026-10-12';
const JETZT = new Date('2026-10-12T10:00:00Z');

function einstellungen(termin: TerminAngabe | null): OeffentlicheEinstellungen {
  return { ...neueEinstellungen('einfach'), termin, ctFelder: { bezahlt: 67 } };
}

const termin = (beginn: string, ende: string | null = null): TerminAngabe => ({
  beginn,
  ende,
  ort: 'Gemeindehaus',
  terminId: null,
});

function roh(
  id: number,
  name: string,
  t: TerminAngabe | null,
  extra: Partial<VeranstaltungRoh> = {},
): VeranstaltungRoh {
  return {
    id,
    name,
    gruppeId: 9,
    statusId: 1,
    beschreibung: einstellungenAlsText(einstellungen(t)),
    ...extra,
  };
}

const OFFEN: VeranstaltungDetails = {
  maxPlaetze: 30,
  anmeldungAb: '2026-10-01T00:00:00Z',
  anmeldungBis: '2026-11-07T23:00:00Z',
  warteliste: true,
};

function v(
  r: VeranstaltungRoh,
  belegung: Veranstaltung['belegung'] = null,
  d = OFFEN,
): Veranstaltung {
  const x = veranstaltungAus(r, d, belegung, HEUTE, JETZT);
  if (!x) throw new Error('keine Veranstaltung');
  return x;
}

describe('istVeranstaltung', () => {
  it('nur Untergruppen mit unserer Kennung', () => {
    expect(istVeranstaltung({ beschreibung: EINSTELLUNGEN_KENNUNG + '{}' })).toBe(true);
    expect(istVeranstaltung({ beschreibung: 'Wir proben donnerstags.' })).toBe(false);
    expect(istVeranstaltung({ beschreibung: '' })).toBe(false);
  });
  it('Logo-Gruppen derselben Art sind keine Veranstaltung (eigenes Logo, 14.10.2026)', () => {
    const logo = { beschreibung: `${LOGO_KENNUNG} Bitte nicht löschen.`, typId: 5 };
    expect(istVeranstaltung(logo, 5)).toBe(false);
    expect(istVeranstaltung({ ...logo, beschreibung: '' }, 5)).toBe(true);
  });
});

describe('phaseVon', () => {
  it('Entwurf (Status 2) ist Entwurf – auch wenn das Datum vorbei ist', () => {
    expect(phaseVon(2, termin('2026-01-01T10:00'), HEUTE)).toBe('entwurf');
  });
  it('aktiv: vorbei erst, wenn der LETZTE Tag vor heute liegt', () => {
    expect(phaseVon(1, termin('2026-10-11T18:00'), HEUTE)).toBe('vorbei');
    expect(phaseVon(1, termin('2026-10-12T18:00'), HEUTE)).toBe('anstehend');
    // Freizeit: begonnen, aber noch nicht zu Ende
    expect(phaseVon(1, termin('2026-10-10T15:00', '2026-10-13T11:00'), HEUTE)).toBe('anstehend');
  });
  it('aktiv ohne Datum bleibt sichtbar (anstehend); beendete Status gelten als vorbei', () => {
    expect(phaseVon(1, null, HEUTE)).toBe('anstehend');
    expect(phaseVon(3, termin('2027-01-01T10:00'), HEUTE)).toBe('vorbei');
  });
});

describe('anmeldestand – die Zweige einzeln', () => {
  const b = (aktiv: number) => ({ aktiv, wartend: 0, unbezahlt: null });
  it('offen', () => expect(anmeldestand(OFFEN, b(3), JETZT)).toBe('offen'));
  it('voll, sobald alle Plätze belegt sind – auch vor dem Anmeldeschluss', () => {
    expect(anmeldestand(OFFEN, b(30), JETZT)).toBe('voll');
  });
  it('ohne Platzgrenze oder ohne gelesene Mitglieder nie voll', () => {
    expect(anmeldestand({ ...OFFEN, maxPlaetze: null }, b(500), JETZT)).toBe('offen');
    expect(anmeldestand(OFFEN, null, JETZT)).toBe('offen');
  });
  it('geschlossen nach dem Anmeldeschluss', () => {
    expect(anmeldestand({ ...OFFEN, anmeldungBis: '2026-10-11T22:00:00Z' }, b(3), JETZT)).toBe(
      'geschlossen',
    );
  });
  it('bald: Beginn in der Zukunft oder gar keiner (dann nimmt ChurchTools nichts an)', () => {
    expect(anmeldestand({ ...OFFEN, anmeldungAb: '2026-10-20T00:00:00Z' }, b(0), JETZT)).toBe(
      'bald',
    );
    expect(anmeldestand({ ...OFFEN, anmeldungAb: null }, b(0), JETZT)).toBe('bald');
  });
});

describe('belegungAus', () => {
  const m = (status: string, bezahlt: unknown = null) => ({
    groupMemberStatus: status,
    fields: [{ id: 67, name: 'bezahlt', value: bezahlt }],
  });
  it('zählt aktive und wartende; unbezahlt nur unter den aktiven', () => {
    expect(
      belegungAus(
        // '0' = nicht angekreuzt, so liefert ChurchTools es (gemessen 12.10.2026)
        [
          m('active', '1'),
          m('active'),
          m('active', ''),
          m('active', '0'),
          m('waiting'),
          m('requested'),
          { ...m('active'), groupTypeRoleId: 35 }, // Leitung (#623)
        ],
        67,
        new Set([35]),
      ),
    ).toEqual({ aktiv: 4, wartend: 1, unbezahlt: 3 });
  });
  it('ohne Feld „bezahlt“ gibt es nichts zu zahlen (null, nicht 0)', () => {
    expect(belegungAus([m('active')], undefined, new Set())).toEqual({
      aktiv: 1,
      wartend: 0,
      unbezahlt: null,
    });
  });
});

describe('veranstaltungAus', () => {
  it('fremde oder kaputte Beschreibung → null', () => {
    expect(
      veranstaltungAus(roh(1, 'X', null, { beschreibung: 'Probe' }), OFFEN, null, HEUTE, JETZT),
    ).toBeNull();
    expect(
      veranstaltungAus(
        roh(1, 'X', null, { beschreibung: EINSTELLUNGEN_KENNUNG + '{kaputt' }),
        OFFEN,
        null,
        HEUTE,
        JETZT,
      ),
    ).toBeNull();
  });
  it('setzt Tag, Preis und Stand – Stand nur, solange sie ansteht', () => {
    const a = v(roh(1, 'Gemeindeessen', termin('2026-11-15T12:00')), {
      aktiv: 3,
      wartend: 0,
      unbezahlt: 0,
    });
    expect(a).toMatchObject({
      tag: '2026-11-15',
      preis: 'kostenlos',
      phase: 'anstehend',
      anmeldung: 'offen',
    });
    expect(v(roh(2, 'Alt', termin('2026-09-01T12:00'))).anmeldung).toBeNull();
    expect(v(roh(3, 'Plan', null, { statusId: 2 })).anmeldung).toBeNull();
  });
});

describe('einteilen', () => {
  it('anstehend und Entwürfe früheste zuerst (ohne Datum zuletzt), vorbei neueste zuerst', () => {
    const liste = [
      v(roh(1, 'Dezember', termin('2026-12-01T10:00'))),
      v(roh(2, 'Ohne Datum', null)),
      v(roh(3, 'November', termin('2026-11-01T10:00'))),
      v(roh(4, 'August', termin('2026-08-01T10:00'))),
      v(roh(5, 'September', termin('2026-09-01T10:00'))),
      v(roh(6, 'Entwurf B', termin('2027-02-01T10:00'), { statusId: 2 })),
      v(roh(7, 'Entwurf A', null, { statusId: 2 })),
    ];
    const e = einteilen(liste);
    expect(e.anstehend.map((x) => x.name)).toEqual(['November', 'Dezember', 'Ohne Datum']);
    expect(e.vorbei.map((x) => x.name)).toEqual(['September', 'August']);
    expect(e.entwuerfe.map((x) => x.name)).toEqual(['Entwurf B', 'Entwurf A']);
  });
});

describe('aufmerksamkeit', () => {
  const LEITUNG = new Set([9]);
  it('Entwurf: Freigabe – freigeben darf nur die Leitung der Gruppe', () => {
    const e = v(roh(1, 'Plan', null, { statusId: 2, gruppeId: 9 }));
    const f = v(roh(2, 'Plan 2', null, { statusId: 2, gruppeId: 7 }));
    expect(aufmerksamkeit([e, f], [], LEITUNG)).toEqual([
      { art: 'freigabe', v: e, darfFreigeben: true },
      { art: 'freigabe', v: f, darfFreigeben: false },
    ]);
  });
  it('Platz frei, aber jemand wartet → nachrücken; voll mit Warteliste → nichts', () => {
    const frei = v(roh(1, 'A', termin('2026-11-01T10:00')), {
      aktiv: 28,
      wartend: 3,
      unbezahlt: null,
    });
    const voll = v(roh(2, 'B', termin('2026-11-02T10:00')), {
      aktiv: 30,
      wartend: 3,
      unbezahlt: null,
    });
    expect(aufmerksamkeit([frei, voll], [], LEITUNG)).toEqual([
      { art: 'nachruecken', v: frei, frei: 2, wartend: 3 },
    ]);
  });
  it('offene Zahlungen nur für die Leitung und nur, solange es ansteht', () => {
    const offen = v(roh(1, 'A', termin('2026-11-01T10:00')), {
      aktiv: 5,
      wartend: 0,
      unbezahlt: 2,
    });
    const andere = v(roh(2, 'B', termin('2026-11-01T10:00'), { gruppeId: 7 }), {
      aktiv: 5,
      wartend: 0,
      unbezahlt: 2,
    });
    const alt = v(roh(3, 'C', termin('2026-09-01T10:00')), { aktiv: 5, wartend: 2, unbezahlt: 2 });
    expect(aufmerksamkeit([offen, andere, alt], [], LEITUNG)).toEqual([
      { art: 'zahlungen', v: offen, offen: 2 },
    ]);
  });
  it('unlesbare Einstellungen stehen ganz oben', () => {
    const e = v(roh(1, 'Plan', null, { statusId: 2 }));
    const h = aufmerksamkeit([e], [{ id: 5, name: 'Kaputt', gruppeId: 9 }], LEITUNG);
    expect(h[0]).toEqual({ art: 'kaputt', id: 5, name: 'Kaputt', gruppeId: 9 });
  });
});

describe('verborgeneUntergruppen', () => {
  it('zählt, was laut Hierarchie da ist, aber nicht sichtbar', () => {
    expect(verborgeneUntergruppen([40, 41], [])).toBe(2);
    expect(verborgeneUntergruppen([40, 41], [40, 41])).toBe(0);
    expect(verborgeneUntergruppen([], [])).toBe(0);
  });
});
