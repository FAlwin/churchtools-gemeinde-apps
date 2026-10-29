import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { istKopf, type ProtokollKopf } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { geplanterKopf } from '@shared/protokolle/planen';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { SCHON_GETEILT, sitzungAbsagen, sitzungAendern } from './bearbeiten';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** „Sitzung bearbeiten“ (K2b-1, Serien K2b-2) gegen die nachgestellte ChurchTools-Instanz – verhält sich wie am 29.10.2026 gemessen. */
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
    zeitzone: 'Europe/Berlin',
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
  sitzungAbsagen({
    modul: MODUL,
    kategorie: KAT,
    gruppe: 194,
    sitzung: sitzung(teil),
    zeitzone: 'Europe/Berlin',
  });

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

  it('Serie ohne Wahl: abgewiesen, nichts gelöscht (ein `DELETE` träfe die ganze Serie)', async () => {
    termin()!.repeatId = 7;
    await expect(absagen()).rejects.toThrow('Terminserie bitte wählen');
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

// ── Serien (K2b-2) ────────────────────────────────────────────────────────────────────────────────────────────────
// Serie 90: wöchentlich Mi 07.07.–25.08.2027 19:30 (Berlin), Alwin + Spike zugesagt. Köpfe: s0 07.07. freigegeben
// (Treffen 83), s2 14.07. geplant (Treffen 81) – die Sitzung im Fenster –, s3 28.07. Entwurf (Treffen 82).
describe('Serien', () => {
  const W = (tag: string, zeit = '17:30') => `2027-${tag}T${zeit}:00Z`;
  const kopfVon = (
    sitzung: string,
    beginn: string,
    treffen: number,
    status: ProtokollKopf['status'],
  ) => ({
    ...geplanterKopf(
      { titel: 'Leitungssitzung', beginn, termin: { kalender: 4, id: 90 }, treffen },
      sitzung,
    ),
    status,
    ...(status === 'frei' ? { freigabe: { von: 1, am: W('07-08') } } : {}),
  });
  const S0 = kopfVon('s0', W('07-07'), 83, 'frei');
  const S2 = kopfVon('s2', W('07-14'), 81, 'geplant');
  const S3 = kopfVon('s3', W('07-28'), 82, 'entwurf');
  const serie = () => ct.termine.find((t) => t.id === 90)!;
  const neuer = () => ct.termine.find((t) => t.id !== 90 && t.id !== 70);
  const kopf = (id: string) => koepfe().find((k) => k.sitzung === id);
  const tr = (id: number) => ct.treffen.get(194)?.find((t) => t.id === id);
  const s2 = (teil: Partial<Sitzung> = {}): Sitzung => ({
    schluessel: 'p:s2',
    beginn: W('07-14'),
    ende: W('07-14', '19:30'),
    titel: 'Leitungssitzung',
    termin: { kalender: 4, id: 90 },
    treffen: 81,
    kopf: S2,
    anfragen: [
      { person: 1, antwort: 'zugesagt' },
      { person: 19, antwort: 'zugesagt' },
    ],
    ...teil,
  });

  beforeEach(() => {
    ct.termine.push({
      kalender: 4,
      id: 90,
      titel: 'Leitungssitzung',
      beginn: W('07-07'),
      ende: W('07-07', '19:30'),
      repeatId: 7,
      felder: { repeatFrequency: 1, repeatUntil: '2027-08-25', description: 'Unterlagen' },
      anfragen: [
        { person: 1, state: 'accepted', id: 601 },
        { person: 19, state: 'accepted', id: 602 },
      ],
    });
    ct.treffen
      .get(194)!
      .push(
        { id: 81, startDate: W('07-14'), isCanceled: false, isCompleted: false, comment: 'R1' },
        { id: 82, startDate: W('07-28'), isCanceled: false, isCompleted: false, comment: null },
        { id: 83, startDate: W('07-07'), isCanceled: false, isCompleted: true, comment: null },
      );
    werteVon(ct, KAT).push(
      { id: 6, value: JSON.stringify(S0) },
      { id: 7, value: JSON.stringify(S2) },
      { id: 8, value: JSON.stringify(S3) },
    );
  });

  const VERSCHOBEN = { beginn: W('07-14', '18:00'), ende: W('07-14', '20:00') };

  it('„nur diese“ verschieben: Einzeltermin herausgelöst, alle neu eingeladen; Serie, s3 und Zusagen der Serie bleiben', async () => {
    const r = await aendern({ sitzung: s2(), neu: { titel: 'Leitungssitzung', ...VERSCHOBEN } });
    expect(r.hinweise).toEqual([]);
    expect(serie().felder?.exceptions).toEqual([{ date: '2027-07-14' }]);
    expect(serie().anfragen.map((a) => a.state)).toEqual(['accepted', 'accepted']);
    expect(neuer()).toMatchObject({
      repeatId: 0,
      beginn: VERSCHOBEN.beginn,
      ende: VERSCHOBEN.ende,
    });
    expect(neuer()?.felder?.description).toBe('Unterlagen');
    expect(neuer()?.anfragen.map((a) => [a.person, a.state])).toEqual([
      [1, 'accepted'],
      [19, 'pending'],
    ]);
    // Geteilt wird ohne Liste – sonst mailte ChurchTools „Wöchentlicher Termin … geändert“.
    expect(ct.mails).toEqual([{ person: 19, art: 'neu' }]);
    expect(tr(81)?.startDate).toBe(VERSCHOBEN.beginn);
    expect(tr(81)?.comment).toBe('R1');
    expect(kopf('s2')).toMatchObject({
      beginn: VERSCHOBEN.beginn,
      termin: { kalender: 4, id: neuer()!.id },
    });
    expect(kopf('s3')).toEqual(S3);
    expect(tr(82)?.startDate).toBe(W('07-28'));
  });

  it('„nur diese“ + ein-/ausladen: an der Serie (gilt für alle Termine), der neue Termin bekommt die neue Liste', async () => {
    await aendern({
      sitzung: s2(),
      neu: { titel: 'Leitungssitzung', ...VERSCHOBEN },
      nachher: [1, 7],
    });
    expect(
      serie()
        .anfragen.map((a) => a.person)
        .sort(),
    ).toEqual([1, 7]);
    expect(
      neuer()
        ?.anfragen.map((a) => a.person)
        .sort(),
    ).toEqual([1, 7]);
    expect(ct.mails).toEqual([
      { person: 19, art: 'geloescht' },
      { person: 7, art: 'neu' },
      { person: 7, art: 'neu' },
    ]);
  });

  it('„ab dieser“ verschieben: Serie endet am Vortag, neue Serie ab hier; spätere Köpfe und Treffen ziehen mit', async () => {
    const r = await aendern({
      sitzung: s2(),
      neu: { titel: 'Klausur', ...VERSCHOBEN },
      umfang: 'ab',
    });
    expect(r.hinweise).toEqual([]);
    expect(serie().felder?.repeatUntil).toBe('2027-07-13');
    expect(neuer()).toMatchObject({ repeatId: 7, beginn: VERSCHOBEN.beginn, titel: 'Klausur' });
    expect(neuer()?.felder?.repeatUntil).toBe('2027-08-25');
    expect(ct.mails).toEqual([{ person: 19, art: 'neu' }]);
    const id = neuer()!.id;
    expect(kopf('s2')).toMatchObject({
      titel: 'Klausur',
      beginn: VERSCHOBEN.beginn,
      termin: { id },
    });
    expect(kopf('s3')).toMatchObject({
      titel: 'Klausur',
      beginn: W('07-28', '18:00'),
      termin: { id },
      status: 'entwurf',
    });
    expect(tr(82)?.startDate).toBe(W('07-28', '18:00'));
    // Was davor liegt, bleibt.
    expect(kopf('s0')).toEqual(S0);
    expect(tr(83)?.startDate).toBe(W('07-07'));
  });

  it('„ab dieser“ ohne Kopf: Treffen späterer Termine kommen aus der Liste', async () => {
    werteVon(ct, KAT).splice(1); // nur Kopf s1 von Termin 70 bleibt
    ct.treffen
      .get(194)!
      .push({ id: 84, startDate: W('08-04'), isCanceled: false, isCompleted: false });
    const spaeter: Sitzung = {
      ...s2({ kopf: null }),
      schluessel: 't:4:90:x',
      beginn: W('08-04'),
      treffen: 84,
    };
    await aendern({
      sitzung: s2({ kopf: null }),
      neu: { titel: 'Leitungssitzung', ...VERSCHOBEN },
      umfang: 'ab',
      sitzungen: [spaeter],
    });
    expect(tr(84)?.startDate).toBe(W('08-04', '18:00'));
    expect(tr(81)?.startDate).toBe(VERSCHOBEN.beginn);
  });

  it('„ab dieser“ am ersten Termin: die ganze Serie wird geändert (Teilen ginge nicht), mit „neu einladen“', async () => {
    const erste = s2({ beginn: W('07-07'), ende: W('07-07', '19:30'), kopf: null, treffen: null });
    await aendern({
      sitzung: erste,
      neu: { titel: 'Leitungssitzung', beginn: W('07-07', '18:00'), ende: W('07-07', '20:00') },
      umfang: 'ab',
      neuEinladen: true,
    });
    expect(ct.termine).toHaveLength(2);
    expect(serie()).toMatchObject({ beginn: W('07-07', '18:00'), repeatId: 7 });
    expect(ct.mails).toEqual([{ person: 19, art: 'geaendert' }]);
    expect(kopf('s3')?.beginn).toBe(W('07-28', '18:00'));
    expect(kopf('s3')?.termin?.id).toBe(90);
  });

  it('nur Eingeladene: gilt für die ganze Serie – nichts geteilt', async () => {
    await aendern({
      sitzung: s2(),
      neu: { titel: 'Leitungssitzung', beginn: W('07-14'), ende: W('07-14', '19:30') },
      nachher: [1],
    });
    expect(ct.termine).toHaveLength(2);
    expect(serie().anfragen.map((a) => a.person)).toEqual([1]);
    expect(ct.mails).toEqual([{ person: 19, art: 'geloescht' }]);
  });

  it('schon geteilt (zweiter Versuch mit alter Liste): abgewiesen, nichts angelegt', async () => {
    serie().felder!.exceptions = [{ date: '2027-07-14' }];
    const e: unknown = await aendern({
      sitzung: s2(),
      neu: { titel: 'Leitungssitzung', ...VERSCHOBEN },
    }).catch((x: unknown) => x);
    expect(fehlerMeldung(e).text).toBe(SCHON_GETEILT);
    expect(ct.termine).toHaveLength(2);
    expect(ct.mails).toEqual([]);
  });

  it('unklare Antwort beim Teilen, aber angelegt: im Kalender gefunden – weiter wie sonst', async () => {
    ct.teilenFehler = { status: 504, angelegt: true };
    const r = await aendern({ sitzung: s2(), neu: { titel: 'Leitungssitzung', ...VERSCHOBEN } });
    expect(r.hinweise).toEqual([]);
    expect(kopf('s2')?.termin?.id).toBe(neuer()!.id);
    expect(ct.mails).toEqual([{ person: 19, art: 'neu' }]);
  });

  it('unklare Antwort beim Teilen, nichts angelegt: „unklar – im Kalender nachsehen“, kein Einladen', async () => {
    ct.teilenFehler = { status: 504, angelegt: false };
    const e: unknown = await aendern({
      sitzung: s2(),
      neu: { titel: 'Leitungssitzung', ...VERSCHOBEN },
    }).catch((x: unknown) => x);
    expect(fehlerMeldung(e).text).toContain('im Kalender in ChurchTools nachsehen');
    expect(ct.mails).toEqual([]);
    expect(kopf('s2')).toEqual(S2);
  });

  const absagenSerie = (art: 'diese' | 'ab' | 'serie', teil: Partial<Sitzung> = {}) =>
    sitzungAbsagen({
      modul: MODUL,
      kategorie: KAT,
      gruppe: 194,
      sitzung: s2(teil),
      zeitzone: 'Europe/Berlin',
      art,
      jetzt: new Date(W('07-10')),
    });

  it('absagen „nur diese“: Ausnahme, keine Mail; nur diese Sitzung und ihr Treffen gehen', async () => {
    expect((await absagenSerie('diese')).hinweise).toEqual([]);
    expect(serie().felder?.exceptions).toEqual([{ date: '2027-07-14' }]);
    expect(ct.mails).toEqual([]);
    expect(kopf('s2')).toBeUndefined();
    expect(tr(81)).toBeUndefined();
    expect(kopf('s3')).toEqual(S3);
    expect(tr(82)).toBeDefined();
  });

  it('absagen „ab hier“: Serie endet am Vortag, keine Mail; spätere Sitzungen gehen, frühere bleiben', async () => {
    expect((await absagenSerie('ab')).hinweise).toEqual([]);
    expect(serie().felder?.repeatUntil).toBe('2027-07-13');
    expect(ct.mails).toEqual([]);
    expect(kopf('s2')).toBeUndefined();
    expect(kopf('s3')).toEqual({ ...S3, termin: null, treffen: null });
    expect([tr(81), tr(82)]).toEqual([undefined, undefined]);
    expect(kopf('s0')).toEqual(S0);
    expect(tr(83)).toBeDefined();
  });

  it('absagen „ganze Serie“: gelöscht (Mail „Terminserie gelöscht“); kommende Treffen weg, vergangene bleiben', async () => {
    expect((await absagenSerie('serie')).hinweise).toEqual([]);
    expect(ct.termine.some((t) => t.id === 90)).toBe(false);
    expect(ct.mails).toEqual([{ person: 19, art: 'serie-geloescht' }]);
    expect(kopf('s2')).toBeUndefined();
    expect(kopf('s3')).toEqual({ ...S3, termin: null, treffen: null });
    expect(kopf('s0')).toEqual(S0); // freigegeben: nicht angefasst
    expect([tr(81), tr(82)]).toEqual([undefined, undefined]);
    expect(tr(83)).toBeDefined(); // vergangen – trägt die Anwesenheit
  });

  it('absagen „ab hier“ am ersten Termin: abgewiesen (hieße ganze Serie), nichts geändert', async () => {
    await expect(
      absagenSerie('ab', {
        beginn: W('07-07'),
        ende: W('07-07', '19:30'),
        kopf: null,
        treffen: null,
      }),
    ).rejects.toThrow('erste Termin der Serie');
    expect(serie().felder?.repeatUntil).toBe('2027-08-25');
  });

  it('absagen „nur diese“, zweiter Versuch (Tag schon ausgenommen): nichts doppelt, Rest wird nachgeholt', async () => {
    serie().felder!.exceptions = [{ date: '2027-07-14' }];
    expect((await absagenSerie('diese')).hinweise).toEqual([]);
    expect(serie().felder?.exceptions).toEqual([{ date: '2027-07-14' }]);
    expect(kopf('s2')).toBeUndefined();
  });
});
