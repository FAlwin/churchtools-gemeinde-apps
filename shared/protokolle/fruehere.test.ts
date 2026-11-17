import { describe, expect, it } from 'vitest';
import {
  monatsZeitraum,
  NOCH_OHNE_TAGE,
  ohneProtokoll,
  ohneProtokollZeitraum,
  vorZeit,
} from './fruehere';
import { sitzungenOrdnen, type Termin, type Treffen } from './sitzungen';
import type { ProtokollKopf } from './speicher';

const ZONE = 'Europe/Berlin';
const HEUTE = '2026-11-17';
const kopf = (teil: Partial<ProtokollKopf>): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung: 's',
  titel: 'Techniker Treffen',
  status: 'frei',
  beginn: '2026-10-18T16:00:00Z',
  termin: null,
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: 'x',
  ...teil,
});
const termin = (id: number, beginn: string, titel = 'Techniker Treffen'): Termin => ({
  kalender: 4,
  id,
  titel,
  beginn,
  anfragen: [{ person: 1, antwort: 'zugesagt' }],
});
const treffen = (id: number, beginn: string, abgeschlossen = false): Treffen => ({
  id,
  beginn,
  ...(abgeschlossen ? { abgeschlossen: true } : {}),
});
/** Die Sitzungen, wie die Liste sie erzeugt – nicht von Hand gebaut. */
const protokolleAus = (koepfe: ProtokollKopf[]) =>
  sitzungenOrdnen({ termine: [], treffen: [], koepfe, heute: HEUTE, zeitzone: ZONE }).protokolle;

describe('ohneProtokollZeitraum – Block „Noch ohne Protokoll“', () => {
  it('seit dem letzten freigegebenen Protokoll (dessen Tag zählt nicht mehr), bis gestern', () => {
    const protokolle = protokolleAus([
      kopf({ sitzung: 'a', beginn: '2026-10-18T16:00:00Z' }),
      kopf({ sitzung: 'b', beginn: '2026-06-14T16:00:00Z' }),
    ]);
    expect(ohneProtokollZeitraum({ protokolle, heute: HEUTE, zeitzone: ZONE })).toEqual({
      von: '2026-10-19',
      bis: '2026-11-16',
      letztes: '2026-10-18',
    });
  });

  it('kein freigegebenes Protokoll: die letzten 28 Tage', () => {
    const z = ohneProtokollZeitraum({ protokolle: [], heute: HEUTE, zeitzone: ZONE });
    expect(NOCH_OHNE_TAGE).toBe(28);
    expect(z).toEqual({ von: '2026-10-20', bis: '2026-11-16', letztes: null });
  });

  it('nur Entwürfe und geplante zählen nicht als „letztes Protokoll“', () => {
    const protokolle = sitzungenOrdnen({
      termine: [],
      treffen: [],
      koepfe: [kopf({ sitzung: 'e', status: 'entwurf', beginn: '2026-11-01T16:00:00Z' })],
      heute: HEUTE,
      zeitzone: ZONE,
    }).kommend;
    expect(ohneProtokollZeitraum({ protokolle, heute: HEUTE, zeitzone: ZONE })?.letztes).toBeNull();
  });

  it('ein freigegebenes Protokoll von heute oder später zählt nicht (der Block bliebe sonst leer)', () => {
    const protokolle = protokolleAus([
      kopf({ sitzung: 'a', beginn: '2026-10-18T16:00:00Z' }),
      kopf({ sitzung: 'z', beginn: '2026-11-17T16:00:00Z' }),
      kopf({ sitzung: 'f', beginn: '2026-12-01T16:00:00Z' }),
    ]);
    expect(ohneProtokollZeitraum({ protokolle, heute: HEUTE, zeitzone: ZONE })?.letztes).toBe(
      '2026-10-18',
    );
  });

  it('das letzte Protokoll ist von gestern: nichts mehr zu schauen', () => {
    const protokolle = protokolleAus([kopf({ beginn: '2026-11-16T16:00:00Z' })]);
    expect(ohneProtokollZeitraum({ protokolle, heute: HEUTE, zeitzone: ZONE })).toBeNull();
  });

  it('der Tag zählt in der Zeitzone der Gemeinde (23:30 UTC am 17.10. ist schon der 18.10.)', () => {
    const protokolle = protokolleAus([kopf({ beginn: '2026-10-17T23:30:00Z' })]);
    expect(ohneProtokollZeitraum({ protokolle, heute: HEUTE, zeitzone: ZONE })?.letztes).toBe(
      '2026-10-18',
    );
  });
});

describe('„bis gestern“ und „Kommend ab heute“ schließen aneinander an', () => {
  it('eine Sitzung ohne Protokoll steht in genau einem von beiden', () => {
    const q = {
      termine: [] as Termin[],
      treffen: [
        treffen(1, '2026-11-16T22:30:00Z'), // 16.11. 23:30 Berlin = gestern
        treffen(2, '2026-11-16T23:30:00Z'), // 17.11. 00:30 Berlin = heute
        treffen(3, '2026-11-17T20:00:00Z'), // heute Abend
      ],
      koepfe: [] as ProtokollKopf[],
    };
    const kommend = sitzungenOrdnen({ ...q, heute: HEUTE, zeitzone: ZONE }).kommend;
    const zeitraum = ohneProtokollZeitraum({ protokolle: [], heute: HEUTE, zeitzone: ZONE })!;
    const block = ohneProtokoll({ ...q, zeitraum, zeitzone: ZONE });
    expect(block.map((s) => s.treffen)).toEqual([1]);
    expect(kommend.map((s) => s.treffen)).toEqual([2, 3]);
  });
});

