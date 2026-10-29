import { describe, expect, it } from 'vitest';
import { dokumentDerSitzung, istKopf } from './speicher';
import { sitzungenOrdnen, type Termin } from './sitzungen';
import {
  geplanterKopf,
  naechsteNach,
  OHNE_VORBILD,
  planungFehler,
  schonBelegt,
  STANDARD_ABSTAND,
  vorbelegung,
  zeitraum,
  type Planung,
} from './planen';

const ZONE = 'Europe/Berlin';
const HEUTE = '2026-10-28';

const termin = (id: number, beginn: string, ende?: string, titel = 'Leitungssitzung'): Termin => ({
  kalender: 4,
  id,
  titel,
  beginn,
  ...(ende ? { ende } : {}),
  anfragen: [{ person: 1, antwort: 'zugesagt' }],
});

/** Die Sitzungen so, wie die Liste sie hat – aus `sitzungenOrdnen` (Tests gegen den Erzeuger). */
const sitzungen = (termine: Termin[]) => {
  const { kommend, protokolle } = sitzungenOrdnen({
    termine,
    treffen: [],
    koepfe: [],
    heute: '2026-01-01',
    zeitzone: ZONE,
  });
  return [...kommend, ...protokolle];
};

describe('vorbelegung (S5-2: wie die letzte Sitzung)', () => {
  it('Titel, Uhrzeit (Ortszeit) und Dauer aus dem Termin; Tag im Abstand der letzten beiden', () => {
    const p = vorbelegung({
      sitzungen: sitzungen([
        termin(1, '2026-10-07T17:30:00Z', '2026-10-07T19:00:00Z'),
        termin(2, '2026-10-21T17:30:00Z', '2026-10-21T19:00:00Z', 'Leitungskreis'),
      ]),
      heute: HEUTE,
      zeitzone: ZONE,
    });
    expect(p).toEqual({ titel: 'Leitungskreis', tag: '2026-11-04', uhrzeit: '19:30', dauer: 90 });
  });

  it('über die Zeitumstellung: die Wanduhrzeit bleibt (19:30 im Sommer wie im Winter)', () => {
    const p = vorbelegung({
      sitzungen: sitzungen([termin(1, '2026-09-30T17:30:00Z'), termin(2, '2026-10-21T17:30:00Z')]),
      heute: HEUTE,
      zeitzone: ZONE,
    });
    expect(p.uhrzeit).toBe('19:30');
    expect(zeitraum(p, ZONE).beginn).toBe('2026-11-11T18:30:00Z');
  });

  it('frühestens morgen: der Abstand wird weitergezählt', () => {
    const p = vorbelegung({
      sitzungen: sitzungen([termin(1, '2026-09-02T17:00:00Z'), termin(2, '2026-09-16T17:00:00Z')]),
      heute: HEUTE,
      zeitzone: ZONE,
    });
    expect(p.tag).toBe('2026-11-11');
  });

  it('ein Abstand außerhalb von 7 bis 91 Tagen zählt nicht (außerordentlich) – dann vier Wochen', () => {
    const kurz = vorbelegung({
      sitzungen: sitzungen([termin(1, '2026-10-20T17:00:00Z'), termin(2, '2026-10-22T17:00:00Z')]),
      heute: HEUTE,
      zeitzone: ZONE,
    });
    expect(kurz.tag).toBe('2026-11-19');
    const lang = vorbelegung({
      sitzungen: sitzungen([termin(1, '2026-04-01T16:00:00Z'), termin(2, '2026-10-22T17:00:00Z')]),
      heute: HEUTE,
      zeitzone: ZONE,
    });
    expect(lang.tag).toBe('2026-11-19');
    expect(STANDARD_ABSTAND).toBe(28);
  });

  it('nur eine frühere Sitzung: vier Wochen danach; ohne Ende zwei Stunden', () => {
    const p = vorbelegung({
      sitzungen: sitzungen([termin(1, '2026-10-21T17:00:00Z')]),
      heute: HEUTE,
      zeitzone: ZONE,
    });
    expect(p).toMatchObject({ tag: '2026-11-18', uhrzeit: '19:00', dauer: OHNE_VORBILD.dauer });
  });

  it('aus einem Protokoll heraus (`bis`) zählen spätere Sitzungen nicht', () => {
    const alle = sitzungen([
      termin(1, '2026-10-07T17:00:00Z'),
      termin(2, '2026-10-14T17:00:00Z'),
      termin(3, '2026-12-01T09:00:00Z', undefined, 'Klausur'),
    ]);
    const p = vorbelegung({ sitzungen: alle, bis: alle[1], heute: HEUTE, zeitzone: ZONE });
    expect(p).toMatchObject({ titel: 'Leitungssitzung', tag: '2026-11-04', uhrzeit: '19:00' });
  });

  it('ohne frühere Sitzung: „Sitzung“ um 19:30 in einer Woche', () => {
    expect(vorbelegung({ sitzungen: [], heute: HEUTE, zeitzone: ZONE })).toEqual({
      ...OHNE_VORBILD,
      tag: '2026-11-04',
    });
  });
});

