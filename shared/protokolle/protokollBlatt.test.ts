import { describe, expect, it } from 'vitest';
import type { Absatz, Rgb } from '../ct/terminBlatt';
import { neueAufgabe, statusSetzen, type Aufgabe } from './aufgaben';
import type { Block } from './dokument';
import { protokollBlatt, zeilenAus, type BlattTeil, type ProtokollQuelle } from './protokollBlatt';
import type { ProtokollKopf } from './speicher';
import type { Sitzung } from './sitzungen';

/** Das Protokoll als Blatt (S6-3a): was aufs PDF kommt – gegen dieselben Regeln wie die Lese-Ansicht. */

const ROT: Rgb = [224, 62, 62];
const GELB: Rgb = [253, 232, 150];
const BLAU: Rgb = [11, 110, 153];
const farbe = (name: unknown): Rgb | null =>
  name === 'red' ? ROT : name === 'yellow' ? GELB : name === 'blue' ? BLAU : null;

const NAMEN: Record<number, string> = { 1: 'Alwin Friesen', 2: 'Maria Dück' };

const kopf = (x: Partial<ProtokollKopf> = {}): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung: 's-nov',
  titel: 'Leitungssitzung',
  status: 'entwurf',
  beginn: '2026-11-11T18:00:00Z',
  termin: null,
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: 'x',
  ...x,
});

const quelle = (dokument: Block[], x: Partial<ProtokollQuelle> = {}): ProtokollQuelle => ({
  gruppe: 'Leitungsteam',
  gruppeId: 11,
  sitzung: 's-nov',
  titel: 'Leitungssitzung',
  beginn: '2026-11-11T18:00:00Z',
  zeitzone: 'Europe/Berlin',
  kopf: kopf(),
  dokument,
  aufgaben: [],
  name: (p) => NAMEN[p] ?? null,
  heute: '2026-11-12',
  protokolle: [],
  letztes: null,
  anwesenheit: null,
  naechste: null,
  gemeinde: 'ECG Donrath',
  stand: 'Stand 12.11.2026, 10:00 Uhr',
  farbe,
  ...x,
});

let n = 0;
const block = (type: string, text: string, x: Partial<Block> = {}): Block => ({
  id: `b${++n}`,
  type,
  content: text ? [{ type: 'text', text }] : [],
  ...x,
});
const punkt = (text: string, level = 1) => block('heading', text, { props: { level } });
const absatz = (text: string) => block('paragraph', text);

const aufgabe = (id: string, x: Partial<Parameters<typeof neueAufgabe>[0]> = {}): Aufgabe =>
  neueAufgabe({
    id,
    gruppe: 11,
    sitzung: 's-nov',
    text: id,
    von: 1,
    am: '2026-11-11T18:00:00Z',
    ...x,
  });

const text = (a: Absatz) => a.map((l) => l.text).join('');
const teile = (q: ProtokollQuelle) => protokollBlatt(q).teile;
const texte = (ts: BlattTeil[]) =>
  ts.map((t) =>
    t.art === 'kasten'
      ? t.zeilen.map((z) => z.absaetze.map(text).join(' / ')).join(' | ')
      : 'absaetze' in t
        ? t.absaetze.map(text).join(' / ')
        : t.art,
  );

describe('Kopf und Vermerk', () => {
  it('Titel, Gruppe mit Tag und Uhrzeit der Gemeinde, „Protokolle“ unten', () => {
    const b = protokollBlatt(quelle([]));
    expect(b).toMatchObject({
      titel: 'Leitungssitzung',
      untertitel: 'Leitungsteam · Mi, 11.11.2026 · 19:00 Uhr',
      gemeinde: 'ECG Donrath',
      app: 'Protokolle',
      stand: 'Stand 12.11.2026, 10:00 Uhr',
      teile: [],
    });
    expect(protokollBlatt(quelle([], { titel: '  ' })).titel).toBe('Sitzung');
  });

  it('Entwurf: rot „noch nicht freigegeben“ – nach einer Zurücknahme mit dem Satz dazu', () => {
    const b = protokollBlatt(quelle([]));
    expect(b.entwurf).toBe(true);
    expect(b.vermerk).toEqual([[{ text: 'Entwurf – noch nicht freigegeben', stil: 'rot' }]]);
    const zurueck = protokollBlatt(
      quelle([], {
        kopf: {
          ...kopf(),
          verlauf: [
            { art: 'freigegeben', von: 1, name: 'Alwin Friesen', am: '2026-11-12T09:00:00Z' },
            { art: 'zurueckgenommen', von: 2, name: 'Maria Dück', am: '2026-11-13T09:00:00Z' },
          ],
        },
      }),
    );
    expect(zurueck.vermerk.map(text)).toEqual([
      'Entwurf – noch nicht freigegeben',
      'Freigabe zurückgenommen am 13.11.2026 von Maria Dück – vorher freigegeben am 12.11.2026 von Alwin Friesen.',
    ]);
  });

  it('freigegeben: „Freigegeben am … von …“ (Tag der Gemeinde)', () => {
    const b = protokollBlatt(
      quelle([], {
        kopf: {
          ...kopf({ status: 'frei', freigabe: { von: 1, am: '2026-11-12T23:30:00Z' } }),
          verlauf: [
            { art: 'freigegeben', von: 1, name: 'Alwin Friesen', am: '2026-11-12T23:30:00Z' },
          ],
        },
      }),
    );
    expect(b.entwurf).toBe(false);
    expect(b.vermerk.map(text)).toEqual(['Freigegeben am 13.11.2026 von Alwin Friesen']);
  });
});

