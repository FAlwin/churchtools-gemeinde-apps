import { describe, expect, it } from 'vitest';
import type { ProtokollKopf } from './speicher';
import {
  fremdeTermineAus,
  nurTermin,
  sitzungenZusammenfuehren,
  type Sitzung,
  type Termin,
  type Treffen,
} from './sitzungen';

/** W4 „Das Gruppentreffen entscheidet“ – Sitzungen kommen aus dem ERZEUGER (`sitzungenZusammenfuehren`), keine Literale. */
const kopf = (teil: Partial<ProtokollKopf>): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung: 's',
  titel: 'Techniker Treffen',
  status: 'entwurf',
  beginn: '2026-11-24T18:00:00Z',
  termin: null,
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: 'x',
  ...teil,
});
const termin = (id: number, beginn: string): Termin => ({
  kalender: 4,
  id,
  titel: 'Techniker Treffen',
  beginn,
  anfragen: [{ person: 1, antwort: 'zugesagt' }],
});
const treffen = (id: number, beginn: string): Treffen => ({ id, beginn });
const meine = (q: { termine?: Termin[]; treffen?: Treffen[]; koepfe?: ProtokollKopf[] }) =>
  sitzungenZusammenfuehren({
    termine: q.termine ?? [],
    treffen: q.treffen ?? [],
    koepfe: q.koepfe ?? [],
  });
const ids = (liste: readonly Sitzung[]) => liste.map((s) => s.termin?.id ?? s.treffen);

const T1 = '2026-11-24T18:00:00Z';
const T2 = '2026-12-01T18:00:00Z';

describe('fremdeTermineAus – das Gruppentreffen entscheidet (W4)', () => {
  it('Regel 1: hat eine andere Gruppe ein Gruppentreffen zur selben Minute, wird der Termin ausgeblendet', () => {
    const s = meine({ termine: [termin(7, T1), termin(8, T2)] });
    const r = fremdeTermineAus(s, {
      andere: [{ treffen: [{ beginn: '2026-11-24T18:00:30Z' }], koepfe: [] }],
    });
    expect(ids(r)).toEqual([8]);
  });

  it('Regel 1: ein Treffen zu anderer Uhrzeit zählt nicht', () => {
    const s = meine({ termine: [termin(7, T1)] });
    const r = fremdeTermineAus(s, {
      andere: [{ treffen: [{ beginn: '2026-11-24T19:00:00Z' }], koepfe: [] }],
    });
    expect(ids(r)).toEqual([7]);
  });

  it('Regel 2: hat eine andere Gruppe einen Kopf zu diesem Termin, wird er ausgeblendet', () => {
    const s = meine({ termine: [termin(7, T1), termin(8, T2)] });
    const r = fremdeTermineAus(s, {
      andere: [
        {
          treffen: [],
          koepfe: [kopf({ termin: { kalender: 4, id: 8 }, beginn: T2 })],
        },
      ],
    });
    expect(ids(r)).toEqual([7]);
  });

  it('Regel 2, Serie: ein Kopf der anderen Gruppe zu EINER Woche blendet nur diese Woche aus', () => {
    const s = meine({ termine: [termin(7, T1), termin(7, T2)] });
    const r = fremdeTermineAus(s, {
      andere: [
        {
          treffen: [],
          koepfe: [kopf({ termin: { kalender: 4, id: 7 }, beginn: T1 })],
        },
      ],
    });
    expect(r.map((x) => x.beginn)).toEqual([T2]);
  });

  it('Regel 2: ein einzelner, verschobener Termin bleibt bei seinem Kopf der anderen Gruppe (kein Serien-Vergleich)', () => {
    const s = meine({ termine: [termin(7, T2)] });
    const r = fremdeTermineAus(s, {
      andere: [
        {
          treffen: [],
          koepfe: [kopf({ termin: { kalender: 4, id: 7 }, beginn: T1 })],
        },
      ],
    });
    expect(ids(r)).toEqual([]);
  });

  it('serieImmer: auch ein einzelner Termin wird nur beim selben Beginn zugeordnet (kurzer Lesezeitraum)', () => {
    const s = meine({ termine: [termin(7, T2)] });
    const r = fremdeTermineAus(s, {
      andere: [{ treffen: [], koepfe: [kopf({ termin: { kalender: 4, id: 7 }, beginn: T1 })] }],
      serieImmer: true,
    });
    expect(ids(r)).toEqual([7]);
  });

  it('Regel 3: hat die Gruppe selbst ein Treffen zur Startzeit, bleibt der Termin – auch wenn eine andere eins hat', () => {
    const s = meine({ termine: [termin(7, T1)], treffen: [treffen(31, T1)] });
    expect(s).toHaveLength(1);
    const r = fremdeTermineAus(s, { andere: [{ treffen: [{ beginn: T1 }], koepfe: [] }] });
    expect(r).toEqual(s);
  });

  it('Regel 3: hat die Gruppe selbst einen Kopf, bleibt der Termin – auch wenn eine andere einen hat', () => {
    const eigen = kopf({ sitzung: 'e', termin: { kalender: 4, id: 7 }, beginn: T1 });
    const s = meine({ termine: [termin(7, T1)], koepfe: [eigen] });
    const r = fremdeTermineAus(s, {
      andere: [
        {
          treffen: [{ beginn: T1 }],
          koepfe: [kopf({ termin: { kalender: 4, id: 7 }, beginn: T1 })],
        },
      ],
    });
    expect(r).toEqual(s);
  });

  it('Regel 4: Sitzungen nur aus eigenem Treffen oder eigenem Kopf sind nie betroffen', () => {
    const s = meine({
      treffen: [treffen(31, T1)],
      koepfe: [kopf({ sitzung: 'k', beginn: T2 })],
    });
    expect(s.every((x) => !nurTermin(x))).toBe(true);
    const r = fremdeTermineAus(s, {
      andere: [{ treffen: [{ beginn: T1 }, { beginn: T2 }], koepfe: [kopf({ beginn: T2 })] }],
    });
    expect(r).toEqual(s);
  });

  it('beide Gruppen mit Treffen: jede sieht es bei sich', () => {
    const a = meine({ termine: [termin(7, T1)], treffen: [treffen(31, T1)] });
    const b = meine({ termine: [termin(7, T1)], treffen: [treffen(41, T1)] });
    expect(fremdeTermineAus(a, { andere: [{ treffen: [{ beginn: T1 }], koepfe: [] }] })).toEqual(a);
    expect(fremdeTermineAus(b, { andere: [{ treffen: [{ beginn: T1 }], koepfe: [] }] })).toEqual(b);
  });

  it('Regel 5 (Vorbedingung): ohne lesbare andere Gruppe bleibt alles, in derselben Reihenfolge', () => {
    const s = meine({ termine: [termin(8, T2), termin(7, T1)] });
    const r = fremdeTermineAus(s, { andere: [] });
    expect(r).toEqual(s);
    expect(r).not.toBe(s);
  });

  it('mehrere andere Gruppen: eine genügt', () => {
    const s = meine({ termine: [termin(7, T1)] });
    const r = fremdeTermineAus(s, {
      andere: [
        { treffen: [], koepfe: [] },
        { treffen: [{ beginn: T1 }], koepfe: [] },
      ],
    });
    expect(r).toEqual([]);
  });
});
