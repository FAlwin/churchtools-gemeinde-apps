import { describe, expect, it } from 'vitest';
import { utcAus } from '../ct/zeit';
import type { Block } from './dokument';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from './speicher';
import type { Sitzung } from './sitzungen';
import {
  aehnlicherTermin,
  beginnTagWechseln,
  eintragFehler,
  eintragVorbelegung,
  eintragZeitraum,
  plusStunde,
  termineSammeln,
  terminLink,
  terminZeitText,
  titelUndUhrzeit,
  type TerminQuelle,
} from './termine';
import { terminStandId } from './terminStand';

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const punkt = (id: string, titel: string): Block => ({
  id,
  type: 'heading',
  props: { level: 1 },
  content: t(titel),
  children: [],
});
const termin = (
  id: string,
  datum: string | undefined,
  text: string,
  children: Block[] = [],
): Block => ({
  id,
  type: 'termin',
  ...(datum !== undefined ? { props: { datum } } : {}),
  content: t(text),
  children,
});
const absatz = (id: string, text: string): Block => ({
  id,
  type: 'paragraph',
  content: t(text),
  children: [],
});

/** Ein Protokoll im echten Speicherformat (Kopf + Teile aus `teileBauen`) – wie `ladeUebersicht` es liefert. */
function protokoll(
  sitzung: string,
  titel: string,
  beginn: string,
  status: ProtokollKopf['status'],
  dokument: Block[],
): { s: Sitzung; teile: ProtokollTeil[] } {
  const { stand, werte } = teileBauen(dokument, sitzung);
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung,
    titel,
    status,
    beginn,
    termin: null,
    treffen: null,
    freigabe: status === 'frei' ? { von: 1, am: beginn } : null,
    sperre: null,
    stand,
  };
  return {
    s: {
      schluessel: `p:${sitzung}`,
      beginn,
      titel,
      termin: null,
      treffen: null,
      kopf,
      anfragen: [],
    },
    teile: werte.map((w) => JSON.parse(w) as ProtokollTeil),
  };
}

describe('titelUndUhrzeit', () => {
  it.each([
    ['Heiligabend, 16 Uhr', 'Heiligabend', '16:00'],
    ['Gründonnerstag mit Abendmahl, 19 Uhr', 'Gründonnerstag mit Abendmahl', '19:00'],
    ['Heiligabend 2026, 15 Uhr', 'Heiligabend 2026', '15:00'],
    ['Konzert 19:30 Uhr', 'Konzert', '19:30'],
    ['Gottesdienst um 10.30 Uhr im Saal', 'Gottesdienst im Saal', '10:30'],
    ['16 Uhr Konzert', 'Konzert', '16:00'],
    ['Gemeinsames Frühstück ab 9 Uhr', 'Gemeinsames Frühstück', '09:00'],
    ['Treffen – 8:05 Uhr', 'Treffen', '08:05'],
    ['Bibelabend 20 uhr', 'Bibelabend', '20:00'],
  ])('%s → „%s“ um %s', (text, titel, uhrzeit) => {
    expect(titelUndUhrzeit(text)).toEqual({ titel, uhrzeit });
  });

  it.each([
    'Gemeinde-Eislaufen',
    'Bibel-Action-Tag',
    'Ostern 2027',
    // Eine unmögliche Uhrzeit ist keine – der Text bleibt, der Termin ist ganztägig.
    'Treffen 25 Uhr',
    'Treffen 12:75 Uhr',
    // „Uhr“ muss ein eigenes Wort sein.
    'Uhrzeit klären',
    'Treffen 16 Uhrzeit',
  ])('%s → ohne Uhrzeit, Text bleibt', (text) => {
    expect(titelUndUhrzeit(text)).toEqual({ titel: text, uhrzeit: null });
  });

  it('besteht der Text nur aus der Uhrzeit, bleibt er als Titel stehen', () => {
    expect(titelUndUhrzeit('16 Uhr')).toEqual({ titel: '16 Uhr', uhrzeit: '16:00' });
  });
});

