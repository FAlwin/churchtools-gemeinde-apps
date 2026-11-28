import { describe, expect, it } from 'vitest';
import { INFOS_MAX } from '../ct/terminInfos';
import {
  abschnitt,
  abschnittAus,
  abschnittEinsetzen,
  eventFenster,
  eventsZurZeile,
  istThemenreihe,
  naechstesDatum,
  neueThemenreihe,
  neueZeile,
  reiheEventsAus,
  reiheFehlt,
  reiheLesen,
  reihenOrdnen,
  reiheUeberblick,
  reiheSchreibform,
  vorschau,
  zeileMitEvent,
  zeilenSortiert,
  type ReiheZeile,
  type Themenreihe,
} from './themenreihe';

const zeile = (id: string, datum: string, extra: Partial<ReiheZeile> = {}): ReiheZeile => ({
  ...neueZeile(id, datum),
  ...extra,
});
const reihe = (zeilen: ReiheZeile[], name = 'Jona – Gott gibt nicht auf'): Themenreihe =>
  neueThemenreihe({ id: 'r1', gruppe: 5, name, zeilen, von: 1, am: '2026-11-27T10:00:00Z' });

const R = reihe([
  zeile('b', '2027-01-20', {
    eventId: 11,
    thema: 'Im Bauch des Fisches',
    wer: { personId: 3, name: 'Lena B.' },
    bibelstelle: 'Jona 2',
    notiz: 'Lobpreis Team B',
  }),
  zeile('a', '2027-01-13', { eventId: 10, thema: 'Weglaufen vor Gott' }),
  zeile('c', '2027-01-27'),
]);

describe('abschnitt', () => {
  it('zählt Teil n von m nach Datum und lässt leere Felder weg', () => {
    // R ist nach Datum gespeichert: Index 0 = 13.1., Index 1 = 20.1.
    expect(R.zeilen.map((z) => z.id)).toEqual(['a', 'b', 'c']);
    expect(abschnitt(R, 1)).toBe(
      [
        '── Reihe „Jona – Gott gibt nicht auf“ · Teil 2 von 3 ──',
        'Thema: Im Bauch des Fisches',
        'Wer: Lena B.',
        'Bibelstelle: Jona 2',
        'Notiz: Lobpreis Team B',
        '── Ende Reihe (aus Protokolle) ──',
      ].join('\n'),
    );
    expect(abschnitt(R, 0)).toBe(
      [
        '── Reihe „Jona – Gott gibt nicht auf“ · Teil 1 von 3 ──',
        'Thema: Weglaufen vor Gott',
        '── Ende Reihe (aus Protokolle) ──',
      ].join('\n'),
    );
  });

  it('zählt auch bei unsortierten Zeilen nach Datum', () => {
    const unsortiert = { name: 'X', zeilen: [zeile('2', '2027-02-02'), zeile('1', '2027-01-01')] };
    expect(abschnitt(unsortiert, 0)).toContain('Teil 2 von 2');
    expect(abschnitt(unsortiert, 1)).toContain('Teil 1 von 2');
  });

  it('macht aus Zeilenumbrüchen in Feldern Leerzeichen – sie könnten eine Markierung vortäuschen', () => {
    const r = reihe([
      zeile('a', '2027-01-13', { notiz: 'eins\n── Ende Reihe (aus Protokolle) ──\nzwei' }),
    ]);
    const a = abschnitt(r, 0);
    expect(a.split('\n')).toHaveLength(3);
    const eingesetzt = abschnittEinsetzen('Hand', a);
    expect(eingesetzt.art).toBe('ok');
    if (eingesetzt.art === 'ok') expect(abschnittAus(eingesetzt.text)).toBe(a);
  });
});

