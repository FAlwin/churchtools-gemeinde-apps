import { describe, expect, it } from 'vitest';
import type { ProtokollKopf } from './speicher';
import {
  antwortAus,
  meineAntwort,
  naechsteSitzungen,
  sitzungenOrdnen,
  type Termin,
  type Treffen,
} from './sitzungen';

const ZONE = 'Europe/Berlin';
const kopf = (teil: Partial<ProtokollKopf>): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung: 's',
  titel: 'Leitungssitzung',
  status: 'frei',
  beginn: '2026-10-14T17:00:00Z',
  termin: null,
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: 'x',
  ...teil,
});
const termin = (id: number, beginn: string, titel = 'Leitungssitzung'): Termin => ({
  kalender: 4,
  id,
  titel,
  beginn,
  anfragen: [{ person: 1, antwort: 'zugesagt' }],
});
const ordnen = (q: { termine?: Termin[]; treffen?: Treffen[]; koepfe?: ProtokollKopf[] }) =>
  sitzungenOrdnen({
    termine: q.termine ?? [],
    treffen: q.treffen ?? [],
    koepfe: q.koepfe ?? [],
    heute: '2026-10-23',
    zeitzone: ZONE,
  });

describe('sitzungenOrdnen (S3-1)', () => {
  it('Serientermin (S5-1): das Protokoll hängt nur am Termin zu seinem Beginn, die anderen Wochen bleiben eigene', () => {
    const { kommend } = ordnen({
      termine: [termin(114, '2026-11-04T18:00:00Z'), termin(114, '2026-11-11T18:00:00Z')],
      koepfe: [
        kopf({
          sitzung: 'p1',
          status: 'entwurf',
          beginn: '2026-11-04T18:00:00Z',
          termin: { kalender: 4, id: 114 },
        }),
      ],
    });
    expect(kommend.map((s) => [s.beginn, s.kopf?.sitzung ?? null])).toEqual([
      ['2026-11-04T18:00:00Z', 'p1'],
      ['2026-11-11T18:00:00Z', null],
    ]);
  });

  it('ein einzelner, später verschobener Termin bleibt bei seinem Protokoll', () => {
    const { kommend } = ordnen({
      termine: [termin(120, '2026-11-12T18:00:00Z')],
      koepfe: [
        kopf({
          sitzung: 'p2',
          status: 'entwurf',
          beginn: '2026-11-11T18:00:00Z',
          termin: { kalender: 4, id: 120 },
        }),
      ],
    });
    expect(kommend).toHaveLength(1);
    expect(kommend[0].kopf?.sitzung).toBe('p2');
  });

  it('Termin und Gruppentreffen zur selben Minute sind EINE Sitzung', () => {
    const { kommend } = ordnen({
      termine: [termin(114, '2027-03-17T17:00:00Z')],
      treffen: [{ id: 15, beginn: '2027-03-17T17:00:00Z' }],
    });
    expect(kommend).toEqual([
      expect.objectContaining({
        titel: 'Leitungssitzung',
        termin: { kalender: 4, id: 114 },
        treffen: 15,
        kopf: null,
      }),
    ]);
  });

  it('Treffen ohne Termin heißt „Gruppentreffen“; Vergangenes ohne Protokoll fällt weg', () => {
    const { kommend, protokolle } = ordnen({
      termine: [termin(70, '2026-10-01T17:00:00Z')],
      treffen: [{ id: 16, beginn: '2026-11-04T18:00:00Z' }],
    });
    expect(kommend.map((s) => [s.titel, s.treffen])).toEqual([['Gruppentreffen', 16]]);
    expect(protokolle).toEqual([]);
  });

  it('heute zählt noch als kommend – nach Ortszeit, nicht UTC', () => {
    // 23.10. 23:30 in Berlin = 21:30 UTC
    const { kommend } = ordnen({ termine: [termin(1, '2026-10-23T21:30:00Z')] });
    expect(kommend).toHaveLength(1);
    // 22.10. 23:30 Berlin – gestern
    expect(ordnen({ termine: [termin(2, '2026-10-22T21:30:00Z')] }).kommend).toEqual([]);
  });

  it('Kopf übernimmt seinen Termin und sein Treffen (Verweis), Titel vom Kopf', () => {
    const k = kopf({
      sitzung: 'a',
      status: 'geplant',
      titel: 'Klausur',
      beginn: '2027-03-17T17:00:00Z',
      termin: { kalender: 4, id: 114 },
      treffen: 15,
    });
    const { kommend } = ordnen({
      termine: [termin(114, '2027-03-17T17:00:00Z', 'Leitungssitzung')],
      treffen: [{ id: 15, beginn: '2027-03-17T17:00:00Z' }],
      koepfe: [k],
    });
    expect(kommend).toEqual([
      expect.objectContaining({ schluessel: 'p:a', titel: 'Klausur', kopf: k }),
    ]);
  });

  it('Kopf ohne Verweis findet seinen Termin über den Beginn', () => {
    const k = kopf({ sitzung: 'b', status: 'geplant', beginn: '2027-03-17T17:00:00Z' });
    const { kommend } = ordnen({ termine: [termin(114, '2027-03-17T17:00:00Z')], koepfe: [k] });
    expect(kommend).toHaveLength(1);
    expect(kommend[0].termin).toEqual({ kalender: 4, id: 114 });
  });

  it('nicht freigegeben bleibt kommend – auch in der Vergangenheit; Protokolle: nur freigegebene, neueste zuerst', () => {
    const { kommend, protokolle } = ordnen({
      koepfe: [
        kopf({ sitzung: 'alt', beginn: '2026-09-01T17:00:00Z' }),
        kopf({ sitzung: 'neu', beginn: '2026-10-14T17:00:00Z' }),
        kopf({ sitzung: 'entwurf', status: 'entwurf', beginn: '2026-10-20T17:00:00Z' }),
      ],
    });
    expect(kommend.map((s) => s.schluessel)).toEqual(['p:entwurf']);
    expect(protokolle.map((s) => s.schluessel)).toEqual(['p:neu', 'p:alt']);
  });

  it('zwei Termine zur selben Minute bleiben zwei Sitzungen', () => {
    const { kommend } = ordnen({
      termine: [termin(1, '2027-01-01T17:00:00Z'), termin(2, '2027-01-01T17:00:00Z')],
    });
    expect(kommend).toHaveLength(2);
  });
});