describe('Vorbelegung, Prüfung und Zeitraum des Fensters', () => {
  it('mit Uhrzeit im Text: Von = Uhrzeit, Bis = eine Stunde später, nicht ganztägig', () => {
    expect(eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: '2027-12-24' }, 4)).toEqual({
      kalender: 4,
      titel: 'Heiligabend',
      untertitel: '',
      intern: false,
      tag: '2027-12-24',
      ganztaegig: false,
      von: '16:00',
      endTag: '2027-12-24',
      bis: '17:00',
      art: 0,
      frequenz: 1,
      option: 4,
      wiederBis: '',
      weitere: [],
      ausnahmen: [],
      beschreibung: '',
      link: '',
      imAuftrag: null,
      ort: '',
      ortStrasse: '',
      ortPlz: '',
      ortStadt: '',
      ortZusatz: '',
      tags: [],
      informieren: true,
      vorlauf: 15,
      nachlauf: 15,
      buchungen: [],
      events: {},
    });
  });

  it('ohne Uhrzeit: ganztägig, Titel wie im Text', () => {
    const e = eintragVorbelegung({ text: 'Bibel-Action-Tag', datum: '2027-04-24' }, null);
    expect(e).toMatchObject({ kalender: null, titel: 'Bibel-Action-Tag', ganztaegig: true });
  });

  it('plusStunde: nach 23 Uhr bleibt der Tag (23:59)', () => {
    expect(plusStunde('09:30')).toBe('10:30');
    expect(plusStunde('23:15')).toBe('23:59');
  });

  it('eintragFehler: sagt, was fehlt – und nichts, wenn alles da ist', () => {
    const gut = eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: '2027-12-24' }, 4);
    expect(eintragFehler(gut)).toBeNull();
    expect(eintragFehler({ ...gut, kalender: null })).toMatch(/Kalender/);
    expect(eintragFehler({ ...gut, titel: '  ' })).toMatch(/Titel/);
    expect(eintragFehler({ ...gut, tag: '' })).toMatch(/Datum/);
    expect(eintragFehler({ ...gut, von: '' })).toMatch(/Beginn/);
    expect(eintragFehler({ ...gut, von: '17:00', bis: '17:00' })).toMatch(/Ende/);
    // Ganztägig: Zeiten zählen nicht.
    expect(eintragFehler({ ...gut, ganztaegig: true, von: '', bis: '' })).toBeNull();
  });

  it('eintragFehler mehrtägig: das Ende darf am Folgetag früher in der Uhr liegen, aber nicht vor dem Beginn', () => {
    const gut = eintragVorbelegung({ text: 'Freizeit, 18 Uhr', datum: '2027-07-02' }, 4);
    expect(eintragFehler({ ...gut, endTag: '2027-07-04', bis: '10:00' })).toBeNull();
    expect(eintragFehler({ ...gut, endTag: '2027-07-01' })).toMatch(/vor dem Beginn/);
    expect(eintragFehler({ ...gut, endTag: '' })).toBeNull(); // leer = derselbe Tag
    expect(eintragFehler({ ...gut, endTag: 'morgen' })).toMatch(/Enddatum/);
    expect(eintragFehler({ ...gut, ganztaegig: true, endTag: '2027-07-01' })).toMatch(
      /vor dem Beginn/,
    );
  });

  it('eintragFehler bei einer Wiederholung: „Bis“ ist Pflicht (nur bei automatischen Arten), nicht vor dem Beginn', () => {
    const gut = eintragVorbelegung({ text: 'Treffen, 19 Uhr', datum: '2027-03-17' }, 4);
    expect(eintragFehler({ ...gut, art: 7, wiederBis: '' })).toMatch(/Bis/);
    expect(eintragFehler({ ...gut, art: 7, wiederBis: '2027-03-16' })).toMatch(/Bis/);
    expect(eintragFehler({ ...gut, art: 7, wiederBis: '2027-03-17' })).toBeNull();
    expect(eintragFehler({ ...gut, art: 7, wiederBis: '2027-05-01', frequenz: 0 })).toMatch(/Alle/);
    // Manuell und keine Wiederholung brauchen kein „Bis“.
    expect(eintragFehler({ ...gut, art: 999, wiederBis: '' })).toBeNull();
    expect(eintragFehler({ ...gut, art: 0, wiederBis: '' })).toBeNull();
  });

  it('beginnTagWechseln: das Ende zieht mit, ein späteres Ende bleibt; bei „nach Wochentag“ rechnet das Ordinal neu', () => {
    const e = eintragVorbelegung({ text: 'Treffen, 19 Uhr', datum: '2027-03-17' }, 4);
    expect(beginnTagWechseln(e, '2027-03-20')).toMatchObject({
      tag: '2027-03-20',
      endTag: '2027-03-20',
    });
    const lang = { ...e, endTag: '2027-03-25' };
    expect(beginnTagWechseln(lang, '2027-03-20')).toMatchObject({ endTag: '2027-03-25' });
    expect(beginnTagWechseln(lang, '2027-03-30')).toMatchObject({ endTag: '2027-03-30' });
    expect(beginnTagWechseln({ ...e, art: 32, option: 3 }, '2027-03-30').option).toBe(5);
    expect(beginnTagWechseln({ ...e, art: 7, option: 3 }, '2027-03-30').option).toBe(3);
    // Ein angefangenes Datum (leer) bringt nichts durcheinander.
    expect(beginnTagWechseln({ ...e, art: 32 }, '').option).toBe(e.option);
  });

  it('Zeitraum ganztägig: nur der Tag, Ende = derselbe Tag (einschließlich)', () => {
    expect(
      eintragZeitraum(
        { tag: '2027-04-24', ganztaegig: true, von: '16:00', bis: '17:00' },
        'Europe/Berlin',
      ),
    ).toEqual({ beginn: '2027-04-24', ende: '2027-04-24' });
  });

  it('Zeitraum mehrtägig: ganztägig bis zum letzten Tag, mit Uhrzeit Ende am Endtag', () => {
    expect(
      eintragZeitraum(
        { tag: '2027-07-02', endTag: '2027-07-04', ganztaegig: true, von: '', bis: '' },
        'Europe/Berlin',
      ),
    ).toEqual({ beginn: '2027-07-02', ende: '2027-07-04' });
    expect(
      eintragZeitraum(
        { tag: '2027-07-02', endTag: '2027-07-04', ganztaegig: false, von: '18:00', bis: '10:00' },
        'Europe/Berlin',
      ),
    ).toEqual({ beginn: '2027-07-02T16:00:00Z', ende: '2027-07-04T08:00:00Z' });
  });

  it('Zeitraum mit Uhrzeit: UTC aus der Ortszeit der Gemeinde, im Winter und im Sommer', () => {
    const z = (tag: string) =>
      eintragZeitraum({ tag, ganztaegig: false, von: '16:00', bis: '17:30' }, 'Europe/Berlin');
    expect(z('2027-12-24')).toEqual({
      beginn: '2027-12-24T15:00:00Z',
      ende: '2027-12-24T16:30:00Z',
    });
    expect(z('2027-07-04')).toEqual({
      beginn: '2027-07-04T14:00:00Z',
      ende: '2027-07-04T15:30:00Z',
    });
    // Dieselbe Umrechnung wie überall (`utcAus`), nicht nachgebaut.
    expect(z('2027-07-04').beginn).toBe(utcAus('2027-07-04T16:00', 'Europe/Berlin'));
  });

  it('terminZeitText: ganztägig oder Uhrzeit in Ortszeit', () => {
    expect(terminZeitText('2027-04-24', 'Europe/Berlin')).toBe('ganztägig');
    expect(terminZeitText('2027-12-24T15:00:00Z', 'Europe/Berlin')).toBe('16:00 Uhr');
  });

  it('terminLink: der Kalender der Instanz, ein Schrägstrich am Ende stört nicht', () => {
    expect(terminLink('https://ct.test/')).toBe('https://ct.test/?q=churchcal');
    expect(terminLink('https://ct.test')).toBe('https://ct.test/?q=churchcal');
  });
});

