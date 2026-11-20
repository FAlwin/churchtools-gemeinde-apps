import { describe, expect, it } from 'vitest';
import { markdownZuHtml } from '@shared/website/markdown';
import { BAUSTEIN_TYPEN, type Baustein } from '@shared/website/modell';
import { abschnitt, baustein, BEISPIELE, seite, spalte } from '@shared/website/website.testdaten';
import { textFeldGueltig, textUebernehmen } from './textAenderung';

const SEITE = seite({
  abschnitte: [
    abschnitt(
      [
        baustein('ueberschrift', { id: 'u' }),
        baustein('text', { id: 't', markdown: 'alt' }),
        baustein('knoepfe', { id: 'k' }),
        baustein('html', { id: 'h' }),
        baustein('akzentzeile', { id: 'a' }),
      ],
      {
        spalten: [
          spalte(
            [
              baustein('ueberschrift', { id: 'u' }),
              baustein('text', { id: 't', markdown: 'alt' }),
              baustein('knoepfe', { id: 'k' }),
              baustein('html', { id: 'h' }),
              baustein('akzentzeile', { id: 'a' }),
              baustein('bildText', { id: 'bt' }),
            ],
            { id: 's' },
          ),
        ],
      },
    ),
  ],
});
const b = (k: number) => SEITE.abschnitte[0].spalten[0].bausteine[k];

describe('welche Felder sich direkt tippen lassen', () => {
  it('genau: Überschrift und Akzentzeile (text), Text und Bild+Text (markdown), Knopf (knopf) – über ALLE Baustein-Typen', () => {
    const erlaubt: Record<string, [string, number][]> = {
      ueberschrift: [['text', 0]],
      akzentzeile: [['text', 0]],
      text: [['markdown', 0]],
      bildText: [['markdown', 0]],
      knoepfe: [
        ['knopf', 0],
        ['knopf', 1],
      ],
    };
    for (const typ of BAUSTEIN_TYPEN) {
      const bs = BEISPIELE[typ]('x');
      for (const feld of ['text', 'markdown', 'knopf'] as const)
        for (const n of [0, 1, 2, 5]) {
          const soll = (erlaubt[typ] ?? []).some(([f, nn]) => f === feld && nn === n);
          expect(textFeldGueltig(bs, feld, n), `${typ}/${feld}/${n}`).toBe(soll);
        }
    }
  });

  it('„Eigenes HTML“ nie – und kein Baustein, den es nicht gibt', () => {
    expect(textFeldGueltig(b(3), 'text', 0)).toBe(false);
    expect(textFeldGueltig(b(3), 'markdown', 0)).toBe(false);
    expect(textFeldGueltig(undefined, 'text', 0)).toBe(false);
  });

  it('ein Knopf, den es nicht gibt (n zu groß, negativ, gebrochen), ist kein Feld', () => {
    for (const n of [2, -1, 0.5, NaN])
      expect(textFeldGueltig(b(2), 'knopf', n), String(n)).toBe(false);
  });
});

