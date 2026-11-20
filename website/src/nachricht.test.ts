import { describe, expect, it } from 'vitest';
import { baustein, abschnitt, seite, spalte } from '@shared/website/website.testdaten';
import { nachrichtLesen } from './nachricht';

const M = (rest: Record<string, unknown>) => ({ websiteEditor: true, ...rest });
const SEITE = seite({
  abschnitte: [
    abschnitt([baustein('text', { id: 'b0' }), baustein('trenner', { id: 'b1' })], { id: 'a0' }),
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
      M({ was: 'baustein', i: 0, j: 0, k: 2 }),
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