describe('aehnlicherTermin', () => {
  const tag = [
    { id: 1, titel: 'Heiligabend – Familiengottesdienst', beginn: '2027-12-24T09:00:00Z' },
    { id: 2, titel: 'Jugendabend', beginn: '2027-12-24T17:00:00Z' },
  ];

  it('ein Wort des kürzeren Titels genügt, wenn es im längeren steht (Kalender und Tag stimmen ja schon)', () => {
    expect(aehnlicherTermin('Heiligabend', tag)?.id).toBe(1);
  });

  it('Titel nach der Regel aus W12 (zwei gemeinsame Wörter) sind es auch', () => {
    expect(aehnlicherTermin('Familiengottesdienst an Heiligabend', tag)?.id).toBe(1);
  });

  it('ein anderer Termin am selben Tag ist keiner', () => {
    expect(aehnlicherTermin('Eislaufen', tag)).toBeNull();
    expect(aehnlicherTermin('Bibelabend', tag)).toBeNull();
    expect(aehnlicherTermin('Heiligabend', [])).toBeNull();
  });

  it('ein Titel nur aus Füllwörtern ist nie ähnlich', () => {
    expect(aehnlicherTermin('und der', [{ id: 3, titel: 'und der', beginn: '' }])).toBeNull();
  });
});

