import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollKopf } from '@shared/protokolle/speicher';
import { gruppeEinrichten } from './einrichten';
import {
  koepfeAus,
  ladeSitzungen,
  sitzungenNochOhneProtokoll,
  sitzungenOhneProtokoll,
} from './lesen';
import {
  kategorieVon,
  LEITER,
  MODUL,
  nachbauEnde,
  nachbauStarten,
  TEILNEHMER,
  werteVon,
  type Nachbau,
} from './nachbau.testhilfe';

/** „Frühere Treffen“ (v1.0.1) – Lesen für beliebige Zeiträume, gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const JETZT = new Date('2026-11-17T10:00:00Z'); // Di 17.11.2026
const ZONE = 'Europe/Berlin';

const einrichten = (kalender: number | null) =>
  gruppeEinrichten(
    MODUL,
    { id: 194, name: 'Technik', versteckt: false },
    {
      rollen: [
        { rolle: LEITER, stufe: 'leitung' },
        { rolle: TEILNEHMER, stufe: 'mitglied' },
      ],
      punkte: 'vorschlagen',
      kalender,
    },
  );
const gruppe = () => ({
  id: 194,
  protokolle: kategorieVon(ct, 'protokolle-g194'),
  mitarbeit: kategorieVon(ct, 'mitarbeit-g194'),
});
const protokollAblegen = (teil: Partial<ProtokollKopf> & { sitzung: string }) => {
  const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, teil.sitzung);
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    titel: 'Techniker Treffen',
    status: 'frei',
    beginn: '2026-10-18T15:00:00Z',
    termin: null,
    treffen: null,
    freigabe: null,
    sperre: null,
    stand,
    ...teil,
  };
  const liste = werteVon(ct, gruppe().protokolle);
  for (const v of [JSON.stringify(kopf), ...werte]) liste.push({ id: ct.naechste++, value: v });
};
const TERMIN = {
  kalender: 4,
  id: 114,
  titel: 'Techniker Treffen',
  beginn: '2026-11-15T16:00:00Z',
  anfragen: [
    { person: 1, state: 'accepted' },
    { person: 19, state: 'declined' },
  ],
};

beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

describe('sitzungenOhneProtokoll', () => {
  beforeEach(async () => {
    await einrichten(4);
  });

  it('liest Kalender und Treffen genau für den gefragten Zeitraum', async () => {
    ct.treffen.set(194, [{ id: 1, startDate: '2026-09-20T15:00:00Z' }]);
    const r = await sitzungenOhneProtokoll({
      modul: MODUL,
      gruppe: 194,
      kalender: 4,
      koepfe: [],
      zeitraum: { von: '2026-10-01', bis: '2026-10-31' },
      zeitzone: ZONE,
    });
    expect(ct.terminAnfrage).toBe('2026-10-01..2026-10-31');
    expect(r.sitzungen).toEqual([]);
  });

  it('Termin + Gruppentreffen zur selben Minute: eine Sitzung, mit Zusagen und „abgeschlossen“', async () => {
    ct.termine = [TERMIN];
    ct.treffen.set(194, [
      { id: 24, startDate: '2026-11-15T16:00:00Z', isCompleted: true },
      { id: 25, startDate: '2026-11-08T16:00:00Z', isCanceled: true },
    ]);
    const r = await sitzungenOhneProtokoll({
      modul: MODUL,
      gruppe: 194,
      kalender: 4,
      koepfe: [],
      zeitraum: { von: '2026-11-01', bis: '2026-11-16' },
      zeitzone: ZONE,
    });
    expect(r.sitzungen).toHaveLength(1);
    expect(r.sitzungen[0]).toMatchObject({
      termin: { kalender: 4, id: 114 },
      treffen: 24,
      abgeschlossen: true,
      anfragen: [
        { person: 1, antwort: 'zugesagt' },
        { person: 19, antwort: 'abgesagt' },
      ],
    });
  });

  it('ein Treffen mit Protokoll-Kopf (egal welcher Status) kommt nicht', async () => {
    ct.termine = [TERMIN];
    ct.treffen.set(194, [{ id: 24, startDate: '2026-11-15T16:00:00Z' }]);
    protokollAblegen({ sitzung: 'e', status: 'entwurf', beginn: TERMIN.beginn, treffen: 24 });
    const koepfe = koepfeAus({
      kommend: (await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT)).kommend,
      protokolle: [],
    });
    expect(koepfe).toHaveLength(1);
    const r = await sitzungenOhneProtokoll({
      modul: MODUL,
      gruppe: 194,
      kalender: 4,
      koepfe,
      zeitraum: { von: '2026-11-01', bis: '2026-11-16' },
      zeitzone: ZONE,
    });
    expect(r.sitzungen).toEqual([]);
  });

  it('ohne Kalender: nur Gruppentreffen, kein Kalender-Aufruf', async () => {
    ct.treffen.set(194, [{ id: 24, startDate: '2026-11-15T16:00:00Z' }]);
    const r = await sitzungenOhneProtokoll({
      modul: MODUL,
      gruppe: 194,
      kalender: null,
      koepfe: [],
      zeitraum: { von: '2026-11-01', bis: '2026-11-16' },
      zeitzone: ZONE,
    });
    expect(ct.terminAnfrage).toBeNull();
    expect(r.sitzungen.map((s) => s.treffen)).toEqual([24]);
  });

  it('Gruppentreffen nicht freigegeben (403): nur der Kalender, und es wird gemeldet', async () => {
    ct.termine = [TERMIN];
    ct.treffenVerboten = true;
    const r = await sitzungenOhneProtokoll({
      modul: MODUL,
      gruppe: 194,
      kalender: 4,
      koepfe: [],
      zeitraum: { von: '2026-11-01', bis: '2026-11-16' },
      zeitzone: ZONE,
    });
    expect(r.treffenNichtFreigegeben).toBe(true);
    expect(r.sitzungen.map((s) => s.termin?.id)).toEqual([114]);
  });

  it('vorübergehender Fehler: wirft statt „nichts nachzutragen“', async () => {
    ct.fehlerBei = { methode: 'GET', status: 503 };
    await expect(
      sitzungenOhneProtokoll({
        modul: MODUL,
        gruppe: 194,
        kalender: 4,
        koepfe: [],
        zeitraum: { von: '2026-11-01', bis: '2026-11-16' },
        zeitzone: ZONE,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('sitzungenNochOhneProtokoll – der Block', () => {
  beforeEach(async () => {
    await einrichten(4);
  });

  it('seit dem letzten freigegebenen Protokoll: ältere Treffen kommen nicht, das letzte selbst auch nicht', async () => {
    ct.treffen.set(194, [
      { id: 1, startDate: '2026-10-04T15:00:00Z' }, // vor dem letzten Protokoll
      { id: 2, startDate: '2026-10-18T15:00:00Z' }, // das Protokoll selbst
      { id: 3, startDate: '2026-10-25T15:00:00Z' },
      { id: 4, startDate: '2026-11-15T16:00:00Z' },
    ]);
    protokollAblegen({ sitzung: 'okt', beginn: '2026-10-18T15:00:00Z', treffen: 2 });
    const daten = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    const s = await sitzungenNochOhneProtokoll(MODUL, { id: 194 }, daten, ZONE, JETZT);
    expect(s.map((x) => x.treffen)).toEqual([4, 3]);
    expect(ct.terminAnfrage).toBe('2026-10-19..2026-11-16');
  });

  it('kein freigegebenes Protokoll: die letzten 28 Tage', async () => {
    ct.treffen.set(194, [
      { id: 1, startDate: '2026-10-10T15:00:00Z' },
      { id: 2, startDate: '2026-10-25T15:00:00Z' },
    ]);
    const daten = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    const s = await sitzungenNochOhneProtokoll(MODUL, { id: 194 }, daten, ZONE, JETZT);
    expect(s.map((x) => x.treffen)).toEqual([2]);
    expect(ct.terminAnfrage).toBe('2026-10-20..2026-11-16');
  });

  it('heute steht in „Kommend“, nicht im Block', async () => {
    ct.treffen.set(194, [{ id: 7, startDate: '2026-11-17T17:00:00Z' }]);
    const daten = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(daten.kommend.map((x) => x.treffen)).toEqual([7]);
    expect(await sitzungenNochOhneProtokoll(MODUL, { id: 194 }, daten, ZONE, JETZT)).toEqual([]);
  });

  it('war das letzte Protokoll gestern: nichts zu schauen, ChurchTools wird nicht gefragt', async () => {
    protokollAblegen({ sitzung: 'gestern', beginn: '2026-11-16T15:00:00Z' });
    const daten = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    ct.terminAnfrage = null;
    ct.aufrufe.length = 0;
    expect(await sitzungenNochOhneProtokoll(MODUL, { id: 194 }, daten, ZONE, JETZT)).toEqual([]);
    expect(ct.terminAnfrage).toBeNull();
    expect(ct.aufrufe).toEqual([]);
  });
});

describe('ladeSitzungen – Gruppentreffen abgeschlossen, Protokoll zu vergangenem Treffen', () => {
  beforeEach(async () => {
    await einrichten(4);
  });

  it('nimmt isCompleted des Gruppentreffens als „abgeschlossen“ mit', async () => {
    ct.treffen.set(194, [
      { id: 7, startDate: '2026-11-20T17:00:00Z', isCompleted: true },
      { id: 8, startDate: '2026-11-27T17:00:00Z' },
    ]);
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(s.kommend.map((x) => [x.treffen, x.abgeschlossen])).toEqual([
      [7, true],
      [8, undefined],
    ]);
  });

  it('ein Entwurf zu einem VERGANGENEN Termin bekommt die Antworten auf die Einladung (Anwesenheit wird daraus vorbelegt)', async () => {
    ct.termine = [TERMIN];
    protokollAblegen({
      sitzung: 'nov',
      status: 'entwurf',
      beginn: TERMIN.beginn,
      termin: { kalender: 4, id: 114 },
    });
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(s.kommend.map((x) => [x.schluessel, x.anfragen])).toEqual([
      [
        'p:nov',
        [
          { person: 1, antwort: 'zugesagt' },
          { person: 19, antwort: 'abgesagt' },
        ],
      ],
    ]);
  });

  it('ein freigegebenes Protokoll zu einem vergangenen Termin löst keinen zusätzlichen Aufruf aus', async () => {
    protokollAblegen({ sitzung: 'okt', termin: { kalender: 4, id: 114 } });
    await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(ct.aufrufe.some((a) => /^GET \/calendars\/4\/appointments\/\d+$/.test(a))).toBe(false);
  });
});
