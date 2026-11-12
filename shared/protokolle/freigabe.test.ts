import { describe, expect, it } from 'vitest';
import { neueAufgabe, alsGeloescht, type Aufgabe } from './aufgaben';
import type { Block } from './dokument';
import {
  festePunkteFesthalten,
  festePunkteLoesen,
  festesProtokollAus,
  festesProtokollWert,
  festhaltenFuerFreigabe,
} from './festePunkte';
import {
  freigabeHinweise,
  freigabeVermerk,
  freigegebenerKopf,
  verlaufAus,
  zurueckgenommenerKopf,
  zurueckText,
} from './freigabe';
import type { ProtokollKopf } from './speicher';

const AM = '2026-11-12T08:00:00Z';
const ALWIN = { person: 1, name: 'Alwin Friesen' };
const JOHANN = { person: 7, name: 'Johann Becker' };
const kopf = (teil: Partial<ProtokollKopf> = {}): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung: 's1',
  titel: 'Leitungssitzung',
  status: 'entwurf',
  beginn: '2026-11-11T18:00:00Z',
  termin: null,
  treffen: 54,
  freigabe: null,
  sperre: { von: 1, name: 'Alwin', seit: AM, fenster: 'f' },
  stand: 'x',
  ...teil,
});
const text = (t: string) => [{ type: 'text', text: t, styles: {} }];
const punkt = (id: string, t: string, level = 1): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: text(t),
  children: [],
});
const aufgabe = (id: string, t: string, todo: string | null, vorab = ''): Block => ({
  id,
  type: 'aufgabe',
  props: { aufgabe: todo ?? '', vorab },
  content: text(t),
  children: [],
});
const verweis = (id: string, art: string, fest = ''): Block => ({
  id,
  type: 'verweis',
  props: { art, fest },
  children: [],
});
const todo = (id: string, teil: Partial<Parameters<typeof neueAufgabe>[0]> = {}): Aufgabe =>
  neueAufgabe({ id, gruppe: 194, sitzung: 's1', text: id, von: 1, am: AM, ...teil });

describe('Kopf: freigeben und zurücknehmen', () => {
  it('freigegeben: frei, Vermerk, ohne Sperre, Verlauf mit Namen', () => {
    const k = freigegebenerKopf(kopf(), ALWIN, AM);
    expect(k).toMatchObject({
      status: 'frei',
      freigabe: { von: 1, am: AM },
      sperre: null,
      treffen: 54,
      stand: 'x',
    });
    expect(verlaufAus(k)).toEqual([{ art: 'freigegeben', von: 1, name: 'Alwin Friesen', am: AM }]);
  });

  it('zurückgenommen: wieder Entwurf, Freigabe weg, Verlauf behält beides', () => {
    const z = zurueckgenommenerKopf(
      freigegebenerKopf(kopf(), ALWIN, AM),
      JOHANN,
      '2026-11-13T09:00:00Z',
    );
    expect(z).toMatchObject({ status: 'entwurf', freigabe: null, sperre: null });
    expect(verlaufAus(z).map((e) => e.art + ':' + e.name)).toEqual([
      'freigegeben:Alwin Friesen',
      'zurueckgenommen:Johann Becker',
    ]);
  });

  it('Verlauf: fehlt bei älteren Köpfen, kaputte Einträge fallen weg', () => {
    expect(verlaufAus(kopf())).toEqual([]);
    expect(
      verlaufAus({
        verlauf: [{ art: 'x' }, { art: 'freigegeben', von: 1, name: 'A', am: AM }],
      }),
    ).toHaveLength(1);
  });
});