describe('termineSammeln', () => {
  const FEST = protokoll('fest', 'Festplanung 2027', '2026-11-21T18:00:00Z', 'entwurf', [
    absatz('vorweg', 'Begrüßung'),
    termin('vor', '2026-12-09', 'Termin vor dem ersten Punkt'),
    punkt('p1', 'Feste 2027'),
    termin('t1', '2027-03-25', 'Gründonnerstag, 19 Uhr'),
    termin('t2', '2027-01-06', 'Eislaufen'),
    // Leer, ohne Datum oder mit unmöglichem Datum: kein Eintrag.
    termin('leer', '2027-01-07', '  '),
    termin('ohne', undefined, 'Ohne Datum'),
    termin('schief', '2027-02-30', 'Schiefes Datum'),
    punkt('p2', 'Unterpunkt-Test'),
    termin('t3', '2027-03-25', 'Ostervorbereitung', [termin('t3k', '2027-03-26', 'Kind-Termin')]),
  ]);
  const OKT = protokoll('okt', 'Leitungssitzung', '2026-10-14T17:00:00Z', 'frei', [
    punkt('q1', 'Freizeit'),
    termin('u1', '2027-01-06', 'Anmeldung öffnet'),
  ]);
  const PLAN = protokoll('plan', 'Geplant', '2026-12-01T18:00:00Z', 'geplant', [
    termin('x1', '2027-05-01', 'Gehört einem geplanten Protokoll'),
  ]);
  const JUGEND = protokoll('jug', 'Teamtreffen', '2026-10-02T16:00:00Z', 'frei', [
    punkt('j1', 'Räume'),
    termin('j2', '2027-02-02', 'Jugendfreizeit'),
  ]);

  const quelle = (
    id: number,
    name: string,
    kommend: { s: Sitzung; teile: ProtokollTeil[] }[],
    protokolle: { s: Sitzung; teile: ProtokollTeil[] }[],
  ): TerminQuelle => ({
    gruppe: { id, name },
    sitzungen: {
      kommend: kommend.map((x) => x.s),
      protokolle: protokolle.map((x) => x.s),
      teile: [...kommend, ...protokolle].flatMap((x) => x.teile),
    },
  });
  const LEITUNG = quelle(11, 'Leitungsteam', [FEST, PLAN], [OKT]);

  it('sammelt aus Entwurf UND freigegebenen Protokollen – nach Datum, ohne Leeres, Datumsloses und Schiefes', () => {
    const z = termineSammeln([LEITUNG]);
    expect(z.map((x) => [x.datum, x.text])).toEqual([
      ['2026-12-09', 'Termin vor dem ersten Punkt'],
      // 2027-01-06: die neuere Sitzung (Entwurf vom 21.11.) zuerst, dann das ältere Protokoll.
      ['2027-01-06', 'Eislaufen'],
      ['2027-01-06', 'Anmeldung öffnet'],
      ['2027-03-25', 'Gründonnerstag, 19 Uhr'],
      ['2027-03-25', 'Ostervorbereitung'],
      ['2027-03-26', 'Kind-Termin'],
    ]);
  });

  it('ein geplantes Protokoll hat kein Dokument – nichts daraus', () => {
    expect(termineSammeln([LEITUNG]).map((x) => x.sitzung.id)).not.toContain('plan');
  });

  it('Schlüssel = Stand-Schlüssel aus Protokoll und Block; Punkt und Sitzung stimmen', () => {
    const z = termineSammeln([LEITUNG]);
    const g = z.find((x) => x.blockId === 't1')!;
    expect(g.schluessel).toBe(terminStandId('fest', 't1'));
    expect(g.gruppe).toEqual({ id: 11, name: 'Leitungsteam' });
    expect(g.sitzung).toEqual({
      id: 'fest',
      schluessel: 'p:fest',
      titel: 'Festplanung 2027',
      beginn: '2026-11-21T18:00:00Z',
    });
    expect(g.punkt).toMatchObject({ blockId: 'p1', nummer: '1', titel: 'Feste 2027' });
    // Vor dem ersten Punkt: keiner.
    expect(z.find((x) => x.blockId === 'vor')!.punkt).toBeNull();
    // Ein Termin unter einem Termin gehört zum Punkt davor.
    expect(z.find((x) => x.blockId === 't3k')!.punkt?.blockId).toBe('p2');
    expect(new Set(z.map((x) => x.schluessel)).size).toBe(z.length);
  });

  it('mehrere Gruppen: alle zusammen, je mit ihrer Gruppe; dieselbe Sitzung in Kommend und Protokolle zählt einmal', () => {
    const doppelt = quelle(11, 'Leitungsteam', [OKT], [OKT]);
    expect(termineSammeln([doppelt])).toHaveLength(1);
    const z = termineSammeln([LEITUNG, quelle(7, 'Jugendleitung', [], [JUGEND])]);
    expect(z.find((x) => x.text === 'Jugendfreizeit')!.gruppe).toEqual({
      id: 7,
      name: 'Jugendleitung',
    });
    expect(z).toHaveLength(7);
  });

  it('ein Entwurf, dessen Teile fehlen, wird übergangen (kommt beim nächsten Lesen) – die anderen bleiben', () => {
    const q = quelle(11, 'Leitungsteam', [FEST], [OKT]);
    q.sitzungen = { ...q.sitzungen, teile: OKT.teile };
    expect(termineSammeln([q]).map((x) => x.sitzung.id)).toEqual(['okt']);
  });

  it('ohne Sitzungen und ohne Gruppen: leer', () => {
    expect(termineSammeln([])).toEqual([]);
    expect(termineSammeln([quelle(11, 'L', [], [])])).toEqual([]);
  });
});