describe('Antworten und nächste Sitzungen (S3-3)', () => {
  it('ChurchTools-Zustand → Antwort; Unbekanntes gilt als offen', () => {
    expect(['accepted', 'declined', 'tentative', 'pending', undefined].map(antwortAus)).toEqual([
      'zugesagt',
      'abgesagt',
      'vielleicht',
      'offen',
      'offen',
    ]);
  });

  it('Termin bringt seine Anfragen mit; meine Antwort, oder null wenn nicht eingeladen', () => {
    const t = {
      ...termin(114, '2027-03-17T17:00:00Z'),
      anfragen: [{ person: 19, antwort: 'abgesagt' as const }],
    };
    const { kommend } = ordnen({
      termine: [t],
      treffen: [{ id: 15, beginn: '2027-03-17T17:00:00Z' }],
    });
    expect(kommend[0].anfragen).toEqual([{ person: 19, antwort: 'abgesagt' }]);
    expect(meineAntwort(kommend[0], 19)).toBe('abgesagt');
    expect(meineAntwort(kommend[0], 1)).toBeNull();
  });

  it('über alle Gruppen, ab heute, früheste zuerst – ein Entwurf von gestern gehört nicht dazu', () => {
    const a = ordnen({ termine: [termin(2, '2027-01-10T17:00:00Z')] }).kommend;
    const b = ordnen({
      termine: [termin(3, '2026-11-01T17:00:00Z')],
      koepfe: [kopf({ sitzung: 'gestern', status: 'entwurf', beginn: '2026-10-22T17:00:00Z' })],
    }).kommend;
    const n = naechsteSitzungen(
      [
        { gruppe: { id: 1, name: 'A' }, kommend: a },
        { gruppe: { id: 2, name: 'B' }, kommend: b },
      ],
      '2026-10-23',
      ZONE,
    );
    expect(n.map((x) => [x.gruppe.name, x.sitzung.termin?.id ?? x.sitzung.schluessel])).toEqual([
      ['B', 3],
      ['A', 2],
    ]);
  });
});