describe('Das Protokoll wie in der Lese-Ansicht', () => {
  it('Nummern aus der einen Ableitung: 1. / 2. / 2.1; „Überschrift“ (Stufe 3) ohne Nummer', () => {
    const ts = teile(
      quelle([punkt('Andacht'), punkt('Essen'), punkt('Küche', 2), punkt('Notiz', 3)]),
    );
    expect(ts.map((t) => (t.art === 'punkt' ? `${t.nummer} ${t.ebene}` : t.art))).toEqual([
      '1. 0',
      '2. 0',
      '2.1 1',
      'ueberschrift',
    ]);
    expect(ts[3]).toMatchObject({ art: 'ueberschrift', klein: true });
  });

  it('Auszeichnung und Farben wie im Editor; Links nur mit sicherer Adresse', () => {
    const b = block('paragraph', '', {
      content: [
        { type: 'text', text: 'fett', styles: { bold: true } },
        { type: 'text', text: 'kursiv', styles: { italic: true, underline: true } },
        { type: 'text', text: 'weg', styles: { strike: true, code: true } },
        { type: 'text', text: 'rot', styles: { textColor: 'red', backgroundColor: 'yellow' } },
        {
          type: 'link',
          href: 'https://ecg-donrath.de',
          content: [{ type: 'text', text: 'Seite' }],
        },
        { type: 'link', href: 'javascript:alert(1)', content: [{ type: 'text', text: 'böse' }] },
      ],
    });
    const [t] = teile(quelle([b]));
    expect(t).toEqual({
      art: 'text',
      einzug: 0,
      absaetze: [
        [
          { text: 'fett', stil: 'fett' },
          { text: 'kursiv', kursiv: true, unterstrichen: true },
          { text: 'weg', durchgestrichen: true, code: true },
          { text: 'rot', farbe: ROT, hintergrund: GELB },
          { text: 'Seite', link: 'https://ecg-donrath.de' },
          { text: 'böse' },
        ],
      ],
    });
  });

  it('leere Absätze fallen weg, Unbekanntes behält seinen Text, Umschalt+Enter beginnt einen Absatz', () => {
    const ts = teile(quelle([absatz(''), block('neuerBlock', 'bleibt'), absatz('eins\nzwei')]));
    expect(texte(ts)).toEqual(['bleibt', 'eins / zwei']);
    expect(zeilenAus([{ text: 'a\n', stil: 'fett' }, { text: 'b' }])).toEqual([
      [{ text: 'a', stil: 'fett' }],
      [{ text: 'b' }],
    ]);
  });

  it('Listen: Nummern zählen wie in der Lese-Ansicht, Kinder stehen eine Stufe eingerückt', () => {
    const ts = teile(
      quelle([
        block('numberedListItem', 'a'),
        block('numberedListItem', 'b', { children: [block('bulletListItem', 'b1')] }),
        absatz('dazwischen'),
        block('numberedListItem', 'c'),
        block('checkListItem', 'd', { props: { checked: true } }),
      ]),
    );
    expect(
      ts.map((t) => (t.art === 'text' ? [text(t.absaetze[0]), t.einzug, t.zeichen] : t.art)),
    ).toEqual([
      ['a', 0, { art: 'nummer', nr: 1 }],
      ['b', 0, { art: 'nummer', nr: 2 }],
      ['b1', 1, { art: 'punkt' }],
      ['dazwischen', 0, undefined],
      ['c', 0, { art: 'nummer', nr: 1 }],
      ['d', 0, { art: 'kasten', an: true }],
    ]);
  });

  it('To-Do mit Wer und Bis, ohne Status – auch ein erledigtes; vor dem Speichern die Wahl im Block', () => {
    const fertig = statusSetzen(
      aufgabe('t1', { wer: [2], extern: 'Hans', bis: '2026-12-06' }),
      'erledigt',
      1,
      '2026-11-12T10:00:00Z',
    );
    const ts = teile(
      quelle(
        [
          block('aufgabe', 'Deko', { props: { aufgabe: 't1' } }),
          block('aufgabe', 'Kinder'),
          block('aufgabe', 'Beamer', {
            props: { vorab: JSON.stringify({ wer: [1], extern: '', bis: null }) },
          }),
          block('aufgabe', ''),
        ],
        { aufgaben: [fertig] },
      ),
    );
    expect(texte(ts)).toEqual([
      'Deko – Maria Dück, Hans (extern), bis 06.12.2026',
      'Kinder – noch niemand',
      'Beamer – Alwin Friesen',
    ]);
    for (const t of ts) expect(t).toMatchObject({ zeichen: { art: 'kasten', an: false } });
    expect(JSON.stringify(ts)).not.toMatch(/erledigt|offen|Arbeit/);
  });

  it('Beschluss, Termin mit Datum, Zitat, Trennlinie', () => {
    const ts = teile(
      quelle([
        block('beschluss', 'Essen um 12:30'),
        block('termin', 'Arbeitseinsatz', { props: { datum: '2026-12-14' } }),
        block('termin', 'ohne Datum', { props: { datum: '2026-02-30' } }),
        block('quote', 'Psalm 23'),
        block('divider', ''),
      ]),
    );
    expect(texte(ts)).toEqual([
      'Beschluss: Essen um 12:30',
      '14.12.2026 – Arbeitseinsatz',
      'ohne Datum',
      'Psalm 23',
      'linie',
    ]);
    expect(ts.map((t) => (t.art === 'text' ? t.rand : null))).toEqual([
      'beschluss',
      'termin',
      'termin',
      'zitat',
      null,
    ]);
  });

  it('Tabelle: Kopfzeile, verbundene Zellen, Zellfarben – die Farbe eines Laufs geht vor', () => {
    const tabelle = block('table', '', {
      content: {
        type: 'tableContent',
        headerRows: 1,
        rows: [
          { cells: [[{ type: 'text', text: 'Wer' }], [{ type: 'text', text: 'Was' }]] },
          {
            cells: [
              {
                type: 'tableCell',
                props: { colspan: 2, backgroundColor: 'yellow', textColor: 'red' },
                content: [
                  { type: 'text', text: 'alle ' },
                  { type: 'text', text: 'gelb', styles: { textColor: 'blue' } },
                ],
              },
            ],
          },
        ],
      },
    });
    const [t] = teile(quelle([tabelle]));
    expect(t.art).toBe('tabelle');
    if (t.art !== 'tabelle') return;
    expect(t.zeilen[0].map((z) => z.kopf)).toEqual([true, true]);
    expect(t.zeilen[1][0]).toEqual({
      absaetze: [
        [
          { text: 'alle ', farbe: ROT },
          { text: 'gelb', farbe: BLAU },
        ],
      ],
      kopf: false,
      spalten: 2,
      zeilen: 1,
      hintergrund: GELB,
    });
  });
});

