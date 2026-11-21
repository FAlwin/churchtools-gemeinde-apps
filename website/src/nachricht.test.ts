import { describe, expect, it } from 'vitest';
import { AUFTEILUNGEN, gestaltungSchema, spaltenAnzahl } from '@shared/website/modell';
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

describe('Nachricht „verschieben“ (W3c-2): nur Zahlen, beide Stellen müssen es geben', () => {
  // SEITE: Abschnitt 0 hat eine Spalte mit Bausteinen (siehe oben), Abschnitt 1 hat zwei Spalten, die zweite ist leer.
  const spalten = SEITE.abschnitte.map((a) => a.spalten.map((sp) => sp.bausteine.length));
  const AB = (von: unknown, nach: unknown) =>
    M({ was: 'verschieben', art: 'abschnitt', von, nach });
  const BA = (von: unknown, nach: unknown) => M({ was: 'verschieben', art: 'baustein', von, nach });
  const st = (i: number, j: number, k: number) => ({ i, j, k });

  it('ein gültiger Abschnitt und ein gültiger Baustein kommen durch – auch in die leere Spalte und ganz nach unten', () => {
    expect(spalten[1]).toEqual([1, 0]); // Annahme der Tests unten
    expect(nachrichtLesen(AB(0, 2), SEITE)).toMatchObject({
      was: 'verschieben',
      art: 'abschnitt',
      von: 0,
      nach: 2,
    });
    expect(nachrichtLesen(BA(st(1, 0, 0), st(1, 1, 0)), SEITE)).toMatchObject({ art: 'baustein' }); // leere Spalte
    expect(nachrichtLesen(BA(st(1, 0, 0), st(1, 0, 1)), SEITE)).not.toBeNull(); // hinter den letzten
  });

  it('Stellen, die es nicht gibt, sind keine Nachricht', () => {
    for (const m of [
      AB(2, 0), // Abschnitt gibt es nicht
      AB(0, 3), // Stelle hinter dem Ende
      BA(st(5, 0, 0), st(0, 0, 0)),
      BA(st(1, 0, 4), st(0, 0, 0)), // Baustein gibt es nicht
      BA(st(1, 0, 0), st(1, 1, 1)), // leere Spalte: nur Stelle 0
      BA(st(1, 0, 0), st(1, 5, 0)), // Spalte gibt es nicht
      BA(st(1, 0, 0), st(9, 0, 0)),
    ])
      expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });

  it('falsche Form: Text statt Zahl, fremde Felder, falsche Art, Zahlen statt Stelle – nichts davon kommt an', () => {
    for (const m of [
      AB('0', 1),
      AB(0, -1),
      AB(0.5, 1),
      AB({ i: 0 }, 1),
      M({ was: 'verschieben', art: 'abschnitt', von: 0, nach: 1, html: '<b>' }),
      M({ was: 'verschieben', art: 'seite', von: 0, nach: 1 }),
      M({ was: 'verschieben', von: 0, nach: 1 }),
      BA(0, st(0, 0, 0)),
      BA(st(1, 0, 0), 1),
      BA({ i: 1, j: 0, k: 0, extra: 1 }, st(0, 0, 0)),
      BA({ i: 1, j: 0 }, st(0, 0, 0)),
      BA(st(1, 0, 0), { i: 0, j: 0, k: 1.5 }),
    ])
      expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });

  it('„hoch“ und „runter“ gibt es als Nachricht nicht mehr – der Griff und die Pfeiltasten sagen „verschieben“', () => {
    expect(nachrichtLesen(M({ was: 'hoch', i: 1 }), SEITE)).toBeNull();
    expect(nachrichtLesen(M({ was: 'runter', i: 0 }), SEITE)).toBeNull();
  });

  it('Rückgängig und Wiederholen sind Nachrichten ohne Inhalt', () => {
    expect(nachrichtLesen(M({ was: 'rueckgaengig' }), SEITE)).toEqual(M({ was: 'rueckgaengig' }));
    expect(nachrichtLesen(M({ was: 'wiederholen' }), SEITE)).toEqual(M({ was: 'wiederholen' }));
  });
});

