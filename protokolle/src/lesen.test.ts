import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { dokumentAusTeilen, teileBauen, type ProtokollKopf } from '@shared/protokolle/speicher';
import { neueAufgabe, alsGeloescht } from '@shared/protokolle/aufgaben';
import { gruppeEinrichten } from './einrichten';
import { ladeAufgaben, ladeSitzungen } from './lesen';
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

/** Lesen (S3-1) gegen die nachgestellte ChurchTools-Instanz (`nachbau.testhilfe.ts`). */
let ct: Nachbau;
const JETZT = new Date('2026-10-23T10:00:00Z');
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
/** Ein Protokoll so in den Speicher legen, wie S4 es schreiben wird: Kopf + Teile aus `teileBauen`. */
const protokollAblegen = (teil: Partial<ProtokollKopf> & { sitzung: string }) => {
  const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, teil.sitzung);
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    titel: 'Leitungssitzung',
    status: 'frei',
    beginn: '2026-10-14T17:00:00Z',
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

beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

describe('ladeSitzungen (S3-1)', () => {
  it('Kommend: nur Termine MIT Besprechungsanfrage, mit dem Treffen zur selben Minute; Protokolle aus dem Speicher', async () => {
    await einrichten(4);
    ct.termine = [
      {
        kalender: 4,
        id: 114,
        titel: 'Leitungssitzung',
        beginn: '2027-03-17T17:00:00Z',
        anfragen: [{ person: 1, state: 'accepted' }],
      },
      { kalender: 4, id: 115, titel: 'Raumputz', beginn: '2027-03-20T09:00:00Z', anfragen: [] },
    ];
    ct.treffen.set(194, [
      { id: 15, startDate: '2027-03-17T17:00:00Z' },
      { id: 16, startDate: '2027-04-01T17:00:00Z', isCanceled: true },
    ]);
    protokollAblegen({ sitzung: 'okt' });
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(s.kommend.map((x) => [x.titel, x.termin?.id, x.treffen])).toEqual([
      ['Leitungssitzung', 114, 15],
    ]);
    expect(s.protokolle.map((x) => x.kopf?.sitzung)).toEqual(['okt']);
    expect(s.kalender).toBe(4);
    expect(s.treffenNichtFreigegeben).toBe(false);
    // Das Dokument lässt sich aus den gelesenen Teilen wiederherstellen.
    expect(dokumentAusTeilen(s.protokolle[0].kopf!, s.teile)).toEqual(BLOCKNOTE_DOKUMENT);
  });

  it('fragt den Kalender ab heute für 180 Tage, in der Zeitzone der Gemeinde', async () => {
    await einrichten(4);
    await ladeSitzungen(MODUL, gruppe(), ZONE, new Date('2026-10-22T22:30:00Z')); // 23.10. 00:30 in Berlin
    expect(ct.terminAnfrage).toBe('2026-10-23..2027-04-21');
  });

  it('ein Treffen am letzten Tag von „Kommend“ kommt mit (ChurchTools zählt end_date nicht mit, gemessen 28.10.)', async () => {
    await einrichten(4);
    ct.treffen.set(194, [{ id: 17, startDate: '2027-04-21T17:00:00Z' }]);
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, new Date('2026-10-22T22:30:00Z'));
    expect(s.kommend.map((x) => x.treffen)).toEqual([17]);
  });

  it('Treffen nicht freigegeben (403): Kommend nur aus dem Kalender, und das wird gemeldet', async () => {
    await einrichten(4);
    ct.termine = [
      {
        kalender: 4,
        id: 114,
        titel: 'Leitungssitzung',
        beginn: '2027-03-17T17:00:00Z',
        anfragen: [
          { person: 1, state: 'accepted' },
          { person: 19, state: 'pending' },
        ],
      },
    ];
    ct.treffenVerboten = true;
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(s.treffenNichtFreigegeben).toBe(true);
    expect(s.kommend.map((x) => x.termin?.id)).toEqual([114]);
  });

  it('S3-3: Besprechungsanfragen mit Person und Antwort – für „du hast zugesagt“ und „2 von 3“', async () => {
    await einrichten(4);
    ct.termine = [
      {
        kalender: 4,
        id: 114,
        titel: 'Leitungssitzung',
        beginn: '2027-03-17T17:00:00Z',
        anfragen: [
          { person: 1, state: 'accepted' },
          { person: 19, state: 'declined' },
          { person: 23, state: 'pending' },
        ],
      },
    ];
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(s.kommend[0].anfragen).toEqual([
      { person: 1, antwort: 'zugesagt' },
      { person: 19, antwort: 'abgesagt' },
      { person: 23, antwort: 'offen' },
    ]);
  });

  describe('Protokolle hinter dem Lesefenster (180 Tage)', () => {
    // Bemerkt beim Prüfen von K2b 29.10.2026: Eine geplante Sitzung im Mai 2027 kam ohne Einladungen in den Kasten
    // „Nächste Sitzung“ und auf die Startseite – die Liste fragt den Kalender nur bis 21.04.2027.
    const SPAET = '2027-05-26T17:30:00Z';
    beforeEach(async () => {
      await einrichten(4);
    });

    it('geplant mit Termin: Termin und Einladungen werden gezielt nachgelesen', async () => {
      ct.termine = [
        {
          kalender: 4,
          id: 181,
          titel: 'Klausur',
          beginn: SPAET,
          ende: '2027-05-26T19:30:00Z',
          anfragen: [
            { person: 1, state: 'accepted' },
            { person: 19, state: 'pending' },
          ],
        },
      ];
      protokollAblegen({
        sitzung: 'mai',
        status: 'geplant',
        beginn: SPAET,
        termin: { kalender: 4, id: 181 },
      });
      const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
      expect(s.kommend).toHaveLength(1);
      expect(s.kommend[0]).toMatchObject({
        schluessel: 'p:mai',
        ende: '2027-05-26T19:30:00Z',
        anfragen: [
          { person: 1, antwort: 'zugesagt' },
          { person: 19, antwort: 'offen' },
        ],
      });
    });

    it('Serie: der Termin dieser Sitzung (Beginn des Kopfs, Dauer der Serie), einmal gelesen', async () => {
      ct.termine = [
        {
          kalender: 4,
          id: 90,
          titel: 'Leitungssitzung',
          beginn: '2026-11-04T18:30:00Z',
          ende: '2026-11-04T20:00:00Z',
          repeatId: 7,
          felder: { repeatUntil: '2027-12-31' },
          anfragen: [{ person: 19, state: 'accepted' }],
        },
      ];
      for (const [sitzung, beginn] of [
        ['a', '2027-05-26T17:30:00Z'],
        ['b', '2027-06-02T17:30:00Z'],
      ])
        protokollAblegen({ sitzung, status: 'entwurf', beginn, termin: { kalender: 4, id: 90 } });
      const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
      const spaet = s.kommend.filter((x) => x.kopf);
      expect(spaet.map((x) => [x.kopf?.sitzung, x.ende, x.anfragen.length])).toEqual([
        ['a', '2027-05-26T19:00:00Z', 1],
        ['b', '2027-06-02T19:00:00Z', 1],
      ]);
      expect(ct.aufrufe.filter((a) => a === 'GET /calendars/4/appointments/90')).toHaveLength(1);
    });

    it('Termin in ChurchTools ins Fenster verschoben, Protokoll noch auf der alten Zeit: nicht doppelt', async () => {
      ct.termine = [
        {
          kalender: 4,
          id: 114,
          titel: 'Leitungssitzung',
          beginn: '2027-03-17T17:00:00Z',
          anfragen: [{ person: 1, state: 'accepted' }],
        },
      ];
      protokollAblegen({
        sitzung: 'alt',
        status: 'entwurf',
        beginn: SPAET,
        termin: { kalender: 4, id: 114 },
      });
      const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
      expect(s.kommend.map((x) => [x.schluessel, x.anfragen.length])).toEqual([['p:alt', 1]]);
    });

    it('Termin inzwischen gelöscht (404): die Sitzung bleibt, ohne Einladungen', async () => {
      protokollAblegen({
        sitzung: 'mai',
        status: 'geplant',
        beginn: SPAET,
        termin: { kalender: 4, id: 999 },
      });
      const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
      expect(s.kommend.map((x) => [x.schluessel, x.anfragen])).toEqual([['p:mai', []]]);
    });

    it('freigegebene und Protokolle im Fenster: kein zusätzlicher Aufruf', async () => {
      ct.termine = [
        {
          kalender: 4,
          id: 114,
          titel: 'Leitungssitzung',
          beginn: '2027-03-17T17:00:00Z',
          anfragen: [{ person: 1, state: 'accepted' }],
        },
      ];
      protokollAblegen({ sitzung: 'frei', beginn: SPAET, termin: { kalender: 4, id: 181 } });
      protokollAblegen({
        sitzung: 'maerz',
        status: 'entwurf',
        beginn: '2027-03-17T17:00:00Z',
        termin: { kalender: 4, id: 114 },
      });
      const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
      expect(s.kommend.find((x) => x.schluessel === 'p:maerz')?.anfragen).toHaveLength(1);
      expect(ct.aufrufe.some((a) => /^GET \/calendars\/4\/appointments\/\d+$/.test(a))).toBe(false);
    });
  });

  it('ohne Kalender in der Einstellung: kein Kalender-Aufruf, nur Treffen', async () => {
    await einrichten(null);
    ct.treffen.set(194, [{ id: 15, startDate: '2027-03-17T17:00:00Z' }]);
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(ct.terminAnfrage).toBeNull();
    expect(s.kommend.map((x) => [x.titel, x.treffen])).toEqual([['Gruppentreffen', 15]]);
  });

  it('vorübergehender Fehler: wirft – keine leere Liste', async () => {
    await einrichten(4);
    ct.fehlerBei = { methode: 'GET', status: 503 };
    await expect(ladeSitzungen(MODUL, gruppe(), ZONE, JETZT)).rejects.toBeInstanceOf(ApiError);
  });

  it('übergeht fremde und kaputte Werte in der Kategorie', async () => {
    await einrichten(4);
    werteVon(ct, gruppe().protokolle).push(
      { id: 999, value: '{kaputt' },
      { id: 998, value: '{"art":"fremd"}' },
    );
    protokollAblegen({ sitzung: 'okt' });
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(s.protokolle).toHaveLength(1);
    expect(s.kommend).toEqual([]); // ein fremder Wert wird nicht zur „Sitzung“
  });
});

describe('ladeAufgaben (S3-1)', () => {
  it('liest die Aufgaben der Gruppe, gelöschte nicht', async () => {
    await einrichten(null);
    const a = neueAufgabe({
      id: 'a1',
      gruppe: 194,
      sitzung: 'okt',
      text: 'Saal buchen',
      wer: [1],
      bis: '2026-11-01',
      von: 1,
      am: '2026-10-14T18:00:00Z',
    });
    const weg = alsGeloescht({ ...a, id: 'a2' }, 1, '2026-10-15T08:00:00Z');
    const liste = werteVon(ct, gruppe().mitarbeit);
    liste.push({ id: 1, value: JSON.stringify(a) }, { id: 2, value: JSON.stringify(weg) });
    expect((await ladeAufgaben(MODUL, gruppe())).map((x) => x.id)).toEqual(['a1']);
  });

  it('ohne Mitarbeit-Kategorie: keine Aufgaben, kein Aufruf', async () => {
    expect(await ladeAufgaben(MODUL, { mitarbeit: null })).toEqual([]);
    expect(ct.aufrufe).toEqual([]);
  });
});