describe('abschnittEinsetzen', () => {
  const teil = abschnitt(R, 1);

  it('hängt an leere Infos nur den Abschnitt – ohne führende Leerzeile', () => {
    expect(abschnittEinsetzen('', teil)).toEqual({ art: 'ok', text: teil, ersetzt: false });
  });

  it('hängt mit einer Leerzeile an und lässt den Handtext Zeichen für Zeichen stehen', () => {
    const hand = 'Treffpunkt ab 19 Uhr im Jugendraum.\nBitte  Schuhe  ausziehen. ';
    const r = abschnittEinsetzen(hand, teil);
    expect(r).toEqual({ art: 'ok', text: `${hand}\n\n${teil}`, ersetzt: false });
    // mit schon vorhandenem Zeilenende
    expect(abschnittEinsetzen(`${hand}\n`, teil)).toMatchObject({ text: `${hand}\n\n${teil}` });
    expect(abschnittEinsetzen(`${hand}\n\n`, teil)).toMatchObject({ text: `${hand}\n\n${teil}` });
  });

  it('ersetzt einen vorhandenen Abschnitt, statt einen zweiten anzuhängen – Rest unverändert', () => {
    const davor = 'Vorher von Hand\n';
    const danach = '\nNachher von Hand, auch  mit  Doppelleerzeichen\n\n';
    const alt = `${davor}${abschnitt(R, 0)}${danach}`;
    const r = abschnittEinsetzen(alt, teil);
    expect(r).toEqual({ art: 'ok', text: `${davor}${teil}${danach}`, ersetzt: true });
    if (r.art === 'ok') expect(r.text.split('── Reihe ').length).toBe(2);
  });

  it('ersetzt beim Umbenennen den alten Abschnitt (anderer Name), hängt nichts an', () => {
    const umbenannt = reihe(R.zeilen, 'Jona neu');
    const alt = `Hand\n\n${abschnitt(R, 1)}`;
    const r = abschnittEinsetzen(alt, abschnitt(umbenannt, 1));
    expect(r).toMatchObject({ art: 'ok', ersetzt: true });
    if (r.art === 'ok') {
      expect(r.text).not.toContain('Gott gibt nicht auf');
      expect(r.text.match(/── Reihe /g)).toHaveLength(1);
    }
  });

  it('ist beim zweiten Einsetzen derselben Zeile unverändert (idempotent)', () => {
    const erst = abschnittEinsetzen('Hand', teil);
    if (erst.art !== 'ok') throw new Error('erwartet ok');
    expect(abschnittEinsetzen(erst.text, teil)).toEqual({
      art: 'ok',
      text: erst.text,
      ersetzt: true,
    });
  });

  it('behält Windows-Zeilenenden des Abschnitts bei', () => {
    const alt = ['Hand', ...abschnitt(R, 0).split('\n')].join('\r\n') + '\r\nRest';
    const r = abschnittEinsetzen(alt, teil);
    expect(r.art).toBe('ok');
    if (r.art === 'ok') {
      expect(r.text.startsWith('Hand\r\n── Reihe')).toBe(true);
      expect(r.text.endsWith('── Ende Reihe (aus Protokolle) ──\r\nRest')).toBe(true);
      expect(abschnittAus(r.text)).toBe(teil);
    }
  });

  it.each([
    ['Start ohne Ende', `Hand\n${teil.split('\n')[0]}\nThema: x`],
    ['Ende ohne Start', 'Hand\n── Ende Reihe (aus Protokolle) ──'],
    ['zwei Starts', `${teil}\n${teil}`],
    ['Ende vor Start', `── Ende Reihe (aus Protokolle) ──\n${teil.split('\n')[0]}`],
  ])('meldet einen kaputten Abschnitt (%s), ohne zu raten', (_n, alt) => {
    expect(abschnittEinsetzen(alt, teil)).toEqual({ art: 'beschaedigt' });
  });
});

