import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { istKopf, type ProtokollKopf } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { geplanterKopf } from '@shared/protokolle/planen';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { SERIE, sitzungAbsagen, sitzungAendern } from './bearbeiten';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** „Sitzung bearbeiten“ (K2b-1) gegen die nachgestellte ChurchTools-Instanz – verhält sich wie am 29.10.2026 gemessen. */
let ct: Nachbau;
const KAT = 62;
const BEGINN = '2027-05-26T17:30:00Z';
const ENDE = '2027-05-26T19:30:00Z';
const SPAETER = { beginn: '2027-05-27T16:00:00Z', ende: '2027-05-27T18:00:00Z' };

const koepfe = (): ProtokollKopf[] =>
  werteVon(ct, KAT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istKopf);
const termin = () => ct.termine.find((t) => t.id === 70);
const treffen = () => ct.treffen.get(194)?.find((t) => t.id === 80);

/** Termin 70 (Alwin + Spike, Spike hat zugesagt), Treffen 80 mit Kommentar, geplanter Kopf „s1“. */
function sitzung(teil: Partial<Sitzung> = {}): Sitzung {
  const kopf = geplanterKopf(
    { titel: 'Leitungssitzung', beginn: BEGINN, termin: { kalender: 4, id: 70 }, treffen: 80 },
    's1',
  );
  return {
    schluessel: 'p:s1',
    beginn: BEGINN,
    ende: ENDE,
    titel: 'Leitungssitzung',
    termin: { kalender: 4, id: 70 },
    treffen: 80,
    kopf,
    anfragen: [
      { person: 1, antwort: 'zugesagt' },
      { person: 19, antwort: 'zugesagt' },
    ],
    ...teil,
  };
}