describe('Vermerk über dem Protokoll', () => {
  it('freigegeben: am … von …', () => {
    expect(freigabeVermerk(freigegebenerKopf(kopf(), ALWIN, AM))).toEqual({
      freigabe: { am: AM, name: 'Alwin Friesen' },
      zurueck: null,
    });
  });

  it('frei ohne Verlauf (älter): Datum ohne Namen', () => {
    expect(freigabeVermerk(kopf({ status: 'frei', freigabe: { von: 1, am: AM } }))).toEqual({
      freigabe: { am: AM, name: null },
      zurueck: null,
    });
  });

  it('zurückgenommen: wer, wann – und die Freigabe davor', () => {
    const z = zurueckgenommenerKopf(
      freigegebenerKopf(kopf(), ALWIN, AM),
      JOHANN,
      '2026-11-13T09:00:00Z',
    );
    expect(freigabeVermerk(z)).toEqual({
      freigabe: null,
      zurueck: {
        am: '2026-11-13T09:00:00Z',
        name: 'Johann Becker',
        vorher: { art: 'freigegeben', von: 1, name: 'Alwin Friesen', am: AM },
      },
    });
  });

  it('erneut freigegeben: kein Zurück-Vermerk mehr, Name der neuen Freigabe', () => {
    const z = zurueckgenommenerKopf(
      freigegebenerKopf(kopf(), ALWIN, AM),
      JOHANN,
      '2026-11-13T09:00:00Z',
    );
    const wieder = freigegebenerKopf(z, JOHANN, '2026-11-14T09:00:00Z');
    expect(freigabeVermerk(wieder)).toEqual({
      freigabe: { am: '2026-11-14T09:00:00Z', name: 'Johann Becker' },
      zurueck: null,
    });
    expect(freigabeVermerk(kopf())).toEqual({ freigabe: null, zurueck: null });
  });
});

describe('Vermerk – nur nach einem Zurücknehmen', () => {
  it('Entwurf, dessen letzter Eintrag eine Freigabe ist (z. B. von Hand zurückgesetzt): kein Zurück-Vermerk', () => {
    const k = {
      ...kopf(),
      verlauf: [{ art: 'freigegeben' as const, von: 1, name: 'Alwin Friesen', am: AM }],
    };
    expect(freigabeVermerk(k)).toEqual({ freigabe: null, zurueck: null });
  });
});

describe('Hinweise vor dem Freigeben', () => {
  const dok = [
    verweis('anw', 'anwesenheit'),
    punkt('p1', 'Gemeindeessen'),
    { id: 'b1', type: 'beschluss', content: text('Essen um 12:30'), children: [] } as Block,
    aufgabe('a1', 'Deko besorgen', 't1'),
    aufgabe('a2', 'Kinderbetreuung', 't2'),
    aufgabe('a3', 'Beamer', null, JSON.stringify({ wer: [], extern: 'Hausmeister', bis: null })),
    aufgabe('a4', 'Noch nichts gewählt', null),
    punkt('p2', 'Unterpunkt', 2),
    punkt('p3', 'Verschiedenes'),
  ];
  const todos = new Map([
    ['t1', todo('t1', { wer: [7] })],
    ['t2', todo('t2')],
  ]);
  const treffen = {
    abgeschlossen: false,
    begonnen: true,
    personen: [
      { person: 1, name: 'Alwin Friesen', status: 'da' as const },
      { person: 19, name: 'Spike Musiker', status: 'offen' as const },
      { person: 23, name: 'Daniel Schmidt', status: 'offen' as const },
    ],
  };

  it('offene Anwesenheit, To-Dos ohne Zuständigen (auch ungespeicherte), offene Vorschläge – mit Ziel', () => {
    const h = freigabeHinweise({
      dokument: dok,
      aufgaben: todos,
      anwesenheit: treffen,
      offeneVorschlaege: [{ titel: 'Jahresplanung' }],
    });
    expect(h.hinweise).toEqual([
      {
        art: 'anwesenheit',
        text: 'Anwesenheit: 2 noch offen – geprüft?',
        einzeln: ['Spike Musiker', 'Daniel Schmidt'],
        ziel: 'anw',
      },
      {
        art: 'todos',
        text: '2 To-Dos ohne Zuständigen',
        einzeln: ['Kinderbetreuung', 'Noch nichts gewählt'],
        ziel: 'a2',
      },
      {
        art: 'vorschlaege',
        text: '1 Vorschlag noch offen – er rutscht zur nächsten Sitzung',
        einzeln: ['Jahresplanung'],
        ziel: null,
      },
    ]);
    expect(h.zusammenfassung).toBe('1 Beschluss, 4 To-Dos, 0 Termine, 2 Tagesordnungspunkte');
  });

  it('alles in Ordnung: keine Hinweise; abgeschlossenes Treffen und gelöschte To-Dos zählen nicht', () => {
    const fertig = new Map([
      ['t1', todo('t1', { wer: [7] })],
      ['t2', alsGeloescht(todo('t2'), 1, AM)],
    ]);
    const h = freigabeHinweise({
      dokument: dok.filter((b) => b.id !== 'a4'),
      aufgaben: fertig,
      anwesenheit: { ...treffen, abgeschlossen: true },
      offeneVorschlaege: [],
    });
    expect(h.hinweise).toEqual([]);
  });

  it('ohne Treffen keine Anwesenheits-Frage; ohne festen Punkt kein Sprungziel', () => {
    expect(
      freigabeHinweise({
        dokument: [],
        aufgaben: new Map(),
        anwesenheit: null,
        offeneVorschlaege: [],
      }).hinweise,
    ).toEqual([]);
    const h = freigabeHinweise({
      dokument: [punkt('p', 'A')],
      aufgaben: new Map(),
      anwesenheit: treffen,
      offeneVorschlaege: [],
    });
    expect(h.hinweise[0].ziel).toBeNull();
  });
});