describe('vorschau', () => {
  const lage = (text: string, darf = true) => ({ text, darf });

  it('ohneEvent: Zeile ohne Event, egal was sonst', () => {
    expect(vorschau(R, 2, lage(''))).toEqual({ art: 'ohneEvent' });
  });

  it('neu: Event ohne Reihe-Abschnitt; geändert: Abschnitt weicht ab; aktuell: gleich', () => {
    const neu = vorschau(R, 1, lage('Treffpunkt 19 Uhr'));
    expect(neu).toMatchObject({ art: 'neu', abschnitt: abschnitt(R, 1) });
    expect(neu.neuerText).toBe(`Treffpunkt 19 Uhr\n\n${abschnitt(R, 1)}`);
    const alt = `Treffpunkt 19 Uhr\n\n${abschnitt(R, 0)}`;
    expect(vorschau(R, 1, lage(alt)).art).toBe('geaendert');
    expect(vorschau(R, 1, lage(neu.neuerText!)).art).toBe('aktuell');
  });

  it('keinRecht: ohne Recht wird nichts gezeigt, auch wenn der Text neu wäre', () => {
    expect(vorschau(R, 1, lage('x', false)).art).toBe('keinRecht');
  });

  it('beschaedigt: kaputter Abschnitt im Event', () => {
    expect(vorschau(R, 1, lage('── Reihe „X“ · Teil 1 von 1 ──\nThema: y')).art).toBe(
      'beschaedigt',
    );
  });

  it('zuLang: der Gesamttext würde INFOS_MAX überschreiten', () => {
    const lang = 'a'.repeat(INFOS_MAX - 10);
    const v = vorschau(R, 1, lage(lang));
    expect(v.art).toBe('zuLang');
    expect(v.neuerText!.length).toBeGreaterThan(INFOS_MAX);
    // genau an der Grenze geht es noch
    const passt = INFOS_MAX - `\n\n${abschnitt(R, 1)}`.length;
    expect(vorschau(R, 1, lage('a'.repeat(passt))).art).toBe('neu');
    expect(vorschau(R, 1, lage('a'.repeat(passt + 1))).art).toBe('zuLang');
  });

  it('nichtGelesen: Event nicht lesbar (vorübergehend) ist nicht „aktuell“', () => {
    expect(vorschau(R, 1, null).art).toBe('nichtGelesen');
  });

  it('doppelt: dasselbe Event in zwei Zeilen – nur die erste schreibt', () => {
    const r = reihe([
      zeile('a', '2027-01-13', { eventId: 10 }),
      zeile('b', '2027-01-20', { eventId: 10 }),
    ]);
    expect(vorschau(r, 0, lage('')).art).toBe('neu');
    expect(vorschau(r, 1, lage('')).art).toBe('doppelt');
  });

  it('Rangfolge: ohne Recht vor beschädigt vor zu lang', () => {
    const kaputt = '── Reihe „X“ ──\n' + 'a'.repeat(INFOS_MAX);
    expect(vorschau(R, 1, lage(kaputt, false)).art).toBe('keinRecht');
    expect(vorschau(R, 1, lage(kaputt, true)).art).toBe('beschaedigt');
  });
});