describe('zeitraum und planungFehler', () => {
  const p: Planung = { titel: 'Leitungssitzung', tag: '2026-11-04', uhrzeit: '19:30', dauer: 90 };
  const jetzt = new Date('2026-10-28T12:00:00Z');

  it('Beginn und Ende in UTC', () => {
    expect(zeitraum(p, ZONE)).toEqual({
      beginn: '2026-11-04T18:30:00Z',
      ende: '2026-11-04T20:00:00Z',
    });
  });

  it('fertig: kein Fehler', () => {
    expect(planungFehler(p, ZONE, jetzt)).toBeNull();
  });

  it('ohne Termin (K2a) darf es auch schon vorbei sein', () => {
    const vorbei = { ...p, tag: '2026-10-21' };
    expect(planungFehler(vorbei, ZONE, jetzt)).toMatch(/Zukunft/);
    expect(planungFehler(vorbei, ZONE, jetzt, { zukunft: false })).toBeNull();
    expect(planungFehler({ ...vorbei, titel: '' }, ZONE, jetzt, { zukunft: false })).toMatch(
      /Titel/,
    );
  });

  it.each([
    [{ titel: '  ' }, /Titel/],
    [{ tag: '' }, /Datum und Uhrzeit/],
    [{ uhrzeit: '' }, /Datum und Uhrzeit/],
    [{ dauer: 0 }, /Dauer/],
    [{ tag: '2026-10-28', uhrzeit: '12:59' }, /Zukunft/],
  ])('%o → %s', (teil, meldung) => {
    expect(planungFehler({ ...p, ...teil }, ZONE, jetzt)).toMatch(meldung);
  });
});

describe('schonBelegt', () => {
  it('gleiche Minute ist belegt, eine Minute später nicht', () => {
    const alle = sitzungen([termin(1, '2026-11-04T18:30:00Z')]);
    expect(schonBelegt(alle, '2026-11-04T18:30:00Z')).toBe(true);
    expect(schonBelegt(alle, '2026-11-04T18:31:00Z')).toBe(false);
  });
});

describe('geplanterKopf', () => {
  const k = geplanterKopf(
    {
      titel: 'Leitungssitzung',
      beginn: '2026-11-04T18:30:00Z',
      termin: { kalender: 4, id: 150 },
      treffen: 18,
    },
    'neu',
  );

  it('ist ein gültiger Kopf (geplant, ohne Dokument) – so liest ihn die Liste', () => {
    expect(istKopf(JSON.parse(JSON.stringify(k)))).toBe(true);
    expect(k).toMatchObject({ status: 'geplant', stand: '', sperre: null, freigabe: null });
    expect(dokumentDerSitzung(k, [])).toBeNull();
  });

  it('Termin, Treffen und Kopf werden in der Liste eine Sitzung', () => {
    const { kommend } = sitzungenOrdnen({
      termine: [termin(150, '2026-11-04T18:30:00Z', '2026-11-04T20:00:00Z')],
      treffen: [{ id: 18, beginn: '2026-11-04T18:30:00Z' }],
      koepfe: [k],
      heute: HEUTE,
      zeitzone: ZONE,
    });
    expect(kommend).toHaveLength(1);
    expect(kommend[0]).toMatchObject({
      schluessel: 'p:neu',
      treffen: 18,
      termin: { kalender: 4, id: 150 },
      ende: '2026-11-04T20:00:00Z',
    });
  });
});

describe('naechsteNach', () => {
  it('die früheste Sitzung mit späterem Beginn', () => {
    const alle = sitzungen([
      termin(3, '2026-12-02T18:00:00Z'),
      termin(1, '2026-10-14T17:00:00Z'),
      termin(2, '2026-11-04T18:00:00Z'),
    ]);
    const okt = alle.find((s) => s.termin?.id === 1)!;
    expect(naechsteNach(okt, alle)?.termin?.id).toBe(2);
    expect(naechsteNach(alle.find((s) => s.termin?.id === 3)!, alle)).toBeNull();
  });
});