describe('getippten Text in die Seite übernehmen', () => {
  const alt = (s = SEITE) => JSON.stringify(s);

  it('Überschrift: reiner Text, Leerraum zusammengezogen', () => {
    const r = textUebernehmen(SEITE, {
      i: 0,
      j: 0,
      k: 0,
      feld: 'text',
      n: 0,
      wert: '  Neue   Überschrift ',
    });
    expect(r.ok && r.seite.abschnitte[0].spalten[0].bausteine[0]).toMatchObject({
      typ: 'ueberschrift',
      text: 'Neue Überschrift',
      ebene: 2, // alles andere bleibt
    });
  });

  it('Akzentzeile und die Beschriftung des zweiten Knopfes (nur dieser ändert sich)', () => {
    const a = textUebernehmen(SEITE, { i: 0, j: 0, k: 4, feld: 'text', n: 0, wert: 'Hallo!' });
    expect(a.ok && a.seite.abschnitte[0].spalten[0].bausteine[4]).toMatchObject({ text: 'Hallo!' });
    const k = textUebernehmen(SEITE, {
      i: 0,
      j: 0,
      k: 2,
      feld: 'knopf',
      n: 1,
      wert: 'Dritter Weg',
    });
    expect(k.ok).toBe(true);
    const knoepfe =
      (k.ok &&
        (k.seite.abschnitte[0].spalten[0].bausteine[2] as Extract<Baustein, { typ: 'knoepfe' }>)
          .knoepfe) ||
      [];
    expect(knoepfe.map((x) => x.text)).toEqual(['Mehr erfahren', 'Dritter Weg']);
    expect(knoepfe[1]).toMatchObject({ art: 'neben', ziel: { art: 'extern' } });
  });

  it('Text: das Markdown entsteht aus den Blöcken (mit Escape) und zeigt hinterher genau den getippten Text', () => {
    const r = textUebernehmen(SEITE, {
      i: 0,
      j: 0,
      k: 1,
      feld: 'markdown',
      n: 0,
      bloecke: [
        { art: 'p', laeufe: [{ t: 'Zwei * drei ' }, { t: 'fett', fett: true }] },
        { art: 'p', laeufe: [{ t: '- kein Punkt' }] },
      ],
    });
    expect(r.ok).toBe(true);
    const md =
      (r.ok && (r.seite.abschnitte[0].spalten[0].bausteine[1] as { markdown: string }).markdown) ||
      '';
    expect(md).toBe('Zwei \\* drei **fett**\n\n\\- kein Punkt');
    expect(markdownZuHtml(md)).toBe(
      '<p>Zwei * drei <strong>fett</strong></p>\n<p>- kein Punkt</p>',
    );
  });

  it('Text in Bild+Text, und ein ganz leerer Text', () => {
    const r = textUebernehmen(SEITE, { i: 0, j: 0, k: 5, feld: 'markdown', n: 0, bloecke: [] });
    expect(
      r.ok && (r.seite.abschnitte[0].spalten[0].bausteine[5] as { markdown: string }).markdown,
    ).toBe('');
  });

  it('eine Formatierung, die sich nicht genau speichern lässt, wird NICHT übernommen (kein stilles Verfälschen)', () => {
    // kursiv direkt vor fett, ohne Leerzeichen dazwischen: `*a***b**` liest der Leser anders
    const r = textUebernehmen(SEITE, {
      i: 0,
      j: 0,
      k: 1,
      feld: 'markdown',
      n: 0,
      bloecke: [
        {
          art: 'p',
          laeufe: [
            { t: 'a', kursiv: true },
            { t: 'b', fett: true },
          ],
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.meldung).toMatch(/Formatierungen/);
  });

  it('Gegenprobe: zeigt das Markdown nicht genau den getippten Text, wird nichts übernommen – auch wenn der Rahmen einen Link nicht vorher geprüft hat', () => {
    // (Der Rahmen lässt solche Links nie durch – diese Probe ist die zweite Sicherung: Ein Link, den der Leser nicht als Link liest,
    // erschiene als `[x](…)` im Text.)
    for (const link of ['a b', 'javascript:alert(1)', '//evil.de']) {
      const r = textUebernehmen(SEITE, {
        i: 0,
        j: 0,
        k: 1,
        feld: 'markdown',
        n: 0,
        bloecke: [{ art: 'p', laeufe: [{ t: 'x', link }] }],
      });
      expect(r.ok, link).toBe(false);
    }
  });

  it('nicht tippbare Felder und fehlende Stellen: abgelehnt, die Seite bleibt, wie sie ist', () => {
    const vorher = alt();
    for (const m of [
      { i: 0, j: 0, k: 3, feld: 'text' as const, n: 0, wert: 'x' }, // Eigenes HTML
      { i: 0, j: 0, k: 9, feld: 'text' as const, n: 0, wert: 'x' }, // gibt es nicht
      { i: 5, j: 0, k: 0, feld: 'text' as const, n: 0, wert: 'x' },
      { i: 0, j: 0, k: 0, feld: 'markdown' as const, n: 0, bloecke: [] }, // falsches Feld
      { i: 0, j: 0, k: 1, feld: 'text' as const, n: 0, wert: 'x' },
      { i: 0, j: 0, k: 2, feld: 'knopf' as const, n: 7, wert: 'x' },
    ])
      expect(textUebernehmen(SEITE, m).ok, JSON.stringify(m)).toBe(false);
    expect(alt()).toBe(vorher);
  });

  it('die falsche Form für das Feld (Text statt Blöcke und umgekehrt) wird abgelehnt', () => {
    expect(textUebernehmen(SEITE, { i: 0, j: 0, k: 1, feld: 'markdown', n: 0, wert: 'x' }).ok).toBe(
      false,
    );
    expect(textUebernehmen(SEITE, { i: 0, j: 0, k: 0, feld: 'text', n: 0, bloecke: [] }).ok).toBe(
      false,
    );
    expect(textUebernehmen(SEITE, { i: 0, j: 0, k: 0, feld: 'text', n: 0 }).ok).toBe(false);
  });

  it('die Eingabe wird nicht verändert', () => {
    const vorher = alt();
    textUebernehmen(SEITE, { i: 0, j: 0, k: 0, feld: 'text', n: 0, wert: 'Neu' });
    expect(alt()).toBe(vorher);
  });
});