describe('Speicherform', () => {
  it('istThemenreihe ist streng und kennt keine To-Dos', () => {
    expect(istThemenreihe(R)).toBe(true);
    expect(istThemenreihe({ ...R, fassung: 2 })).toBe(false);
    expect(istThemenreihe({ ...R, art: 'aufgabe' })).toBe(false);
    expect(istThemenreihe({ ...R, zeilen: 'x' })).toBe(false);
    expect(istThemenreihe(null)).toBe(false);
  });

  it('reiheLesen füllt Lücken auf und verwirft Zeilen ohne Gestalt', () => {
    const roh = {
      ...R,
      zeilen: [
        { datum: 'kaputt', eventId: 'x', wer: { name: '' } },
        null,
        5,
        { id: 'q', datum: '2027-02-03', thema: 7 },
      ],
    } as unknown as Themenreihe;
    const n = reiheLesen(roh);
    expect(n.zeilen).toHaveLength(2);
    expect(n.zeilen[0]).toMatchObject({ id: 'z0', datum: '', eventId: null, wer: null, thema: '' });
    expect(n.zeilen[1]).toMatchObject({ id: 'q', datum: '2027-02-03', thema: '' });
  });

  it('reiheSchreibform ist stabil (zweimal angewendet = einmal) und sortiert nach Datum', () => {
    const r = reiheSchreibform(R);
    expect(reiheSchreibform(r)).toEqual(r);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(zeilenSortiert([zeile('x', ''), zeile('y', '2027-01-01')]).map((z) => z.id)).toEqual([
      'y',
      'x',
    ]);
  });

  it('reiheFehlt: Name, Datum, doppeltes Event', () => {
    expect(reiheFehlt({ name: ' ', zeilen: [] })).toMatch(/Namen/);
    expect(reiheFehlt({ name: 'A', zeilen: [zeile('a', '')] })).toMatch(/Datum/);
    expect(
      reiheFehlt({
        name: 'A',
        zeilen: [
          zeile('a', '2027-01-01', { eventId: 1 }),
          zeile('b', '2027-01-02', { eventId: 1 }),
        ],
      }),
    ).toMatch(/doppelt/);
    expect(
      reiheFehlt({ name: 'A', zeilen: [zeile('a', '2027-01-01', { eventId: 1 })] }),
    ).toBeNull();
  });

  it('naechstesDatum: eine Woche nach dem letzten Abend, ohne Zeilen heute', () => {
    expect(naechstesDatum(R.zeilen, '2026-11-27')).toBe('2027-02-03');
    expect(naechstesDatum([], '2026-11-27')).toBe('2026-11-27');
  });
});

