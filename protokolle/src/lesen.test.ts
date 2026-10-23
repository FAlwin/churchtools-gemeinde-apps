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
        anfragen: 1,
      },
      { kalender: 4, id: 115, titel: 'Raumputz', beginn: '2027-03-20T09:00:00Z', anfragen: 0 },
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

  it('Treffen nicht freigegeben (403): Kommend nur aus dem Kalender, und das wird gemeldet', async () => {
    await einrichten(4);
    ct.termine = [
      {
        kalender: 4,
        id: 114,
        titel: 'Leitungssitzung',
        beginn: '2027-03-17T17:00:00Z',
        anfragen: 2,
      },
    ];
    ct.treffenVerboten = true;
    const s = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(s.treffenNichtFreigegeben).toBe(true);
    expect(s.kommend.map((x) => x.termin?.id)).toEqual([114]);
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
