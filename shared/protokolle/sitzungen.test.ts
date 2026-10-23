import { describe, expect, it } from 'vitest';
import type { ProtokollKopf } from './speicher';
import { sitzungenOrdnen, type Termin, type Treffen } from './sitzungen';

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
