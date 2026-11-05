import { describe, expect, it } from 'vitest';
import {
  ableiten,
  BLOCK,
  fremdeTypen,
  istDokument,
  mitNeuenIds,
  punktBeschriftung,
  punktEbene,
  punktNummer,
  stufeDerEbene,
  textAus,
  TIEFSTE_EBENE,
  type Block,
} from './dokument';
import { BLOCKNOTE_DOKUMENT } from './dokument.testdaten';
import { STANDARD_VORLAGEN, startDokument } from './vorlagen';

let n = 0;
const neueId = (): string => `n${++n}`;
const t = (text: string): Block['content'] => [{ type: 'text', text, styles: {} }];

describe('textAus', () => {
  it('liest den Text eines echten BlockNote-Absatzes ohne Auszeichnung', () => {
    expect(textAus(BLOCKNOTE_DOKUMENT[1].content)).toBe('Peter: Römer 12, 9–13');
  });
  it('nimmt bei Links deren Text', () => {
    expect(textAus(BLOCKNOTE_DOKUMENT[7].content)).toBe('Link');
  });
  it('kommt mit fehlendem oder fremdem Inhalt zurecht', () => {
    expect(textAus(undefined)).toBe('');
    expect(textAus({ type: 'tableContent' })).toBe('');
    expect(textAus([null, 3, { type: 'text' }])).toBe('');
  });
});

describe('ableiten – aus dem, was BlockNote liefert', () => {
  const a = ableiten(BLOCKNOTE_DOKUMENT);

  it('zählt Überschrift 1 als Tagesordnungspunkt, Überschrift 2 als Unterpunkt (K3b)', () => {
    expect(a.punkte.map((p) => [p.nummer, p.tiefe, p.titel])).toEqual([
      ['1', 0, 'Andacht & Gebet'],
      ['2', 0, 'Termine & Gemeindeleben'],
      ['2.1', 1, 'Zwischenüberschrift'],
    ]);
  });

  it('ordnet die Aufgabe dem Punkt davor zu; ohne gespeicherten Verweis ist sie noch nicht in „Mitarbeit“', () => {
    expect(a.aufgaben).toEqual([
      {
        blockId: 'd9aaec23-1dad-4f34-b084-7d41b2ab8db5',
        text: 'Beamer reparieren lassen',
        punkt: '24e72200-5688-4b9e-84ca-1b1dd7b25a4e',
        aufgabe: null,
        vorab: null,
      },
    ]);
  });
});

describe('ableiten – aus dem Startdokument einer Vorlage', () => {
  it('findet Punkte und feste Aufgaben der Leitungssitzung', () => {
    const dok = startDokument(STANDARD_VORLAGEN[0], neueId);
    const a = ableiten(dok);
    expect(a.punkte.map((p) => p.titel)).toEqual([
      'Andacht & Gebet',
      'Protokoll der letzten Sitzung',
      'Offene To-Dos',
      'Termine & Gemeindeleben',
      'Verschiedenes',
    ]);
    expect(a.aufgaben).toHaveLength(1);
    expect(a.aufgaben[0]).toMatchObject({
      text: 'Raum für die nächste Sitzung prüfen',
      aufgabe: null,
      punkt: a.punkte[4].blockId,
    });
  });
});

describe('ableiten – Beschlüsse, Termine und Unterpunkte', () => {
  const dok: Block[] = [
    { id: 'vor', type: BLOCK.beschluss, content: t('Vor dem ersten Punkt') },
    { id: 'p1', type: 'heading', props: { level: 1 }, content: t('Finanzen') },
    {
      id: 'li',
      type: 'bulletListItem',
      content: t('Spenden'),
      children: [
        {
          id: 'li2',
          type: 'bulletListItem',
          content: t('tief'),
          children: [{ id: 'b-tief', type: BLOCK.beschluss, content: t('Rücklage bilden') }],
        },
      ],
    },
    { id: 'leer', type: BLOCK.beschluss, content: t('   ') },
    { id: 'p2', type: 'heading', props: { level: 1 }, content: t('Termine') },
    { id: 'term', type: BLOCK.termin, props: { datum: '2026-11-13' }, content: t('Gemeindeabend') },
    {
      id: 'term-kaputt',
      type: BLOCK.termin,
      props: { datum: '2026-02-30' },
      content: t('Gibt es nicht'),
    },
    {
      id: 'a1',
      type: BLOCK.aufgabe,
      props: { aufgabe: 'mit-7' },
      content: t('Einladung schreiben'),
    },
  ];
  const a = ableiten(dok);

  it('findet Beschlüsse auch tief in Unterpunkten und lässt leere weg', () => {
    expect(a.beschluesse).toEqual([
      { blockId: 'vor', text: 'Vor dem ersten Punkt', punkt: null },
      { blockId: 'b-tief', text: 'Rücklage bilden', punkt: 'p1' },
    ]);
  });

  it('übernimmt nur gültige Kalenderdaten', () => {
    expect(a.termine.map((x) => [x.blockId, x.datum])).toEqual([
      ['term', '2026-11-13'],
      ['term-kaputt', null],
    ]);
  });

  it('liest den Verweis auf den To-Do-Wert', () => {
    expect(a.aufgaben).toEqual([
      { blockId: 'a1', text: 'Einladung schreiben', punkt: 'p2', aufgabe: 'mit-7', vorab: null },
    ]);
  });
});