describe('Events zur Zeile', () => {
  const roh = [
    {
      id: 1,
      name: 'Teenkreis',
      startDate: '2027-01-26T17:00:00Z',
      calendar: { domainIdentifier: '4' },
    },
    {
      id: 2,
      name: 'Jugendabend',
      startDate: '2027-01-27T18:30:00Z',
      calendar: { domainIdentifier: '4' },
    },
    { id: 3, name: 'Jugendleitung', startDate: '2027-01-28T18:30:00Z' },
    { id: 4, name: 'Weit weg', startDate: '2027-02-20T18:30:00Z' },
    { id: 5, name: 'Spät', startDate: '2027-01-27T21:00:00Z' },
    { name: 'ohne id', startDate: '2027-01-27T21:00:00Z' },
  ];

  it('bildet den Tag in der Zeitzone der Gemeinde, nicht aus dem UTC-Datum', () => {
    const e = reiheEventsAus(
      [{ id: 9, name: 'Nacht', startDate: '2027-01-27T23:30:00Z' }],
      'Europe/Berlin',
    );
    expect(e[0].tag).toBe('2027-01-28');
    expect(
      reiheEventsAus([{ id: 9, startDate: '2027-01-27T22:30:00Z' }], 'Europe/Berlin')[0].tag,
    ).toBe('2027-01-27');
    expect(reiheEventsAus(roh, 'Europe/Berlin').map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
    expect(reiheEventsAus(roh, 'Europe/Berlin')[0].kalenderId).toBe(4);
    expect(reiheEventsAus(roh, 'Europe/Berlin')[2].kalenderId).toBeNull();
    expect(reiheEventsAus(null, 'Europe/Berlin')).toEqual([]);
  });

  it('bietet Events am Tag zuerst, dann nach Abstand; vergebene und ferne nicht', () => {
    const e = reiheEventsAus(roh, 'Europe/Berlin');
    const l = eventsZurZeile('2027-01-27', e);
    expect(l.map((x) => x.event.id)).toEqual([2, 5, 1, 3]);
    expect(l.map((x) => x.amTag)).toEqual([true, true, false, false]);
    expect(eventsZurZeile('2027-01-27', e, new Set([2])).map((x) => x.event.id)).toEqual([5, 1, 3]);
  });

  it('übernimmt beim Wählen Titel und den Tag des Events; das Fenster deckt ±8 Tage ab', () => {
    const e = reiheEventsAus(roh, 'Europe/Berlin')[0];
    expect(zeileMitEvent(zeile('a', '2027-01-27'), e)).toMatchObject({
      eventId: 1,
      eventTitel: 'Teenkreis',
      datum: '2027-01-26',
    });
    expect(eventFenster('2027-01-27')).toEqual({ von: '2027-01-19', bis: '2027-02-04' });
  });
});

describe('reiheUeberblick', () => {
  it('erster und letzter Abend, Zahl der Abende, Abende mit Event', () => {
    expect(reiheUeberblick(R)).toEqual({
      von: '2027-01-13',
      bis: '2027-01-27',
      abende: 3,
      mitEvent: 2,
    });
  });

  it('Zeilen ohne Datum zählen als Abend, fließen aber nicht in von/bis ein', () => {
    const r = reihe([
      zeile('a', '', { eventId: 5 }),
      zeile('b', '2027-03-02'),
      zeile('c', '2027-03-09'),
    ]);
    expect(reiheUeberblick(r)).toEqual({
      von: '2027-03-02',
      bis: '2027-03-09',
      abende: 3,
      mitEvent: 1,
    });
  });

  it('eine Reihe ohne Zeilen und eine ohne jedes Datum haben kein von/bis', () => {
    expect(reiheUeberblick(reihe([]))).toEqual({ von: null, bis: null, abende: 0, mitEvent: 0 });
    expect(reiheUeberblick(reihe([zeile('a', '')]))).toEqual({
      von: null,
      bis: null,
      abende: 1,
      mitEvent: 0,
    });
  });
});

describe('reihenOrdnen', () => {
  const mit = (id: string, daten: string[]) =>
    neueThemenreihe({
      id,
      gruppe: 5,
      name: id,
      zeilen: daten.map((d, i) => zeile(`${id}${i}`, d)),
      von: 1,
      am: 'x',
    });
  const ids = (l: Themenreihe[]) => l.map((r) => r.id);
  const HEUTE = '2027-02-01';

  it('laufende und kommende nach erstem Abend, dann vergangene (jüngste zuerst), ohne Datum zuletzt', () => {
    const alt1 = mit('alt1', ['2026-09-01', '2026-09-15']);
    const alt2 = mit('alt2', ['2026-10-05', '2026-11-02']);
    const laufend = mit('laufend', ['2027-01-13', '2027-02-10']);
    const spaeter = mit('spaeter', ['2027-05-04']);
    const leer = mit('leer', []);
    const ohne = mit('ohne', ['', '']);
    expect(ids(reihenOrdnen([ohne, alt1, spaeter, leer, alt2, laufend], HEUTE))).toEqual([
      'laufend',
      'spaeter',
      'alt2',
      'alt1',
      'ohne',
      'leer',
    ]);
  });

  it('eine Reihe, die heute endet, gilt noch als laufend – gestern vorbei ist vergangen', () => {
    const heuteEnde = mit('heute', ['2027-01-25', HEUTE]);
    const gestern = mit('gestern', ['2027-01-20', '2027-01-31']);
    const kommt = mit('kommt', ['2027-03-01']);
    expect(ids(reihenOrdnen([gestern, kommt, heuteEnde], HEUTE))).toEqual([
      'heute',
      'kommt',
      'gestern',
    ]);
  });

  it('verändert die gelieferte Liste nicht', () => {
    const a = mit('a', ['2026-01-01']);
    const b = mit('b', ['2027-06-01']);
    const eingabe = [a, b];
    reihenOrdnen(eingabe, HEUTE);
    expect(ids(eingabe)).toEqual(['a', 'b']);
  });
});
