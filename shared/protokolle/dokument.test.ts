import { describe, expect, it } from 'vitest';
import {
  ableiten,
  BLOCK,
  fremdeTypen,
  istDokument,
  mitNeuenIds,
  textAus,
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

  it('zählt nur Überschriften der Stufe 1 als Tagesordnungspunkte', () => {
    expect(a.punkte.map((p) => [p.nummer, p.titel])).toEqual([
      [1, 'Andacht & Gebet'],
      [2, 'Termine & Gemeindeleben'],
    ]);
  });

  it('ordnet die Aufgabe dem Punkt davor zu; ohne gespeicherten Verweis ist sie noch nicht in „Mitarbeit“', () => {
    expect(a.aufgaben).toEqual([
      {
        blockId: 'd9aaec23-1dad-4f34-b084-7d41b2ab8db5',
        text: 'Beamer reparieren lassen',
        punkt: '24e72200-5688-4b9e-84ca-1b1dd7b25a4e',
        aufgabe: null,
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
      { blockId: 'a1', text: 'Einladung schreiben', punkt: 'p2', aufgabe: 'mit-7' },
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
