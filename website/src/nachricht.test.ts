import { describe, expect, it } from 'vitest';
import { baustein, abschnitt, seite, spalte } from '@shared/website/website.testdaten';
import { nachrichtLesen } from './nachricht';

const M = (rest: Record<string, unknown>) => ({ websiteEditor: true, ...rest });
const SEITE = seite({
  abschnitte: [
    abschnitt(
      [
        baustein('text', { id: 'b0' }),
        baustein('trenner', { id: 'b1' }),
        baustein('html', { id: 'b2' }),
        baustein('knoepfe', { id: 'b3' }),
        baustein('ueberschrift', { id: 'b4' }),
      ],
      { id: 'a0' },
    ),
    abschnitt([], {
      id: 'a1',
      aufteilung: '1-1',
      spalten: [spalte([baustein('text', { id: 'c0' })], { id: 's0' }), spalte([], { id: 's1' })],
    }),
  ],
});

describe('Nachrichten aus der Vorschau: nur bekannte Form, nur Zahlen', () => {
  it('jede Art mit gültigen Stellen kommt durch', () => {
    expect(nachrichtLesen(M({ was: 'einfuegen', i: 0 }), SEITE)).toMatchObject({
      was: 'einfuegen',
      i: 0,
    });
    expect(nachrichtLesen(M({ was: 'einfuegen', i: 2 }), SEITE)).toMatchObject({ i: 2 }); // ganz unten
    for (const was of ['gestalten', 'hoch', 'runter', 'kopieren', 'loeschen'])
      expect(nachrichtLesen(M({ was, i: 1 }), SEITE)).toMatchObject({ was, i: 1 });
    expect(nachrichtLesen(M({ was: 'baustein', i: 1, j: 0, k: 0 }), SEITE)).toMatchObject({
      was: 'baustein',
    });
    expect(nachrichtLesen(M({ was: 'baustein-neu', i: 1, j: 1 }), SEITE)).toMatchObject({
      was: 'baustein-neu',
    });
    expect(nachrichtLesen(M({ was: 'scroll', y: 120.4 }), SEITE)).toEqual(
      M({ was: 'scroll', y: 120 }),
    );
    expect(nachrichtLesen(M({ was: 'bereit' }), SEITE)).toEqual(M({ was: 'bereit' }));
  });

  it('Stellen außerhalb des Bereichs werden ignoriert (null) – für jede Art', () => {
    const falsch = [
      M({ was: 'einfuegen', i: 3 }),
      M({ was: 'gestalten', i: 2 }),
      M({ was: 'hoch', i: 5 }),
      M({ was: 'runter', i: 99 }),
      M({ was: 'kopieren', i: 2 }),
      M({ was: 'loeschen', i: 2 }),
      M({ was: 'baustein', i: 0, j: 0, k: 5 }),
      M({ was: 'baustein', i: 0, j: 1, k: 0 }),
      M({ was: 'baustein', i: 5, j: 0, k: 0 }),
      M({ was: 'baustein-neu', i: 0, j: 1 }),
      M({ was: 'baustein-neu', i: 7, j: 0 }),
    ];
    for (const m of falsch) expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });

  it('negative, gebrochene und nicht-numerische Stellen sind keine Nachricht', () => {
    for (const i of [-1, 0.5, '0', null, NaN, Infinity, {}, [0]])
      expect(nachrichtLesen(M({ was: 'gestalten', i }), SEITE), String(i)).toBeNull();
  });

  it('falsche Form: ohne Kennzeichen, unbekannte Art, kein Objekt – alles wird ignoriert', () => {
    expect(nachrichtLesen({ was: 'gestalten', i: 0 }, SEITE)).toBeNull();
    expect(nachrichtLesen(M({ was: 'sprengen', i: 0 }), SEITE)).toBeNull();
    expect(nachrichtLesen({ websiteEditor: false, was: 'gestalten', i: 0 }, SEITE)).toBeNull();
    for (const x of [null, undefined, 'gestalten', 42, [], true])
      expect(nachrichtLesen(x, SEITE)).toBeNull();
  });

  it('aus der Nachricht wird NICHTS außer den Zahlen übernommen (Zusätze fallen weg)', () => {
    const m = nachrichtLesen(
      M({
        was: 'baustein',
        i: 0,
        j: 0,
        k: 0,
        html: '<script>x</script>',
        markdown: 'böse',
        id: 'fremd',
      }),
      SEITE,
    );
    expect(m).toEqual({ websiteEditor: true, was: 'baustein', i: 0, j: 0, k: 0 });
  });

  it('ein Scrollwert wird begrenzt und gerundet; kein endlicher Wert ist keine Nachricht', () => {
    expect(nachrichtLesen(M({ was: 'scroll', y: -50 }), SEITE)).toMatchObject({ y: 0 });
    expect(nachrichtLesen(M({ was: 'scroll', y: 9e12 }), SEITE)).toMatchObject({ y: 1_000_000 });
    expect(nachrichtLesen(M({ was: 'scroll', y: Infinity }), SEITE)).toBeNull();
    expect(nachrichtLesen(M({ was: 'scroll', y: 'oben' }), SEITE)).toBeNull();
  });

  it('eine leere Seite: nur „einfügen“ an Stelle 0', () => {
    const leer = seite();
    expect(nachrichtLesen(M({ was: 'einfuegen', i: 0 }), leer)).not.toBeNull();
    expect(nachrichtLesen(M({ was: 'einfuegen', i: 1 }), leer)).toBeNull();
    expect(nachrichtLesen(M({ was: 'gestalten', i: 0 }), leer)).toBeNull();
  });
});