describe('Nachrichten aus der Vorschau: nur bekannte Form, nur Zahlen', () => {
  it('jede Art mit gültigen Stellen kommt durch', () => {
    expect(nachrichtLesen(M({ was: 'einfuegen', i: 0 }), SEITE)).toMatchObject({
      was: 'einfuegen',
      i: 0,
    });
    expect(nachrichtLesen(M({ was: 'einfuegen', i: 2 }), SEITE)).toMatchObject({ i: 2 }); // ganz unten
    for (const was of ['gestalten', 'kopieren', 'loeschen'])
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

describe('Nachrichten „aufteilung“ und „abstand“ (W3c-3): eine Zahl und ein Name aus den Listen des Modells', () => {
  // SEITE: Abschnitt 0 hat eine Spalte, Abschnitt 1 hat zwei Spalten.
  const AUF = (i: unknown, aufteilung: unknown) => M({ was: 'aufteilung', i, aufteilung });
  const ABS = (i: unknown, abstand: unknown) => M({ was: 'abstand', i, abstand });

  it('jede Aufteilung aus AUFTEILUNGEN mit der Spaltenzahl des Abschnitts kommt durch', () => {
    for (const a of AUFTEILUNGEN) {
      const soll = spaltenAnzahl(a) === 2;
      expect(nachrichtLesen(AUF(1, a), SEITE) !== null, a).toBe(soll);
    }
    expect(nachrichtLesen(AUF(1, '2-1'), SEITE)).toEqual(AUF(1, '2-1'));
    expect(nachrichtLesen(AUF(0, '1'), SEITE)).toEqual(AUF(0, '1')); // eine Spalte: nur '1' (ändert nichts, aber ist gültig)
  });

  it('eine andere Spaltenzahl wird abgelehnt – das ginge nur im Fenster „Gestalten“', () => {
    expect(nachrichtLesen(AUF(1, '1-1-1'), SEITE)).toBeNull();
    expect(nachrichtLesen(AUF(1, '1'), SEITE)).toBeNull();
    expect(nachrichtLesen(AUF(0, '1-1'), SEITE)).toBeNull();
  });

  it('keine Aufteilung aus der Liste, falsche Form, falsche Zahl: abgelehnt', () => {
    for (const m of [
      AUF(1, '3-1'),
      AUF(1, '2:1'),
      AUF(1, ''),
      AUF(1, 21),
      AUF(1, null),
      M({ was: 'aufteilung', i: 1 }),
      M({ was: 'aufteilung', aufteilung: '1-1' }),
      AUF(1.5, '1-1'),
      AUF(-1, '1-1'),
      AUF('1', '1-1'),
      M({ was: 'aufteilung', i: 1, aufteilung: '1-1', html: '<b>' }),
    ])
      expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });

  it('ein Abschnitt, den es nicht gibt, ist keine Nachricht', () => {
    expect(nachrichtLesen(AUF(2, '1-1'), SEITE)).toBeNull();
    expect(nachrichtLesen(AUF(99, '1-1'), SEITE)).toBeNull();
    expect(nachrichtLesen(ABS(2, 'klein'), SEITE)).toBeNull();
    expect(nachrichtLesen(ABS(99, 'klein'), SEITE)).toBeNull();
  });

  it('jede Abstand-Stufe des Schemas kommt durch, jede andere nicht', () => {
    for (const st of gestaltungSchema.shape.abstand.options)
      expect(nachrichtLesen(ABS(0, st), SEITE), st).toEqual(ABS(0, st));
    for (const m of [
      ABS(0, 'riesig'),
      ABS(0, 'Klein'),
      ABS(0, ''),
      ABS(0, 12),
      ABS(0, null),
      M({ was: 'abstand', i: 0 }),
      M({ was: 'abstand', abstand: 'klein' }),
      ABS(0.5, 'klein'),
      ABS(-1, 'klein'),
      M({ was: 'abstand', i: 0, abstand: 'klein', css: 'x' }),
    ])
      expect(nachrichtLesen(m, SEITE), JSON.stringify(m)).toBeNull();
  });

  it('ohne das Kennzeichen des Editors ist es keine Nachricht', () => {
    expect(nachrichtLesen({ was: 'aufteilung', i: 1, aufteilung: '2-1' }, SEITE)).toBeNull();
    expect(nachrichtLesen({ was: 'abstand', i: 0, abstand: 'klein' }, SEITE)).toBeNull();
  });
});