describe('monatsZeitraum – Fenster „Protokoll nachtragen“', () => {
  it('ein vergangener Monat: ganz', () => {
    expect(monatsZeitraum('2026-10', HEUTE)).toEqual({ von: '2026-10-01', bis: '2026-10-31' });
    expect(monatsZeitraum('2028-02', '2029-01-01')).toEqual({
      von: '2028-02-01',
      bis: '2028-02-29',
    });
  });

  it('der laufende Monat: bis gestern', () => {
    expect(monatsZeitraum('2026-11', HEUTE)).toEqual({ von: '2026-11-01', bis: '2026-11-16' });
  });

  it('am 1. des Monats und in der Zukunft: nichts zu lesen', () => {
    expect(monatsZeitraum('2026-11', '2026-11-01')).toBeNull();
    expect(monatsZeitraum('2026-12', HEUTE)).toBeNull();
  });
});

describe('ohneProtokoll', () => {
  const zeitraum = { von: '2026-10-19', bis: '2026-11-16' };

  it('Termin und Treffen zur selben Minute sind EINE Sitzung; abgeschlossen wird mitgenommen', () => {
    const s = ohneProtokoll({
      termine: [termin(114, '2026-11-15T16:00:00Z')],
      treffen: [treffen(24, '2026-11-15T16:00:00Z', true)],
      koepfe: [],
      zeitraum,
      zeitzone: ZONE,
    });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      termin: { kalender: 4, id: 114 },
      treffen: 24,
      abgeschlossen: true,
      titel: 'Techniker Treffen',
    });
  });

  it('ein Treffen, das nicht abgeschlossen ist, trägt das Merkmal nicht', () => {
    const [s] = ohneProtokoll({
      termine: [],
      treffen: [treffen(24, '2026-11-15T16:00:00Z')],
      koepfe: [],
      zeitraum,
      zeitzone: ZONE,
    });
    expect(s.abgeschlossen).toBeUndefined();
  });

  it.each(['entwurf', 'geplant', 'frei'] as const)(
    'ein Treffen mit Protokoll (%s) taucht nicht auf – über das Treffen und über den Termin',
    (status) => {
      const koepfe = [
        kopf({ sitzung: 'a', status, beginn: '2026-11-15T16:00:00Z', treffen: 24 }),
        kopf({
          sitzung: 'b',
          status,
          beginn: '2026-11-08T16:00:00Z',
          termin: { kalender: 4, id: 115 },
        }),
      ];
      const s = ohneProtokoll({
        termine: [termin(114, '2026-11-15T16:00:00Z'), termin(115, '2026-11-08T16:00:00Z')],
        treffen: [treffen(24, '2026-11-15T16:00:00Z'), treffen(25, '2026-11-01T16:00:00Z')],
        koepfe,
        zeitraum,
        zeitzone: ZONE,
      });
      expect(s.map((x) => x.treffen)).toEqual([25]);
    },
  );

  it('Serie, nur ein Monat gelesen: das Protokoll einer anderen Woche hängt nicht am falschen Termin', () => {
    // Im Monat kommt der Serientermin nur einmal vor – ohne `serieImmer` sähe das nach „einzelner Termin“ aus.
    const koepfe = [
      kopf({ sitzung: 'x', beginn: '2026-10-04T16:00:00Z', termin: { kalender: 4, id: 114 } }),
    ];
    const s = ohneProtokoll({
      termine: [termin(114, '2026-11-01T16:00:00Z')],
      treffen: [],
      koepfe,
      zeitraum: { von: '2026-11-01', bis: '2026-11-16' },
      zeitzone: ZONE,
    });
    expect(s.map((x) => x.termin?.id)).toEqual([114]);
  });

  it('Grenzen des Zeitraums (Ortstag) und neueste zuerst', () => {
    const s = ohneProtokoll({
      termine: [],
      treffen: [
        treffen(1, '2026-10-18T21:00:00Z'), // 18.10. 23:00 – vor von
        treffen(2, '2026-10-18T22:30:00Z'), // 19.10. 00:30 – erster Tag
        treffen(3, '2026-11-16T22:00:00Z'), // 16.11. 23:00 – letzter Tag
        treffen(4, '2026-11-16T23:30:00Z'), // 17.11. 00:30 – heute, nicht mehr
      ],
      koepfe: [],
      zeitraum,
      zeitzone: ZONE,
    });
    expect(s.map((x) => x.treffen)).toEqual([3, 2]);
  });
});

describe('vorZeit', () => {
  it('gestern, Tage, Wochen, Monate', () => {
    expect(vorZeit('2026-11-16', HEUTE)).toBe('gestern');
    expect(vorZeit('2026-11-15', HEUTE)).toBe('vor 2 Tagen');
    expect(vorZeit('2026-10-18', HEUTE)).toBe('vor 4 Wochen');
    expect(vorZeit('2026-07-12', HEUTE)).toBe('vor 4 Monaten');
  });
});