beforeEach(() => {
  ct = nachbauStarten();
  ct.termine.push({
    kalender: 4,
    id: 70,
    titel: 'Leitungssitzung',
    beginn: BEGINN,
    ende: ENDE,
    anfragen: [
      { person: 1, state: 'accepted', id: 501 },
      { person: 19, state: 'accepted', id: 502 },
    ],
    felder: { description: 'Bitte Unterlagen mitbringen', address: { name: 'Gemeindehaus' } },
  });
  ct.treffen.set(194, [
    { id: 80, startDate: BEGINN, isCanceled: false, isCompleted: false, comment: 'Raum 2' },
  ]);
  werteVon(ct, KAT).push({ id: 5, value: JSON.stringify(sitzung().kopf) });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

const aendern = (q: Partial<Parameters<typeof sitzungAendern>[0]> = {}) =>
  sitzungAendern({
    modul: MODUL,
    kategorie: KAT,
    gruppe: 194,
    sitzung: sitzung(),
    neu: { titel: 'Leitungssitzung', beginn: BEGINN, ende: ENDE },
    nachher: [1, 19],
    neuEinladen: false,
    ...q,
  });

describe('sitzungAendern', () => {
  it('verschieben, „Alle neu einladen“: eine Mail „Termin geändert“, Zusage zurück; Treffen und Kopf ziehen mit', async () => {
    const r = await aendern({ neu: { titel: 'Leitungssitzung', ...SPAETER }, neuEinladen: true });
    expect(r.hinweise).toEqual([]);
    expect(ct.mails).toEqual([{ person: 19, art: 'geaendert' }]);
    expect(termin()).toMatchObject({ beginn: SPAETER.beginn, ende: SPAETER.ende });
    expect(termin()?.anfragen.find((a) => a.person === 19)?.state).toBe('pending');
    // Was ein `PUT` sonst leeren würde, bleibt – der gelesene Termin geht unverändert zurück.
    expect(termin()?.felder).toEqual({
      description: 'Bitte Unterlagen mitbringen',
      address: { name: 'Gemeindehaus' },
    });
    expect(treffen()).toMatchObject({ startDate: SPAETER.beginn, comment: 'Raum 2' });
    expect(koepfe()[0]).toMatchObject({ sitzung: 's1', beginn: SPAETER.beginn, status: 'geplant' });
  });

  it('verschieben ohne „neu einladen“: still, die Zusage bleibt', async () => {
    await aendern({ neu: { titel: 'Leitungssitzung', ...SPAETER } });
    expect(ct.mails).toEqual([]);
    expect(termin()?.anfragen.find((a) => a.person === 19)?.state).toBe('accepted');
    expect(ct.aufrufe.filter((a) => a.startsWith('PUT /calendars'))).toHaveLength(1);
  });

  it('nur den Titel ändern: still – auch wenn „neu einladen“ an ist (gilt nur für eine neue Zeit)', async () => {
    await aendern({ neu: { titel: ' Klausur ', beginn: BEGINN, ende: ENDE }, neuEinladen: true });
    expect(ct.mails).toEqual([]);
    expect(termin()?.titel).toBe('Klausur');
    expect(koepfe()[0].titel).toBe('Klausur');
    // Ohne neue Zeit bleibt das Treffen unberührt.
    expect(ct.aufrufe.some((a) => a.startsWith('PUT /groups'))).toBe(false);
  });

  it('ein- und ausladen einzeln: Mail nur an die Betroffenen, Termin wird dafür nicht geschrieben', async () => {
    await aendern({ nachher: [1, 7] });
    expect(ct.mails).toEqual([
      { person: 19, art: 'geloescht' },
      { person: 7, art: 'neu' },
    ]);
    expect(
      termin()
        ?.anfragen.map((a) => a.person)
        .sort(),
    ).toEqual([1, 7]);
    expect(ct.aufrufe.some((a) => a.startsWith('PUT /calendars'))).toBe(false);
  });

  it('verschieben + neu einladen + ausladen: alles über die Liste – keine Einzelaufrufe', async () => {
    await aendern({
      neu: { titel: 'Leitungssitzung', ...SPAETER },
      nachher: [1, 7],
      neuEinladen: true,
    });
    expect(ct.mails).toEqual([
      { person: 19, art: 'geloescht' },
      { person: 7, art: 'neu' },
    ]);
    expect(
      ct.aufrufe.some((a) => /meetingrequests\/\d+$/.test(a) || a.startsWith('POST /calendars')),
    ).toBe(false);
  });

  it('Serie: abgewiesen, bevor etwas geschrieben ist', async () => {
    termin()!.repeatId = 7;
    const e: unknown = await aendern({ neu: { titel: 'Leitungssitzung', ...SPAETER } }).catch(
      (x: unknown) => x,
    );
    expect(fehlerMeldung(e).text).toBe(SERIE);
    expect(ct.aufrufe.some((a) => a.startsWith('PUT'))).toBe(false);
  });

  it('ChurchTools lehnt ab (403 mit Rumpf): Fehler, nichts weiter geschrieben', async () => {
    ct.terminAendernFehler = { status: 403, angelegt: false, ctVerbot: true };
    await expect(aendern({ neu: { titel: 'Leitungssitzung', ...SPAETER } })).rejects.toThrow(
      'keine Termine ändern',
    );
    expect(treffen()?.startDate).toBe(BEGINN);
    expect(koepfe()[0].beginn).toBe(BEGINN);
  });

  it('unklare Antwort, aber übernommen: nachgelesen – weiter wie sonst', async () => {
    ct.terminAendernFehler = { status: 504, angelegt: true };
    const r = await aendern({ neu: { titel: 'Leitungssitzung', ...SPAETER } });
    expect(r.hinweise).toEqual([]);
    expect(koepfe()[0].beginn).toBe(SPAETER.beginn);
  });

  it('unklare Antwort, nicht übernommen: „nicht übernommen – noch einmal“; Treffen und Kopf bleiben', async () => {
    ct.terminAendernFehler = { status: 504, angelegt: false };
    const e: unknown = await aendern({ neu: { titel: 'Leitungssitzung', ...SPAETER } }).catch(
      (x: unknown) => x,
    );
    expect(fehlerMeldung(e)).toEqual({
      text: 'ChurchTools hat die Änderung am Termin nicht übernommen. Bitte noch einmal versuchen.',
      nochmal: true,
    });
    expect(treffen()?.startDate).toBe(BEGINN);
  });

  it('Treffen scheitert: Hinweis, Termin und Kopf sind trotzdem verschoben', async () => {
    ct.treffenVerboten = true;
    const r = await aendern({ neu: { titel: 'Leitungssitzung', ...SPAETER } });
    expect(r.hinweise).toEqual([
      expect.stringContaining('Gruppentreffen steht noch auf der alten Zeit'),
    ]);
    expect(termin()?.beginn).toBe(SPAETER.beginn);
    expect(koepfe()[0].beginn).toBe(SPAETER.beginn);
  });

  it('Kopf scheitert: Hinweis', async () => {
    ct.schlucken.add('PUT WERT');
    const r = await aendern({ neu: { titel: 'Klausur', beginn: BEGINN, ende: ENDE } });
    expect(r.hinweise).toEqual([expect.stringContaining('alte Titel')]);
  });

  it('Protokoll ohne Termin (K2a): nur Kopf und Treffen', async () => {
    const r = await aendern({
      sitzung: sitzung({ termin: null, anfragen: [] }),
      neu: { titel: 'Leitungssitzung', ...SPAETER },
      nachher: [],
    });
    expect(r.hinweise).toEqual([]);
    expect(ct.aufrufe.some((a) => a.includes('/calendars/'))).toBe(false);
    expect(treffen()?.startDate).toBe(SPAETER.beginn);
    expect(koepfe()[0].beginn).toBe(SPAETER.beginn);
  });
});

const absagen = (teil: Partial<Sitzung> = {}) =>
  sitzungAbsagen({ modul: MODUL, kategorie: KAT, gruppe: 194, sitzung: sitzung(teil) });

describe('sitzungAbsagen', () => {
  it('geplant: Termin weg (Mail „Termin gelöscht“), Treffen weg, geplante Sitzung weg', async () => {
    expect((await absagen()).hinweise).toEqual([]);
    expect(termin()).toBeUndefined();
    expect(ct.mails).toEqual([{ person: 19, art: 'geloescht' }]);
    expect(treffen()).toBeUndefined();
    expect(koepfe()).toEqual([]);
  });

  it('begonnen: das Protokoll bleibt als Entwurf ohne Termin und Treffen', async () => {
    const entwurf = { ...sitzung().kopf!, status: 'entwurf' as const, stand: 'abc' };
    werteVon(ct, KAT)[0].value = JSON.stringify(entwurf);
    await absagen({ kopf: entwurf });
    expect(koepfe()).toEqual([{ ...entwurf, termin: null, treffen: null }]);
  });

  it('Serie: abgewiesen, nichts gelöscht (ein `DELETE` träfe die ganze Serie)', async () => {
    termin()!.repeatId = 7;
    await expect(absagen()).rejects.toThrow(SERIE);
    expect(termin()).toBeDefined();
    expect(ct.mails).toEqual([]);
  });

  it('Termin schon weg (zweiter Versuch): weiter mit Treffen und Kopf, keine Mail', async () => {
    ct.termine.length = 0;
    expect((await absagen()).hinweise).toEqual([]);
    expect(ct.mails).toEqual([]);
    expect(koepfe()).toEqual([]);
  });

  it('unklare Antwort, nicht gelöscht: „nicht übernommen“; Treffen und Kopf bleiben', async () => {
    ct.terminAendernFehler = { status: 504, angelegt: false };
    await expect(absagen()).rejects.toThrow('die Absage nicht übernommen');
    expect(treffen()).toBeDefined();
    expect(koepfe()).toHaveLength(1);
  });

  it('unklare Antwort, aber gelöscht: weiter wie sonst', async () => {
    ct.terminAendernFehler = { status: 504, angelegt: true };
    expect((await absagen()).hinweise).toEqual([]);
    expect(koepfe()).toEqual([]);
  });
});