describe('Text direkt tippen: nur tippbare Felder, nur die feste Form, nur echte Links', () => {
  const TIPPEN = (rest: Record<string, unknown>) =>
    M({ was: 'tippen', i: 0, j: 0, k: 0, feld: 'markdown', n: 0, ...rest });
  const TEXT = (rest: Record<string, unknown>) =>
    M({
      was: 'text',
      i: 0,
      j: 0,
      k: 0,
      feld: 'markdown',
      n: 0,
      bloecke: [{ art: 'p', laeufe: [{ t: 'Hallo' }] }],
      ...rest,
    });

  it('die gültige Form kommt durch – Text mit Auszeichnung, reiner Text, Knopf, mit „weiter“', () => {
    expect(nachrichtLesen(TIPPEN({}), SEITE)).toMatchObject({ was: 'tippen' });
    expect(nachrichtLesen(M({ was: 'tippen-ende' }), SEITE)).toEqual(M({ was: 'tippen-ende' }));
    expect(nachrichtLesen(TEXT({}), SEITE)).toMatchObject({ was: 'text' });
    expect(
      nachrichtLesen(
        TEXT({
          bloecke: [{ art: 'ul', laeufe: [{ t: 'a', fett: true, kursiv: true, link: '/x' }] }],
        }),
        SEITE,
      ),
    ).not.toBeNull();
    expect(
      nachrichtLesen(TEXT({ k: 4, feld: 'text', bloecke: undefined, wert: 'Neu' }), SEITE),
    ).not.toBeNull();
    expect(
      nachrichtLesen(TEXT({ k: 3, feld: 'knopf', n: 1, bloecke: undefined, wert: 'Neu' }), SEITE),
    ).not.toBeNull();
    expect(
      nachrichtLesen(TEXT({ weiter: { i: 0, j: 0, k: 4, feld: 'text', n: 0 } }), SEITE),
    ).toMatchObject({ weiter: { k: 4 } });
  });

  it('„Eigenes HTML“ ist nie tippbar – weder „tippen“ noch „text“, in jedem Feld', () => {
    for (const feld of ['text', 'markdown', 'knopf'])
      for (const m of [
        TIPPEN({ k: 2, feld }),
        TEXT({ k: 2, feld, wert: 'x', bloecke: undefined }),
        TEXT({ k: 2, feld }),
      ])
        expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
    // auch nicht als „weiter“
    expect(
      nachrichtLesen(TEXT({ weiter: { i: 0, j: 0, k: 2, feld: 'text', n: 0 } }), SEITE),
    ).toBeNull();
  });

  it('ein Feld, das es nicht gibt, ist keine Nachricht (Baustein, Knopf, falsche Art)', () => {
    for (const m of [
      TIPPEN({ k: 9 }),
      TIPPEN({ i: 3 }),
      TIPPEN({ k: 3, feld: 'knopf', n: 5 }),
      TIPPEN({ k: 0, feld: 'text' }), // ein Text hat kein „text“-Feld
      TEXT({ k: 4, feld: 'markdown', bloecke: [] }), // eine Überschrift hat kein Markdown
    ])
      expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });

  it('je Feld genau EINE Form: Blöcke für Text mit Auszeichnung, `wert` für reinen Text', () => {
    expect(nachrichtLesen(TEXT({ bloecke: undefined }), SEITE)).toBeNull();
    expect(nachrichtLesen(TEXT({ wert: 'x' }), SEITE)).toBeNull();
    expect(nachrichtLesen(TEXT({ k: 4, feld: 'text', bloecke: undefined }), SEITE)).toBeNull();
    expect(nachrichtLesen(TEXT({ k: 4, feld: 'text', wert: 'x' }), SEITE)).toBeNull();
  });

  it('falsche Form im Text: fremde Felder, falsche Arten, Nicht-Texte, zu groß – abgelehnt', () => {
    const falsch = [
      TEXT({ bloecke: [{ art: 'div', laeufe: [] }] }),
      TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: 'a', html: '<b>' }] }] }),
      TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: 'a' }], extra: 1 }] }),
      TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: 'a', fett: false }] }] }),
      TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: 5 }] }] }),
      TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: '' }] }] }),
      TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: 'x'.repeat(20_001) }] }] }),
      TEXT({ bloecke: 'Hallo' }),
      TEXT({ i: '0' }),
      TEXT({ n: -1 }),
      TEXT({ weiter: { i: 0, j: 0, k: 0, feld: 'text', n: 0, extra: 1 } }),
    ];
    for (const m of falsch) expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });

  it('ein ungültiger Link macht die ganze Nachricht ungültig – nichts wird übernommen', () => {
    for (const link of [
      'javascript:alert(1)',
      'JAVASCRIPT:x',
      'data:text/html,x',
      '//evil.de',
      'a b',
      '',
    ])
      expect(
        nachrichtLesen(
          TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: 'a' }, { t: 'b', link }] }] }),
          SEITE,
        ),
        link,
      ).toBeNull();
    for (const link of ['https://a.de', 'http://a.de/x', 'mailto:a@b.de', 'tel:+4912', '/seite/'])
      expect(
        nachrichtLesen(TEXT({ bloecke: [{ art: 'p', laeufe: [{ t: 'b', link }] }] }), SEITE),
        link,
      ).not.toBeNull();
  });

  it('Link prüfen: nur Nummer und Adresse als Text – sonst nichts', () => {
    expect(
      nachrichtLesen(M({ was: 'link-pruefen', id: 3, url: 'https://a.de' }), SEITE),
    ).toMatchObject({ id: 3 });
    for (const m of [
      M({ was: 'link-pruefen', id: 'x', url: 'a' }),
      M({ was: 'link-pruefen', id: 1, url: 5 }),
      M({ was: 'link-pruefen', id: 1, url: 'x'.repeat(2001) }),
      M({ was: 'link-pruefen', id: -1, url: 'a' }),
      M({ was: 'link-pruefen', id: 1 }),
    ])
      expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });
});
