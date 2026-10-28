import { describe, expect, it } from 'vitest';
import { ableiten, BLOCK, type Block } from './dokument';
import { anfangsDokument, neuerKopf } from './beginnen';
import { STANDARD_VORLAGEN } from './vorlagen';

let n = 0;
const neueId = (): string => `id${++n}`;

const aufgabenIds = (dok: readonly Block[]): string[] =>
  ableiten(dok).aufgaben.map((a) => a.aufgabe ?? '');

describe('anfangsDokument (S5-1)', () => {
  it('Vorlage: neue Block-IDs, jede feste Aufgabe mit eigener To-Do-ID', () => {
    const v = STANDARD_VORLAGEN[0];
    const dok = anfangsDokument({ art: 'vorlage', vorlage: v }, neueId);
    expect(ableiten(dok).punkte.map((p) => p.titel)).toEqual(
      ableiten(v.bloecke).punkte.map((p) => p.titel),
    );
    expect(dok.some((b) => v.bloecke.some((x) => x.id === b.id))).toBe(false);
    const ids = aufgabenIds(dok);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('auch eingerückte Aufgaben bekommen eine ID', () => {
    const vorlage = {
      ...STANDARD_VORLAGEN[0],
      bloecke: [
        {
          id: 'l',
          type: 'bulletListItem',
          content: [],
          children: [
            { id: 'a', type: BLOCK.aufgabe, props: { aufgabe: '' }, content: [], children: [] },
          ],
        },
      ],
    };
    const dok = anfangsDokument({ art: 'vorlage', vorlage }, neueId);
    expect(dok[0].children?.[0].props?.aufgabe).toMatch(/^id\d+$/);
  });

  it('wie letztes Mal: nur Tagesordnungspunkte und feste Punkte, nichts Festgehaltenes', () => {
    const letztes: Block[] = [
      { id: 'p', type: 'heading', props: { level: 1 }, content: 'Finanzen', children: [] },
      { id: 'x', type: 'paragraph', content: 'Notiz', children: [] },
      { id: 'a', type: BLOCK.aufgabe, props: { aufgabe: 't1' }, content: 'Alt', children: [] },
      {
        id: 'v',
        type: BLOCK.verweis,
        props: { art: 'offene-aufgaben', fest: '{"offen":[]}' },
        children: [],
      },
    ];
    const dok = anfangsDokument({ art: 'letztes', dokument: letztes }, neueId);
    expect(dok.map((b) => b.type)).toEqual(['heading', BLOCK.verweis]);
    expect(dok[1].props).toEqual({ art: 'offene-aufgaben' });
  });

  it('leer: ein leeres Dokument', () => {
    expect(anfangsDokument({ art: 'leer' }, neueId)).toEqual([]);
  });
});

describe('neuerKopf', () => {
  it('Entwurf, ohne Sperre und Freigabe, mit Termin, Treffen und Beginn der Sitzung', () => {
    const k = neuerKopf(
      {
        titel: 'Leitungssitzung',
        beginn: '2026-11-11T18:00:00Z',
        termin: { kalender: 4, id: 114 },
        treffen: 15,
      },
      's1',
      'abc',
    );
    expect(k).toEqual({
      art: 'protokoll',
      fassung: 1,
      sitzung: 's1',
      titel: 'Leitungssitzung',
      status: 'entwurf',
      beginn: '2026-11-11T18:00:00Z',
      termin: { kalender: 4, id: 114 },
      treffen: 15,
      freigabe: null,
      sperre: null,
      stand: 'abc',
    });
  });
});