describe('Feste Punkte', () => {
  const verweis = (art: string, props: Record<string, unknown> = {}) =>
    block('verweis', '', { content: undefined, props: { art, ...props } });

  it('Anwesenheit als Kurzform mit Gästen; ohne Treffen bzw. nicht lesbar ein Satz', () => {
    const stand = {
      abgeschlossen: true,
      begonnen: true,
      personen: [
        { person: 1, name: 'Alwin Friesen', status: 'da' as const },
        { person: 2, name: 'Maria Dück', status: 'weg' as const },
        { person: 3, name: 'Peter Wiens', status: 'offen' as const },
      ],
    };
    const b = verweis('anwesenheit', { gaeste: JSON.stringify(['Gast A']) });
    expect(texte(teile(quelle([b], { anwesenheit: stand })))).toEqual([
      'Anwesend (1): Alwin Friesen · Abwesend: Maria Dück · Offen: Peter Wiens · Gäste: Gast A',
    ]);
    expect(texte(teile(quelle([b])))).toEqual(['Zu dieser Sitzung gibt es kein Gruppentreffen.']);
    expect(texte(teile(quelle([b], { anwesenheit: 'unbekannt' })))).toEqual([
      'Die Anwesenheit ließ sich nicht laden.',
    ]);
  });

  it('Offene To-Dos von früher – die seit der letzten Sitzung erledigten ausgeschrieben, durchgestrichen', () => {
    const alt = (id: string, x = {}) => aufgabe(id, { sitzung: 's-okt', ...x });
    const aufgaben = [
      alt('Beamer', { bis: '2026-11-01', wer: [2] }),
      alt('Flyer'),
      statusSetzen(alt('Kaffee'), 'erledigt', 1, '2026-11-01T10:00:00Z'),
      aufgabe('neu-heute'),
    ];
    const letztes = {
      beginn: '2026-10-14T17:00:00Z',
      titel: 'Oktober',
      kopf: kopf({ sitzung: 's-okt' }),
    };
    const [t] = teile(
      quelle([verweis('offene-aufgaben')], { aufgaben, letztes: letztes as unknown as Sitzung }),
    );
    expect(t.art).toBe('kasten');
    if (t.art !== 'kasten') return;
    expect(t.zeilen.map((z) => text(z.absaetze[0]))).toEqual([
      'Offene To-Dos von früher (2)',
      'Beamer – Maria Dück · überfällig · 01.11.2026',
      'Flyer',
      'Seit der Sitzung am 14.10.2026 erledigt (1)',
      'Kaffee',
    ]);
    expect(t.zeilen[1].absaetze[0].at(-1)).toMatchObject({ stil: 'rot' });
    expect(t.zeilen[4].absaetze[0][0]).toMatchObject({ durchgestrichen: true, stil: 'grau' });
    expect(t.zeilen[1].zeichen).toEqual({ art: 'punkt' });
  });

  it('nichts offen: ein Satz; keine frühere Sitzung: keine Erledigt-Zeile', () => {
    expect(texte(teile(quelle([verweis('offene-aufgaben')])))).toEqual([
      'Offene To-Dos von früher (0) | Nichts offen von früher.',
    ]);
  });

  it('Früheres Protokoll: live das letzte; festgehalten das damalige – fehlt es, ein Satz', () => {
    const letztes = {
      beginn: '2026-10-14T17:00:00Z',
      titel: 'Oktober',
      kopf: kopf({
        sitzung: 's-okt',
        status: 'frei',
        freigabe: { von: 1, am: '2026-10-15T08:00:00Z' },
      }),
    } as unknown as Sitzung;
    expect(texte(teile(quelle([verweis('letztes-protokoll')], { letztes })))).toEqual([
      'Oktober vom 14.10.2026 · freigegeben am 15.10.2026',
    ]);
    const fest = verweis('letztes-protokoll', { fest: JSON.stringify({ sitzung: 's-sep' }) });
    expect(texte(teile(quelle([fest], { letztes })))).toEqual([
      'Das damalige Protokoll gibt es nicht mehr.',
    ]);
    expect(texte(teile(quelle([verweis('letztes-protokoll')])))).toEqual([
      'Keine frühere Sitzung mit Protokoll.',
    ]);
  });

  it('eine unbekannte Art wird nicht als bekannte gezeigt', () => {
    expect(texte(teile(quelle([verweis('zukunft')])))).toEqual(['Fester Punkt']);
  });
});

