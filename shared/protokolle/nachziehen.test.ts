import { describe, expect, it } from 'vitest';
import { aufgabenAbgleich, neueAufgabe } from './aufgaben';
import { ableiten, textAus, type Block } from './dokument';
import { abgegebenText, aufgabeNachziehen } from './nachziehen';

/** S7-2b: Text, Löschen und Gruppe aus dem Fenster im Protokoll-Entwurf nachziehen. */
const t = (text: string): Block['content'] => [{ type: 'text', text, styles: { bold: true } }];
const aufgabe = (id: string, todo: string, text: string, children: Block[] = []): Block => ({
  id,
  type: 'aufgabe',
  props: { aufgabe: todo, vorab: '' },
  content: t(text),
  children,
});
const absatz = (id: string, text: string): Block => ({
  id,
  type: 'paragraph',
  content: t(text),
  children: [],
});
const DOK: Block[] = [
  { id: 'h', type: 'heading', props: { level: 1 }, content: t('Technik'), children: [] },
  aufgabe('a1', 't1', 'Beamer kaufen', [absatz('u1', 'zwei Angebote einholen')]),
  aufgabe('a2', 't2', 'Raum buchen'),
];
const todo = (id: string, text: string) =>
  neueAufgabe({ id, gruppe: 11, sitzung: 's1', text, von: 1, am: 'x' });
const abgleich = (dok: Block[]) =>
  aufgabenAbgleich({
    eintraege: ableiten(dok).aufgaben,
    vorhanden: [todo('t1', 'Beamer kaufen'), todo('t2', 'Raum buchen')],
    gruppe: 11,
    sitzung: 's1',
    von: 1,
    am: 'y',
  });

describe('aufgabeNachziehen', () => {
  it('Text: ersetzt den Text der Aufgabe, Unterpunkte und To-Do-ID bleiben', () => {
    const r = aufgabeNachziehen(DOK, 't1', { art: 'text', text: ' Beamer leihen ' });
    expect(r.gefunden).toBe(true);
    expect(textAus(r.dokument[1].content)).toBe('Beamer leihen');
    expect(r.dokument[1].props).toEqual({ aufgabe: 't1', vorab: '' });
    expect(r.dokument[1].children?.map((b) => b.id)).toEqual(['u1']);
    // … und der normale Abgleich zieht den Text ins To-Do.
    expect(abgleich(r.dokument).aendern).toEqual([
      expect.objectContaining({ id: 't1', text: 'Beamer leihen' }),
    ]);
  });

  it('raus: die Aufgabe verschwindet, ihre Unterpunkte rücken an ihre Stelle – das To-Do wird als gelöscht vermerkt', () => {
    const r = aufgabeNachziehen(DOK, 't1', { art: 'raus' });
    expect(r.dokument.map((b) => b.id)).toEqual(['h', 'u1', 'a2']);
    expect(abgleich(r.dokument).aendern).toEqual([
      expect.objectContaining({ id: 't1', geloescht: true }),
    ]);
  });

  it('abgegeben: wird ein Absatz mit Hinweis (gleiche Block-ID), das To-Do hier als gelöscht vermerkt', () => {
    const r = aufgabeNachziehen(DOK, 't1', {
      art: 'abgegeben',
      text: 'Beamer kaufen',
      gruppe: 'Jugend',
    });
    expect(r.dokument[1]).toEqual({
      id: 'a1',
      type: 'paragraph',
      content: [{ type: 'text', text: 'Beamer kaufen – an „Jugend“ abgegeben', styles: {} }],
      children: [absatz('u1', 'zwei Angebote einholen')],
    });
    expect(abgleich(r.dokument).aendern).toEqual([
      expect.objectContaining({ id: 't1', geloescht: true }),
    ]);
  });

  it('auch in Unterpunkten; andere Aufgaben bleiben, wie sie sind', () => {
    const tief: Block[] = [
      absatz('p', 'Punkt'),
      { ...absatz('q', 'drin'), children: [aufgabe('a3', 't3', 'Tief')] },
    ];
    const r = aufgabeNachziehen([...tief, ...DOK], 't3', { art: 'raus' });
    expect(r.dokument[1].children).toEqual([]);
    expect(r.dokument.slice(2)).toEqual(DOK);
  });

  it('steht nicht (mehr) im Entwurf: gefunden = false, Dokument unverändert', () => {
    const r = aufgabeNachziehen(DOK, 'weg', { art: 'raus' });
    expect(r).toEqual({ dokument: DOK, gefunden: false });
  });

  it('abgegebenText: getrimmt, Gruppe in Anführungszeichen', () => {
    expect(abgegebenText(' Beamer ', 'Jugend')).toBe('Beamer – an „Jugend“ abgegeben');
  });
});