describe('fremdeTypen (S4-1)', () => {
  it('findet unbekannte Blockarten auch in Unterpunkten – einmal, sortiert', () => {
    const dok: Block[] = [
      { id: 'a', type: 'paragraph' },
      { id: 'b', type: 'table', children: [{ id: 'c', type: 'image' }] },
      { id: 'd', type: 'bulletListItem', children: [{ id: 'e', type: 'table' }] },
    ];
    expect(fremdeTypen(dok, new Set(['paragraph', 'bulletListItem']))).toEqual(['image', 'table']);
  });
  it('leer, wenn alles bekannt ist', () => {
    const typen = new Set<string>();
    const sammle = (b: Block): void => {
      typen.add(b.type);
      (b.children ?? []).forEach(sammle);
    };
    BLOCKNOTE_DOKUMENT.forEach(sammle);
    expect(fremdeTypen(BLOCKNOTE_DOKUMENT, typen)).toEqual([]);
  });
});

describe('istDokument', () => {
  it('erkennt das echte BlockNote-Dokument', () => {
    expect(istDokument(BLOCKNOTE_DOKUMENT)).toBe(true);
  });
  it('weist Fremdes ab', () => {
    expect(istDokument({})).toBe(false);
    expect(istDokument([{ id: 1, type: 'paragraph' }])).toBe(false);
    expect(istDokument([{ id: 'a', type: 'p', children: [{ id: 'b' }] }])).toBe(false);
  });
});

describe('mitNeuenIds', () => {
  it('vergibt überall neue IDs und lässt das Original unberührt', () => {
    const kopie = mitNeuenIds(BLOCKNOTE_DOKUMENT, neueId);
    const ids = (bs: Block[]): string[] => bs.flatMap((b) => [b.id, ...ids(b.children ?? [])]);
    expect(ids(kopie).some((id) => ids(BLOCKNOTE_DOKUMENT).includes(id))).toBe(false);
    (kopie[1].content as { text: string }[])[0].text = 'geändert';
    expect(textAus(BLOCKNOTE_DOKUMENT[1].content)).toBe('Peter: Römer 12, 9–13');
    expect(ableiten(kopie).punkte.map((p) => p.titel)).toEqual(
      ableiten(BLOCKNOTE_DOKUMENT).punkte.map((p) => p.titel),
    );
  });
});

describe('Unterpunkte (K3b)', () => {
  const h = (id: string, level: number): Block => ({
    id,
    type: 'heading',
    props: { level },
    content: t(id),
  });
  const beschluss = (id: string): Block => ({
    id,
    type: BLOCK.beschluss,
    content: t(`Beschluss ${id}`),
  });

  it('Ebene aus der Stufe: 1 = Punkt, 2/4/5/6 = Unterpunkt, 3 = „Überschrift“ ohne Nummer', () => {
    expect([1, 2, 3, 4, 5, 6].map((level) => punktEbene(h('x', level)))).toEqual([
      0,
      1,
      null,
      2,
      3,
      4,
    ]);
    expect(punktEbene({ type: 'heading' })).toBe(0); // BlockNote lässt Stufe 1 weg
    expect(punktEbene({ type: 'paragraph' })).toBeNull();
    expect(TIEFSTE_EBENE).toBe(4);
  });

  it('stufeDerEbene ist die Umkehrung von punktEbene – für jede Ebene', () => {
    for (let e = 0; e <= TIEFSTE_EBENE; e++) expect(punktEbene(h('x', stufeDerEbene(e)))).toBe(e);
  });

  it('nummeriert 4.1 bis 4.1.1.1.1 und beginnt je Punkt neu', () => {
    const a = ableiten([
      h('A', 1),
      h('A1', 2),
      h('A1a', 4),
      h('A1a1', 5),
      h('A1a1a', 6),
      h('A2', 2),
      h('Ueberschrift', 3),
      h('B', 1),
      h('B1', 2),
    ]);
    expect(a.punkte.map((p) => [p.titel, p.nummer, p.tiefe])).toEqual([
      ['A', '1', 0],
      ['A1', '1.1', 1],
      ['A1a', '1.1.1', 2],
      ['A1a1', '1.1.1.1', 3],
      ['A1a1a', '1.1.1.1.1', 4],
      ['A2', '1.2', 1],
      ['B', '2', 0],
      ['B1', '2.1', 1],
    ]);
  });

  it('überspringt keine Ebene: 4.1.1 direkt unter dem Punkt zählt als 4.1', () => {
    const a = ableiten([h('A', 1), h('tief', 5), h('noch', 4)]);
    expect(a.punkte.map((p) => [p.titel, p.nummer, p.tiefe])).toEqual([
      ['A', '1', 0],
      ['tief', '1.1', 1],
      ['noch', '1.1.1', 2],
    ]);
  });

  it('ein Eintrag gehört zum Unterpunkt davor; vor dem ersten Punkt zählt kein Unterpunkt', () => {
    const a = ableiten([h('frei', 2), beschluss('b0'), h('A', 1), h('A1', 2), beschluss('b1')]);
    expect(a.punkte.map((p) => p.titel)).toEqual(['A', 'A1']);
    expect(a.beschluesse.map((b) => [b.blockId, b.punkt])).toEqual([
      ['b0', null],
      ['b1', 'A1'],
    ]);
  });

  it('nur die oberste Ebene zählt – eine eingerückte Überschrift bleibt ohne Nummer', () => {
    const a = ableiten([{ ...h('A', 1), children: [h('innen', 1), h('innen2', 2)] }]);
    expect(a.punkte.map((p) => p.titel)).toEqual(['A']);
  });

  it('Nummer und Beschriftung: „4.“ / „4.1“ und „Punkt 4.2 · Essen“', () => {
    expect(punktNummer({ nummer: '4', tiefe: 0 })).toBe('4.');
    expect(punktNummer({ nummer: '4.1', tiefe: 1 })).toBe('4.1');
    expect(punktBeschriftung({ nummer: '4.2', titel: 'Essen' })).toBe('Punkt 4.2 · Essen');
  });
});