describe('Übersicht', () => {
  it('Beschlüsse, To-Dos (Wer und Bis), Termine mit ihrem Punkt; Nächste Sitzung', () => {
    const b = protokollBlatt(
      quelle(
        [
          block('beschluss', 'vorweg'),
          punkt('Essen'),
          block('beschluss', 'Essen um 12:30'),
          block('aufgabe', 'Deko', { props: { aufgabe: 't1' } }),
          punkt('Termine'),
          block('termin', 'Arbeitseinsatz', { props: { datum: '2026-12-14' } }),
        ],
        {
          aufgaben: [aufgabe('t1', { wer: [2], bis: '2026-12-06' })],
          naechste: '2026-12-09T18:00:00Z',
        },
      ),
    );
    const u = b.uebersicht;
    expect(u.beschluesse.map((e) => `${text(e.absatz)} | ${e.punkt}`)).toEqual([
      'vorweg | vor dem ersten Punkt',
      'Essen um 12:30 | Punkt 1',
    ]);
    expect(u.aufgaben.map((e) => `${text(e.absatz)} | ${e.punkt}`)).toEqual([
      'Deko – Maria Dück, bis 06.12.2026 | Punkt 1',
    ]);
    expect(u.termine.map((e) => `${text(e.absatz)} | ${e.punkt}`)).toEqual([
      '14.12.2026 – Arbeitseinsatz | Punkt 2',
    ]);
    expect(u.naechste).toBe('Mi, 09.12.2026 · 19:00 Uhr');
    expect(protokollBlatt(quelle([])).uebersicht.naechste).toBeNull();
  });
});