describe('Feste Punkte bei Freigabe und Zurücknehmen', () => {
  const offen = {
    offen: [todo('o1', { sitzung: 'alt' })],
    erledigt: [],
    seit: '2026-10-14T17:00:00Z',
  };

  it('die Freigabe markiert ihr „Letztes Protokoll“ – eine bewusste Wahl (K3b-2) bleibt unmarkiert', () => {
    const [frei, gewaehlt] = festePunkteFesthalten(
      [
        verweis('l', 'letztes-protokoll'),
        verweis('w', 'letztes-protokoll', festesProtokollWert('sept')),
      ],
      { offen, letztes: 'okt' },
    );
    expect(frei.props?.fest).toBe(festesProtokollWert('okt', true));
    expect(festesProtokollAus(frei.props?.fest)).toEqual({ sitzung: 'okt' });
    expect(gewaehlt.props?.fest).toBe(festesProtokollWert('sept'));
  });

  it('zurücknehmen: Offene To-Dos und das von der Freigabe gesetzte „Letztes Protokoll“ wieder live, die Wahl bleibt', () => {
    const fest = festePunkteFesthalten(
      [
        verweis('o', 'offene-aufgaben'),
        verweis('l', 'letztes-protokoll'),
        verweis('w', 'letztes-protokoll', festesProtokollWert('sept')),
        { ...punkt('p', 'A'), children: [verweis('k', 'offene-aufgaben')] },
      ],
      { offen, letztes: 'okt' },
    );
    expect(fest.every((b) => b.type !== 'verweis' || b.props?.fest)).toBe(true);
    const live = festePunkteLoesen(fest);
    expect(live.map((b) => b.props?.fest)).toEqual([
      '',
      '',
      festesProtokollWert('sept'),
      undefined,
    ]);
    expect(live[3].children?.[0].props?.fest).toBe('');
  });

  it('festhaltenFuerFreigabe nimmt dieselben Eingaben wie der Punkt live: offene von früher + letztes Protokoll', () => {
    const okt = { beginn: '2026-10-14T17:00:00Z', kopf: { sitzung: 'okt', status: 'frei' } };
    const diese = { beginn: '2026-11-11T18:00:00Z', kopf: { sitzung: 's1', status: 'entwurf' } };
    const [o, l] = festhaltenFuerFreigabe(
      [verweis('o', 'offene-aufgaben'), verweis('l', 'letztes-protokoll')],
      {
        aufgaben: [todo('vorher', { sitzung: 'okt' }), todo('heute', { sitzung: 's1' })],
        gruppe: 194,
        sitzung: diese,
        protokolle: [okt],
        heute: '2026-11-12',
      },
    );
    expect(JSON.parse(String(o.props?.fest))).toEqual({
      offen: ['vorher'],
      erledigt: [],
      seit: okt.beginn,
    });
    expect(festesProtokollAus(l.props?.fest)).toEqual({ sitzung: 'okt' });
  });
});

describe('zurueckText – derselbe Satz auf der Seite und im PDF (S6-3a)', () => {
  const tag = (iso: string) => iso.slice(0, 10);
  it('mit der Freigabe davor', () => {
    expect(
      zurueckText(
        {
          am: '2026-11-13T09:00:00Z',
          name: 'Maria',
          vorher: { art: 'freigegeben', von: 1, name: 'Alwin', am: '2026-11-12T09:00:00Z' },
        },
        tag,
      ),
    ).toBe(
      'Freigabe zurückgenommen am 2026-11-13 von Maria – vorher freigegeben am 2026-11-12 von Alwin.',
    );
  });
  it('ohne Freigabe davor (ältere Köpfe ohne Verlauf)', () => {
    expect(zurueckText({ am: '2026-11-13T09:00:00Z', name: 'Maria', vorher: null }, tag)).toBe(
      'Freigabe zurückgenommen am 2026-11-13 von Maria.',
    );
  });
});
